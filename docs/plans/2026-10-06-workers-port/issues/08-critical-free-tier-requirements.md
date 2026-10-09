# 08 — Free-tier requirements (measured, blocking)

**Severity:** critical

**This addendum is a hard requirement set for the port, not advice.** It comes
from the load test and the corrected Cloudflare pricing reading in
`docs/plans/2026-10-08-o11y-load-test/ANALYSIS.md`. Read that first.

## The headline

**The free plan fits.** At 50 concurrent connections the projected usage is
~10,400 DO requests/day against a 100,000/day allowance — about 10%. The earlier
"does not fit" verdict was wrong: it assumed one inbound WebSocket message = one
billable DO request, but Cloudflare bills incoming WebSocket messages at a
**20:1 ratio** (DO pricing footnote 2, page updated 2026-09-30).

The limit would be reached at roughly **490 concurrent connections**.

## Requirement 1 — Hibernation is mandatory

A Durable Object is billed for wall-clock duration while it is in memory and not
eligible for hibernation.

```
one room held in memory for 24h without hibernation:
  86,400 s x 128 MB / 1 GB = 10,800 GB-s
free duration allowance    = 13,000 GB-s / day    ->  83% for ONE room
```

Two un-hibernated rooms exhaust the daily duration budget. With hibernation an
idle object is not billed at all — Cloudflare's own worked example puts 100
hibernating objects at ~184 GB-s/day each, roughly a 58× reduction.

So the DO must use the **Hibernation API**, not the plain accept path:

- `this.ctx.acceptWebSocket(server)` — not `server.accept()`
- `webSocketMessage` / `webSocketClose` / `webSocketError` handlers — not
  `server.addEventListener`
- Connection state via `ws.serializeAttachment()` / `deserializeAttachment()`,
  and `this.ctx.getWebSockets()` to rebuild the session map in the constructor

Issue 02 (the Socket.IO protocol layer) must be built on this from the start.
Retrofitting hibernation onto an `addEventListener` implementation is a rewrite.

## Requirement 2 — Map the heartbeat to `setWebSocketAutoResponse`

DO pricing footnote 3: application-level auto-responses handled by
`state.setWebSocketAutoResponse()` "will not incur additional wall-clock time,
and so they will not be charged."

Engine.IO's heartbeat is the literal frame `2` (ping) answered with `3` (pong),
so it can be served without waking the object:

```ts
this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("2", "3"));
```

That takes the single largest line item (8,813 requests/day, 85% of the
projected total) to zero. Even without it the plan fits, so this is headroom
rather than a necessity — and it should be confirmed against real billing before
being relied on, because a community thread on exactly this question is still
unresolved.

**Note:** the auto-response must be registered in the constructor, and the DO
must not otherwise depend on seeing the heartbeat.

## Requirement 3 — Watch `rows_written`

Projected ~30,000/day at 50 connections against a 100,000/day allowance, driven
mostly by the admin's `sync_playback` every 3 s. It is the second-tightest limit
after duration. If it grows:

- batch the playback write, or
- lower the sync frequency (the client already interpolates between syncs — see
  the headset-mode work), or
- keep the playback hash out of DO SQLite.

## Requirement 4 — Password hashing EXCEEDS the free CPU budget (measured)

**This is the real blocker, and it is larger than the heartbeat ever was.**

Measured on the current server (`.amp/in/scratch/cpu-probe.ts`, 5 runs each):

| Operation | min | avg | max |
|---|---|---|---|
| argon2id hash (Bun default) | 150.6 ms | 159.4 ms | 169.1 ms |
| **argon2id verify** (what `admin_login` does) | **127.5 ms** | **128.7 ms** | **130.7 ms** |
| bcrypt cost 10 hash | 60.1 ms | 64.7 ms | 75.4 ms |
| bcrypt cost 10 verify | 60.5 ms | 63.6 ms | 69.8 ms |

`admin_login` calls `Bun.password.verify` (`server/src/socket/authHandler.ts:111`).
At **~128 ms of CPU** that is **13× the 10 ms Workers free-plan CPU budget**.

### The ambiguity is resolved — the 10 ms cap DOES apply to Durable Objects

Tested against a real deployment (2026-10-09), with a throwaway probe Worker that
burned CPU in both the Worker fetch handler and a Durable Object, then read the
outcome from `wrangler tail`.

The DO **does** enforce a CPU limit, and the documented "30 seconds" is not what
a free-tier DO gets:

```
"outcome": "exceededCpu"
"exceptions": [{ "name": "Error",
  "message": "Durable Object exceeded its CPU time limit and was reset." }]
```

- A 150 ms burn in the DO → `exceededCpu`. 400 ms and 1000 ms likewise.
- The same 150 ms burn in the Worker fetch handler → `error 1102`. So the control
  confirms enforcement is real and the probe was measuring something.
- A 150 ms burn in the **Worker** also failed, which is the documented 10 ms cap
  behaving as expected.

**Conclusion: DO invocations are bound by the account's CPU limit, not the DO's
configurable 30 s maximum.** The 30 s is the ceiling a Paid account can raise
`cpu_ms` to; it is not the Free allowance. `admin_login`'s 128 ms cannot run here.

#### What the threshold measurement could not settle

An exact ms threshold was **not** pinned, and the attempt is worth recording so
nobody repeats it:

- A busy loop doing `while (Date.now() - t < ms)` is dominated by `Date.now()`
  calls, not by the intended work, so its results are meaningless.
- A plain arithmetic loop is **eliminated by the optimiser**: 100,000,000
  iterations reported `wallMs: 0`, which is impossible.
- Real SHA-256 digests are not eliminable, but the results are non-monotonic —
  10 digests failed while 5,000 passed. Cloudflare documents that each isolate
  gets "built-in flexibility to allow for cases where your Worker infrequently
  runs over the configured limit", so borderline work passes or fails
  non-deterministically. A black-box threshold cannot be read off this way.

The budget is therefore known to be **low single-digit milliseconds at most**,
not 30 s — which is all the decision needs.

### Why it is not just a Bun detail

There is no `Bun.password` on Workers, but the problem is the algorithm, not the
runtime: any memory-hard or iterated hash — argon2, bcrypt, or PBKDF2 with sane
iterations — is deliberately expensive. Whatever replaces `Bun.password` will
cost tens of milliseconds of CPU. This is not a porting detail that goes away.

### The options, in order

1. **Workers Paid, $5/month.** Raises CPU from 10 ms to 30 s. This is now a
   genuine reason to pay — a different one than the request limits, which turned
   out to be fine. **Recommended if the port proceeds.**
2. **Move authentication off the Worker.** Cloudflare Access in front of the
   admin routes, so the Worker never hashes a password. Keeps it free, but it is
   a real architecture change to the admin login flow, and it puts the admin UI
   behind an identity provider.
3. **Lower the hash cost.** Even bcrypt cost 10 is 64 ms — 6× over. Dropping to
   something that fits 10 ms means a materially weaker password hash. Not
   recommended.

`search_songs` is the other candidate and is **not** a CPU risk: its cost is an
outbound `fetch()`, and I/O does not count toward CPU time.

## What NOT to do

- **Do not raise `pingInterval` to buy request headroom.** It was the
  recommendation in the first, wrong version of the analysis. At 20:1 there is no
  need to trade liveness-detection latency for capacity.
- **Do not assume the paid plan is unnecessary.** An earlier revision of this
  file said that, on the request numbers alone. The CPU measurement overturns it:
  password verification is 128 ms against a low-single-digit-ms budget, so the
  paid plan is now the leading option. The *request* limits are still fine for
  free; CPU is what decides.

## Done Criteria

- [x] The Room DO uses `ctx.acceptWebSocket` and the hibernation handlers
- [x] Connection state survives hibernation via `serializeAttachment`
- [x] `setWebSocketAutoResponse("2", "3")` is registered in the constructor
- [ ] Duration per room measured under an idle 50-connection load, against the
      13,000 GB-s/day allowance
- [ ] `rows_written` per connection-day measured against the 100,000/day
      allowance
- [x] CPU of the password path measured — **128 ms, 13× over the 10 ms budget**
- [x] The DO-CPU ambiguity resolved: **the 10 ms cap applies to DO invocations**;
      a 150 ms burn returns `outcome: exceededCpu`. The "30 s" is the Paid ceiling,
      not the Free allowance.
- [ ] A decision taken on the password path (paid plan, or auth off the Worker)

## Implemented and verified (2026-10-09)

The hibernation shape is built and proven, so the "rewrite if retrofitted" risk
is closed. `worker/room-do.ts` + `worker/index.ts` + `wrangler.jsonc`.

Verified against `wrangler dev` with a raw WebSocket client
(`.amp/in/scratch/do-verify.ts`), all passing:

```
PASS  Engine.IO open frame received
PASS  handshake carries a sid
PASS  handshake advertises pingInterval (25000)
PASS  Socket.IO CONNECT acked with 40
PASS  join_room ack received — 431[{"success":true}]
PASS  join_room ack says success
PASS  five pings answered with five pongs
PASS  heartbeat did NOT reach the object (auto-response)   <- messagesHandled 2 -> 2
PASS  connection is tracked
PASS  malformed frame closed the socket
```

The decisive one is `messagesHandled 2 -> 2 across 5 pings`: the heartbeat is
answered by the runtime, so it costs no compute and does not wake the object.

`wrangler deploy --dry-run` passes: 4.10 KiB bundle, ROOM binding, 39 assets.

**Not yet ported** (issues 03–07): D1, the 24 handlers, Redis→DO SQLite, search.
