# Context — observability, load testing, and the Cloudflare free-plan question

> **Status:** ✅ Complete — instrumented, load-tested, verdict in
> [ANALYSIS.md](ANALYSIS.md). 2026-10-09.
>
> **Verdict: the free plan fits**, at ~10% of the DO request allowance for 50
> connections. The hypothesis in "Problem" below was based on a 1:1 message-to-
> request assumption that Cloudflare's pricing contradicts — incoming WebSocket
> messages bill at **20:1**. `ANALYSIS.md` opens with the erratum.
>
> The risk that replaced it: **duration**, if the DO does not hibernate.

## Problem

We have **no observability**. The server has 101 `console.log`/`console.error`
calls and nothing else: no counters, no latency, no connection gauge, no
per-handler cost. So there is no way to answer "what is this thing doing under
load" except by reading logs.

And we need that answer, because of a concrete decision: **does this app fit the
Cloudflare Workers free plan?** `docs/plans/2026-10-06-workers-port/` already
assumes it does. That assumption has never been tested.

The free plan's binding limits (verified against Cloudflare's docs, 2026-10-08):

| Resource | Workers Free |
|---|---|
| Worker requests | 100,000 / day |
| Worker CPU | **10 ms / request** |
| Durable Object requests | **100,000 / day** |
| DO SQLite rows read | 5,000,000 / day |
| DO SQLite rows written | **100,000 / day** |
| D1 rows read / written | 5,000,000 / 100,000 per day |
| DO storage | 5 GB total |

D1 and DO row limits became **hard failures** on 2026-09-01: past the cap,
queries return errors until 00:00 UTC. This is not a soft throttle.

### The hypothesis this plan exists to test

A Socket.IO connection sends an Engine.IO heartbeat every 25 s by default, and
the port terminates WebSockets in a Durable Object — where **each WebSocket
message counts as one DO request**.

```
51 connections × (3600 / 25) heartbeats/hour = 7,344 / hour
                                             = 176,256 / day
```

That is **1.76× the entire daily DO request allowance, on heartbeats alone**,
before a single song is requested or synced. If that arithmetic holds in
practice, the Workers port as designed does not fit the free plan at any
realistic event size, and the fix is either a longer `pingInterval`, moving the
heartbeat off the DO, or the $5/mo paid plan.

It is a hypothesis, not a finding. It has to be measured.

## Fix

Three phases, in order:

1. **Instrument** the running Bun server so every request, socket message, DB
   query and Redis call reports count, latency and rows touched.
2. **Drive** it with k6 at a realistic event shape (≈50 participants + 1 admin
   over a compressed time window) and capture the metrics.
3. **Analyse** the captured numbers against the free-plan limits above and
   produce a fit verdict with the arithmetic shown.

## Architecture Now

```
k6 (50 VUs, EIO4/Socket.IO over ws)
        │
        ▼
  Bun server :3001 ──► metrics registry (counters, histograms, gauges)
        │                        │
        ├──► Redis :6104         └──► GET /api/metrics  (JSON + Prometheus text)
        └──► Postgres (ISOLATED test DB, never production)
```

## Key Files

**New**

- `server/src/lib/metrics.ts` — the registry: counters, latency histograms,
  gauges, and renderers for JSON and Prometheus text.
- `server/src/lib/instrument.ts` — wrappers: `timed()`, `countRows()`,
  `trackEvent()`.
- `server/index.ts` — `GET /api/metrics`; wrap the HTTP routes.
- `server/src/socket/*.ts` — wrap each handler's dispatch in the socket
  instrumentation (one wrapper around `socket.on`, not 24 edits).
- `tests/load/` — k6 scripts and the scenario definitions.

**Changed**

- `server/src/db/client.ts` — count rows read/written per query.
- `server/src/lib/redis.ts` — count commands.

## Important Behavior Changes

- `GET /api/metrics` is a new public endpoint. It must be **loopback-only or
  token-gated** — it leaks load shape, and it must not become part of the
  Worker's public surface.
- Instrumentation adds per-request overhead. It has to be cheap enough not to
  distort what it measures, and that has to be checked (measure with it off vs
  on).

## Tests

Not run (contract: tests only when asked). Verified with `check`, a local
instrumented run, and the k6 scenario.

## Validation Done

Not yet.

## Known Notes

- **Never load-test the production database.** `.env`'s `DATABASE_URL` is the
  live Neon instance. A load test must point at an isolated Postgres. There is
  no local Postgres and no `docker`; `podman` is present, so a throwaway
  `postgres:16-alpine` container is the intended route.
- **Never load-test the public origin.** `playlist.fiinnyy.my.id` is serving
  real users. Load tests target `localhost:3001`.
- `k6` and `go` are both **not installed**. k6 has no native Socket.IO support
  and `xk6` needs Go to build an extension, so the k6 script speaks Engine.IO 4
  + Socket.IO frames directly over `k6/experimental/websockets`. The wire format
  is already documented in `docs/plans/2026-10-06-workers-port/`.
- The free-plan decision metric is **DO requests/day**, not HTTP requests/day.
  HTTP requests are ~2 orders of magnitude below their limit; the DO heartbeat
  is what is tight.
- Worker CPU is 10 ms/request on free. The handlers are small, but `admin_login`
  runs `Bun.password` verification and search does an outbound fetch. Those are
  the two to watch.
