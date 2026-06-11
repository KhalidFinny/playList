# Low 10 — Normalize Socket Binding and Cleanup

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

Low

## Current Problem

Socket listeners are spread across hooks. After stores/machines are added, duplicate listeners could apply the same event twice.

Files:

- `client/src/features/admin/hooks/useAdminDashboard.ts`
- `client/src/features/participant/hooks/useParticipant.ts`
- `client/src/features/participant/hooks/useMusicRoom.ts`
- `client/src/shared/lib/socket.ts`

## Target

Keep socket registration explicit, minimal, and correctly cleaned up.

## Plan

- Audit all `socket.on` / `socket.off` pairs.
- Ensure each route binds only the listeners it needs.
- Route simple socket deltas to Zustand actions.
- Route workflow events to XState actor events.
- Keep stores and machines free from global socket listener registration.
- Avoid helper abstraction unless it makes duplicated cleanup clearer.

## Events To Audit

- `connect`
- `disconnect`
- `room_key_info`
- `now_playing_updated`
- `queue_updated`
- `playback_updated`
- `playback_sync`
- `new_pending_song`
- `song_approved`
- `song_deleted`
- `song_removed_from_queue`
- `song_updated`

## Done Criteria

- Every listener has matching cleanup.
- No duplicate event application on one route.
- Stores/machines stay socket-listener free.
- Existing socket e2e tests pass.
