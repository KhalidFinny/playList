# 03 — The k6 load harness

**Severity:** high

## Current Problem

Nothing generates load. There is no way to reproduce a 50-participant event, so
the free-plan question cannot be answered with data.

## Target

`tests/load/` — k6 scripts that model a real event:

- `join.js` — connect, `join_by_passkey`, `get_now_playing`, hold.
- `event.js` — the full scenario: 50 participants over a compressed window
  (join → idle → search → submit → receive broadcasts → leave) plus 1 admin
  driving `sync_playback` every 3 s and `toggle_playback` occasionally.

The scenario must reproduce the **idle** case as well as the busy one, because
the hypothesis is that heartbeats alone break the budget. A "50 clients idle for
10 minutes" run is the single most informative test.

## Required Design

- **k6 has no Socket.IO client and Go is not installed** (`xk6` needs it), so the
  script implements the handshake and frames directly over
  `k6/experimental/websockets`:
  - `GET /socket.io/?EIO=4&transport=websocket` → Engine.IO `0{...}` open
  - send `40` → Socket.IO connect
  - send `42["join_room",{...}]` and read the `43[...]` ack
  - answer `2` (ping) with `3` (pong)
  The wire format is already written down in
  `docs/plans/2026-10-06-workers-port/`; reuse it rather than re-deriving.
- **Target `localhost:3001`, never the public origin.**
- Read `/api/metrics` before and after each run and diff, so the script's own
  view (k6's metrics) and the server's view can be cross-checked. A disagreement
  between them is itself a finding.
- One VU per participant so the connection count is honest; `constant-vus` with
  a fixed duration, not ramping, so the numbers are comparable across runs.

## Tests

Not run. Verify: a 1-VU smoke run completes a join and an ack; a 50-VU idle run
produces rising `socket.inbound_messages` with no errors.

## Done Criteria

- [ ] k6 completes the Engine.IO/Socket.IO handshake and a `join_room` ack
- [ ] A 50-VU scenario exists for both idle and active behaviour
- [ ] Runs target `localhost:3001` only
- [ ] Server metrics are captured before and after each run
