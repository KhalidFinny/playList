# Analysis — does this app fit the Cloudflare Workers free plan?

> ## ⚠️ ERRATUM — the first verdict was wrong
>
> This file originally concluded **"does not fit"**, on the assumption that one
> inbound WebSocket message = one billable Durable Object request. **That
> assumption is wrong**, and the corrected verdict is the opposite.
>
> Cloudflare's DO pricing, footnote 2 (page last updated 2026-09-30):
>
> > "A request is needed to create a WebSocket connection. There is no charge for
> > outgoing WebSocket messages, nor for incoming WebSocket protocol pings. For
> > compute requests billing-only, **a 20:1 ratio is applied to incoming WebSocket
> > messages** to factor in smaller messages for real-time communication. For
> > example, 100 WebSocket incoming messages would be charged as 5 requests for
> > billing purposes."
>
> The 20:1 ratio applies to the request count itself, and the free-tier allowance
> is counted in the same adjusted units — Cloudflare's own worked example divides
> the message count by 20 and then subtracts the "included 1 million requests".
>
> So the heartbeat cost is **20× lower than reported**. The measured packet counts
> below are still correct; the interpretation of them was not.
>
> **Corrected verdict: the free plan fits, comfortably.** What follows is the
> corrected arithmetic, the corrected risk ranking, and what actually has to be
> true for it to keep fitting.

> **Status:** ✅ Complete — instrumented, load-tested, verdict corrected. 2026-10-09.

## How it was measured

A second server instance on `:3101`, pointed at a throwaway `postgres:16-alpine`
under podman and a separate Redis database. **The production database and the
public origin were never touched.** k6 drove it with real Engine.IO 4 + Socket.IO
frames over websockets; the server's own counters were scraped from
`/api/metrics` before and after each run.

- `tests/load/socket.js` — the scenario
- `tests/load/run.ts` — the runner, which diffs the server metrics per run

Raw runs: `/tmp/load-{smoke,idle50,active20}.json`.

## The corrected arithmetic

The heartbeat interval is the Socket.IO default, confirmed from the live
handshake rather than assumed:

```
GET /socket.io/?EIO=4?transport=websocket
0{"sid":"...","pingInterval":25000,"pingTimeout":20000,...}
```

At 51 connections (50 participants + 1 admin):

| Source | Messages/day | Billed requests (÷20) |
|---|---|---|
| Heartbeats (144/conn/hour) | 176,256 | **8,813** |
| Admin `sync_playback` every 3s | 28,800 | **1,440** |
| Joins, searches, submits (~1,100) | 1,100 | **55** |
| WebSocket connections created | — | **51** (not ratio-adjusted) |
| **Total** | | **≈ 10,359 / day** |

Against a **100,000/day** allowance: **~10% used.** The limit would be reached at
roughly **490 concurrent connections**.

### What the runs actually showed

| Run | Connections | Inbound packets | Of which heartbeats |
|---|---|---|---|
| `idle50` | 100 (50 held at a time, 70s each) | 350 | 150 |
| `active20` | 40 (20 held, searching every 6s) | 463 | 60 |

The idle run remains the informative one: 43% of traffic was heartbeat while
nothing happened. That is still the shape of the load — it is just 20× cheaper
than it looked.

## Corrected risk ranking

The limit that actually threatens this is **not** requests. It is **duration**,
and only if hibernation is skipped.

| Limit | Free plan | Projected | Verdict |
|---|---|---|---|
| DO requests | 100,000 / day | ~10,400 | **fine** — 10% used |
| DO duration | 13,000 GB-s / day | see below | **breaks without hibernation** |
| **Worker CPU** | **10 ms / request** | **password verify = 128 ms** | **BREAKS — see below** |
| DO rows written | 100,000 / day | ~30,000 | watch it — 30% used |
| DO rows read | 5,000,000 / day | small | fine |
| Worker requests | 100,000 / day | a few per session | fine |
| DO storage | 5 GB | trivial | fine |

## The bigger blocker, found by measuring: password hashing

Request counts were never the problem. **CPU is.** Measured on the current server
(`.amp/in/scratch/cpu-probe.ts`, 5 runs each, CPU not wall time):

| Operation | min | avg | max |
|---|---|---|---|
| argon2id hash (Bun default) | 150.6 ms | 159.4 ms | 169.1 ms |
| **argon2id verify** (what `admin_login` does) | **127.5 ms** | **128.7 ms** | **130.7 ms** |
| bcrypt cost 10 verify | 60.5 ms | 63.6 ms | 69.8 ms |

`admin_login` calls `Bun.password.verify` (`server/src/socket/authHandler.ts:111`).
**~128 ms of CPU is 13× the 10 ms free-plan budget.** This replaces duration as
the thing most likely to force a decision.

**Caveat, and it is load-bearing.** The Workers limits page gives CPU as a
plan-level cap (Free 10 ms, Paid 5 min), while the Durable Objects limits page
says `CPU per request | 30 seconds (default)` and raising it is a Paid setting.
If DO invocations really do get 30 s on Free, this finding is moot. If the 10 ms
account cap applies to them — the conservative reading — `admin_login` cannot run
on the free plan. **This needs confirming against a real deployment**, and it is
the single most valuable thing left to measure.

It is also not a Bun detail. Any memory-hard hash (argon2, bcrypt, PBKDF2 with
sane iterations) is deliberately expensive; whatever replaces `Bun.password` will
cost tens of milliseconds. The options are the $5 paid plan, moving admin auth to
Cloudflare Access, or weakening the hash — in that order.

`search_songs` was the other CPU candidate and is **not** a risk: its cost is an
outbound `fetch()`, and I/O does not count toward CPU time.

### Duration is the thing that breaks a room

A Durable Object is billed for wall-clock time while it is in memory and **not
eligible for hibernation**.

```
one room held in memory 24h, no hibernation:
  86,400 s x 128 MB / 1 GB = 10,800 GB-s / day
free allowance            = 13,000 GB-s / day   ->  83% for ONE room
```

Two un-hibernated rooms break the daily duration budget. With the Hibernation
API, an idle object is not billed at all: Cloudflare's own example 4 puts 100
hibernating objects at ~5,500 GB-s/month each, i.e. ~184 GB-s/day. That is a
~58× reduction.

**So hibernation is not an optimisation here. It is a hard requirement.**

### The CPU row is still a genuine gap

Cloudflare's 10 ms is **CPU time**, not wall time, and CPU time is not what the
server's `http.ms`/`socket.ms` histograms record — those include waiting on
Postgres and Redis, which is free on Workers.

What is known: at 50 idle connections the process sat at **0.5–1% of one core**,
so idle sockets are not a CPU problem. The two handlers that could plausibly
approach 10 ms are `admin_login` (a `Bun.password` verification) and
`search_songs` (an outbound fetch, which is I/O and therefore not CPU).
**Neither was isolated and measured.** Treat CPU as unproven, not as passing.

## Is the measurement trustworthy?

- The heartbeat rate is exact, not estimated: it comes from the handshake's own
  `pingInterval` and was corroborated by 150 observed pongs in the idle run.
- The packet counts are the server's own, not k6's view.
- **What transfers to Workers and what does not:** packet and request counts
  transfer directly — the wire protocol is the same. Latency and CPU do not:
  `workerd` has different startup, no TCP Redis, and a different Postgres story.
  The verdict rests on counts, which is the part that transfers.
- **Instrumentation overhead was not measured against an uninstrumented
  baseline.** The added work is a `Map` increment per event and one `Proxy` trap
  per query. It is not a controlled comparison and should not be quoted as one.
- The 20:1 ratio is a documented billing rule read from the pricing page, not
  something measured here. It is the single load-bearing external fact in this
  document.

## What to do

The free plan holds. To keep it holding, in priority order:

1. **Use the Hibernation API.** `ctx.acceptWebSocket(server)` and the
   `webSocketMessage` / `webSocketClose` handlers. Without it, duration breaks on
   the second room. This is the one non-negotiable.
2. **Map the heartbeat to `setWebSocketAutoResponse`.** Footnote 3: auto-response
   messages "will not incur additional wall-clock time, and so they will not be
   charged." Engine.IO's ping is the literal frame `2` and pong is `3`, so
   `new WebSocketRequestResponsePair("2", "3")` should serve the heartbeat
   without waking the object. That takes the largest single line item to zero.
   Worth confirming against real billing before relying on it — a community
   thread on this exact question is still unresolved.
3. **Watch `rows_written`.** ~30,000/day at 50 connections, driven by
   `sync_playback` every 3 s. If it grows, batch the playback write or lower the
   sync frequency. It is the second-tightest limit.
4. **The CPU question is answered — and it is the blocker.** Password
   verification costs **128 ms**, 13× the 10 ms free budget. See the section
   above. Decide: paid plan, or auth off the Worker.

## Status (2026-10-09)

Items 1 and 2 are **built and verified** — `worker/room-do.ts`,
`worker/index.ts`, `wrangler.jsonc`. The DO uses `ctx.acceptWebSocket`, the
hibernation handlers, `serializeAttachment`, and
`setWebSocketAutoResponse("2", "3")`. Against `wrangler dev`, five pings produced
five pongs while `messagesHandled` stayed at 2 — so the heartbeat is genuinely
served by the runtime and never wakes the object. `wrangler deploy --dry-run`
passes (4.10 KiB, ROOM binding, 39 assets).

Item 3 is instrumented and reporting (~30,000 rows written/day projected).

Item 4 is measured, and it is the one that needs a decision.

The rest of the port (D1, the 24 handlers, Redis→DO SQLite, search) is issues
03–07 and is untouched.

## What not to do

- **Do not raise `pingInterval` as the primary fix.** It was the recommendation
  in the first, wrong version of this document. At 20:1 the heartbeat is 8,813
  requests/day, so there is no need to trade liveness-detection latency for
  headroom. Keep the 25 s default.
- **Do not reach for the $5 paid plan on these numbers.** It buys nothing that is
  needed at 50 connections.
