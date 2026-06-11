# High 03 — Refactor Public Music Room to Room Store

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

High

## Current Problem

`useMusicRoom` owns local state for room data that should be shared.

File:

- `client/src/features/participant/hooks/useMusicRoom.ts`

## Target

Make `useMusicRoom` a socket-binding hook over `roomStore`.

## Plan

- Replace local `useState` room fields with `roomStore` selectors/actions.
- Keep socket registration in hook.
- Dispatch socket events to Zustand actions:
  - `room_key_info`
  - `now_playing_updated`
  - `playback_updated`
  - `playback_sync`
  - `queue_updated`
  - `song_approved`
  - `song_removed_from_queue`
- Preserve session passkey auto-join.
- Preserve wrong-passkey cleanup.
- Preserve loading fallback behavior.

## Done Criteria

- `useMusicRoom` no longer owns shared room state locally.
- Public room return shape remains compatible.
- Socket listener cleanup remains explicit.
- Client build passes.
