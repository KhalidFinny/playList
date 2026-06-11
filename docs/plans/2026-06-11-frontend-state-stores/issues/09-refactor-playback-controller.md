# Medium 09 — Refactor Playback Controller to Machine

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

Medium

## Current Problem

`PlaybackController` mixes local timing state, socket sync emits, player refs, and playback lifecycle transitions.

File:

- `client/src/features/admin/components/PlaybackController.tsx`

## Target

Use `playbackMachine` for lifecycle decisions while keeping YouTube player refs local.

## Plan

- Start `playbackMachine` from `PlaybackController` using `@xstate/react`.
- Keep `playerRefA` and `playerRefB` as React refs.
- Send machine events from YouTube callbacks:
  - ready
  - play
  - pause
  - end
  - error
- Send `SYNC_TICK` from interval with current time/duration.
- Machine decides whether sync should emit; component performs actual `socket.emit`.
- Machine decides when next/previous is allowed; hook/component performs socket call.
- Preserve current throttling behavior for `sync_playback`.

## Tests

Covered by `playbackMachine` tests. Add component test only if callback wiring becomes risky.

## Done Criteria

- Playback lifecycle state is in machine.
- YouTube refs remain outside machine context.
- Duplicate next/ended requests are guarded by machine state.
- Client build passes.
