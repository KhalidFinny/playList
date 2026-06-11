# Medium 08 — Create EO Playback XState Machine

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

Medium

## Current Problem

`PlaybackController` has implicit lifecycle logic around YouTube players, play/pause, track end, next/previous, and sync throttling.

File:

- `client/src/features/admin/components/PlaybackController.tsx`

This is workflow-shaped and benefits from XState.

## Target

Create `playbackMachine` for EO playback lifecycle. Do not put raw YouTube player refs in machine context.

## Machine

File:

- `client/src/machines/playbackMachine.ts`

States:

```txt
idle
loading
ready
playing
paused
transitioning
previousLoading
error
```

Context:

- `activePlayer`
- `currentTime`
- `duration`
- `lastSync`
- `error`

Events:

- `PLAYER_READY`
- `TRACK_LOADED`
- `PLAY`
- `PAUSE`
- `SEEK`
- `TRACK_ENDED`
- `NEXT_REQUESTED`
- `NEXT_RESOLVED`
- `NEXT_FAILED`
- `PREVIOUS_REQUESTED`
- `PREVIOUS_RESOLVED`
- `PREVIOUS_FAILED`
- `SYNC_TICK`
- `PLAYER_ERROR`

## Tests

- `TRACK_LOADED` moves idle/loading to ready.
- `PLAY` moves ready/paused to playing.
- `PAUSE` moves playing to paused.
- `TRACK_ENDED` moves playing to transitioning.
- Duplicate `TRACK_ENDED` while transitioning is ignored.
- `NEXT_RESOLVED` returns to playing/ready with updated player state.
- `PREVIOUS_FAILED` returns to prior safe state or error.

## Done Criteria

- Machine exists and is typed.
- Machine has no socket import.
- Machine has no raw player refs in context.
- Tests cover transition/race cases.
