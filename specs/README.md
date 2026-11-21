# State machine models

The app's behaviour depends on a handful of small state machines. Two of them were
written as XState machines (`client/src/machines/`). The rest existed only as
loose booleans and counters, which is where the bugs were.

Each machine below is modelled twice: `buggy` is the code as it was before the
fix, `fixed` is the code as it is now. The harness asserts that the buggy model
reports a violation and the fixed one reports none, so a model that quietly stops
describing the bug fails the run.

```bash
./specs/run.sh
```

Needs a JRE and `tla2tools.jar` (see the top of `run.sh`). It is not part of
`bun run check`: it takes a few seconds and needs Java, which the app itself does
not.

## Inventory

| State | Where it lives | Explicit? |
| --- | --- | --- |
| Participant request flow | `client/src/machines/participantFlowMachine.ts` | XState |
| Playback transport | `client/src/machines/playbackMachine.ts` | XState |
| Circle wipe | `client/src/shared/lib/routeWipe.ts` | store with an explicit phase |
| Advance guard | `client/src/features/admin/lib/advanceGuard.ts` | explicit, modelled here |
| Listener load session | `client/src/features/participant/lib/loadSession.ts` | explicit, modelled here |
| Playback authority | `server/src/socket/eoHandler.ts` | explicit, modelled here |

## PlaybackAuthority

**Question:** can a listener move the room?

The server authorised every playback event with

```
activeEO = getPlaybackController(roomId)
if (activeEO && activeEO !== socket.id) reject
```

`activeEO` is only set when a socket joins with role `eo`, and the client never
does: the admin joins as `admin`. So the slot was always empty, and the check
passed for every socket. Any participant could advance the room, pause it for
everyone, seek, or jump back.

**Model:** `PlaybackAuthority.tla`. TLC's counterexample is two steps: `Join(p1)`,
then `Advance(p1)`.

**Fix:** `mayDrivePlayback` requires the admin grant that `join_room` records after
validating the token and room ownership, the same grant the admin mutations use.
A registered playback controller is still allowed, so the slot keeps its meaning.

## AdvanceGuard

**Question:** can the room stall on a track that ended?

The admin client sets a guard before asking the room to advance and clears it only
in the acknowledgement. A socket that dropped between the two left the guard set
for a request nobody would ever answer, so every later track end was ignored until
the page was reloaded. That is the "it stopped and I had to refresh" report.

**Model:** `AdvanceGuard.tla`. The interesting part is `requestLive`: the stall is
a guard held for a request that can no longer be answered, so the checked property
is `socket = "connected" /\ inFlight => requestLive`. TLC's counterexample is
`End`, `Drop`, `Reconnect`.

**Fix:** the request is bounded by `socket.timeout(10s)`, and a reconnect or a
disconnect resets the guard. The guard itself is now `advanceGuard.ts`, a two-state
machine per direction, so every way a request can end has one named transition.

## ListenerSession

**Question:** can the element end up playing the wrong track?

`loadTrack` is async. A newer track can be requested while an older load is still
fetching, and the older one must not commit. The guard was a `generation` counter
compared at four call sites.

**Model:** `ListenerSession.tla`, where a load is a `(generation, track)` pair and
can only commit the track it captured. TLC's counterexample is `Request(A)`,
`Request(B)`, `Complete(1, A)`.

**Fix:** the counter, the `ready` flag and the loaded track id are now one
`LoadSession` value with named transitions (`begin`, `commit`, `fail`, `teardown`),
which is the machine the spec describes.

## What is not modelled

- The XState machines. They are already explicit and their transitions are read
  from the file; a TLA+ copy would be a second source of truth.
- Anything time-based beyond "a timeout exists". TLC checks the safety form of each
  property: no stale commit, no dead guard, no unauthorised advance. Liveness under
  fairness would need a temporal spec, and none of these failures need one to be
  caught.
