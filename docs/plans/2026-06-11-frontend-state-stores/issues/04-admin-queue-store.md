# High 04 — Extract Admin Queue Zustand Store

> **Status:** Done in implementation commits `62e70f5` and `adba914`; cleanup continued after.

## Severity

High

## Current Problem

Admin queue arrays and mutation reducers live inline inside `useAdminDashboard`.

File:

- `client/src/features/admin/hooks/useAdminDashboard.ts`

State:

- `pendingQueue`
- `fullQueue`
- `processingId`
- `editingId`
- `editValue`

## Target

Create `adminQueueStore` for admin queue/moderation data.

## Plan

- Create `client/src/stores/adminQueueStore.ts`.
- Add actions:
  - `applyInitialQueues`
  - `applyNewPendingSong`
  - `applySongApproved`
  - `applySongDeleted`
  - `applySongUpdated`
  - `setProcessingId`
  - `startEditing`
  - `stopEditing`
  - `setEditValue`
  - `resetAdminQueue`
- Keep socket emits in `useAdminDashboard`.
- Keep store socket-free.

## Tests

- New pending song appends once.
- Approved song leaves pending and enters full queue.
- Deleted song leaves both queues.
- Updated title changes in both queues.
- Reset clears admin queue state.

## Done Criteria

- `adminQueueStore.ts` exists.
- Store tests cover admin reducers.
- No socket import in store.
