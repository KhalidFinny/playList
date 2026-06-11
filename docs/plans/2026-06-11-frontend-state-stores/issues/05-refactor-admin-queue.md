# High 05 — Refactor Admin Queue Deltas to Store

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

High

## Current Problem

`useAdminDashboard` is too large and applies admin queue socket deltas inline.

File:

- `client/src/features/admin/hooks/useAdminDashboard.ts`

## Target

Use `adminQueueStore` for pending/full queue state and moderation reducer actions.

## Plan

- Replace local admin queue state with store selectors/actions.
- Dispatch socket events to store actions:
  - `new_pending_song`
  - `song_approved`
  - `song_deleted`
  - `song_removed_from_queue`
  - `song_updated`
- Keep socket emits/actions in hook:
  - approve
  - delete
  - edit
  - admin add song
- Keep player refs and search workflow separate.
- Remove obsolete state/imports.

## Done Criteria

- `useAdminDashboard` no longer mutates queue arrays inline.
- Admin moderation UI behavior unchanged.
- Client build passes.
