# High 02 — Extract Shared Room Zustand Store

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

High

## Current Problem

Shared live room data is duplicated in multiple hooks.

Files:

- `client/src/features/participant/hooks/useMusicRoom.ts`
- `client/src/features/participant/hooks/useParticipant.ts`
- `client/src/features/admin/hooks/useAdminDashboard.ts`

Duplicated state:

- `nowPlaying`
- approved/public queue
- `isPlaying`
- `currentTime`
- `duration`
- `roomKey`
- `isConnecting`

## Target

Create `roomStore` for simple shared room data and socket deltas.

## Plan

- Create `client/src/stores/roomStore.ts`.
- Store plain data only. No socket import.
- Add actions:
  - `setRoomId`
  - `setRoomKey`
  - `setNowPlaying`
  - `applyQueueSnapshot`
  - `applySongApproved`
  - `applySongRemoved`
  - `applyPlaybackUpdated`
  - `applyPlaybackSync`
  - `setIsConnecting`
  - `resetRoom`
- Make `applySongApproved` idempotent.
- Make `applySongRemoved` safe for missing song.
- Keep tiny page UI state local.

## Tests

- Queue snapshot replaces queue.
- Approved song appends once.
- Removed song deletes by ID.
- Playback sync updates time/duration/isPlaying.
- Reset clears room state.

## Done Criteria

- `roomStore.ts` exists.
- Store has no socket import.
- Store tests cover room reducers.
