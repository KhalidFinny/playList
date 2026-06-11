# Frontend Zustand + XState Migration Plan

> **Status:** Partially implemented on 2026-06-11. Core stores/machines wired; remaining cleanup is optional admin room-state consolidation.

> **IMPORTANT**: Use plan-execute skill to implement this plan task-by-task.

**Goal:** Split frontend state into readable Zustand stores for simple shared data and XState machines for real workflows/lifecycles.
**Architecture:** Hooks remain the React/socket boundary. Zustand owns room/admin queue data and socket deltas. XState owns participant request/search flow and EO playback lifecycle. Tiny visual state stays local.
**Tech Stack:** React 19, TypeScript, Socket.IO client, Zustand, XState v5, `@xstate/react`, Vitest.

---

## Decision

Use **both Zustand and XState**.

- Zustand for sepele/simple shared data.
- XState for workflow/lifecycle logic.

Do not use XState for plain arrays, socket delta payloads, or simple flags.

See [`CONTEXT.md`](./CONTEXT.md) for state split rules, current hotspots, and target architecture.

---

## Issue Index

### High

1. [High 01 — Add Zustand + XState Dependencies and Test Harness](./issues/01-dependencies-test-harness.md)
2. [High 02 — Extract Shared Room Zustand Store](./issues/02-room-zustand-store.md)
3. [High 03 — Refactor Public Music Room to Room Store](./issues/03-refactor-music-room.md)
4. [High 04 — Extract Admin Queue Zustand Store](./issues/04-admin-queue-store.md)
5. [High 05 — Refactor Admin Queue Deltas to Store](./issues/05-refactor-admin-queue.md)

### Medium

6. [Medium 06 — Create Participant Flow XState Machine](./issues/06-participant-flow-machine.md)
7. [Medium 07 — Refactor Participant Hook to Store + Machine](./issues/07-refactor-participant-hook.md)
8. [Medium 08 — Create EO Playback XState Machine](./issues/08-playback-machine.md)
9. [Medium 09 — Refactor Playback Controller to Machine](./issues/09-refactor-playback-controller.md)

### Low

10. [Low 10 — Normalize Socket Binding and Cleanup](./issues/10-socket-binding-cleanup.md)
11. [Low 11 — Remove Dead State and Document Final Map](./issues/11-cleanup-documentation.md)

---

## Target Architecture

```txt
React route/component
  ↓
feature hook
  - binds socket listeners
  - sends simple data deltas to Zustand
  - sends workflow events to XState actors
  - exposes stable view model
  ↓
Zustand stores
  - room data
  - queue data
  - simple reducer actions
  ↓
XState machines
  - participant workflow
  - playback lifecycle
```

## Target Files

```txt
client/src/stores/roomStore.ts
client/src/stores/adminQueueStore.ts
client/src/machines/participantFlowMachine.ts
client/src/machines/playbackMachine.ts
client/src/state/shared/types.ts
client/src/state/shared/queueReducers.ts
```

## Migration Principles

- TDD per store/machine.
- Zustand first for shared data.
- XState only where it makes transitions clearer.
- Keep socket protocol unchanged.
- Keep stores/machines socket-free in first pass.
- Keep YouTube player refs in React refs.
- No compatibility wrappers.
- No giant rewrite commit.

## Acceptance Criteria

- [x] `zustand`, `xstate`, and `@xstate/react` installed.
- [x] Room queue/playback data uses `roomStore` in public/participant views.
- [x] Admin moderation queue data uses `adminQueueStore`.
- [x] Participant join/search/submit workflow uses `participantFlowMachine`.
- [x] EO playback lifecycle uses `playbackMachine`.
- [x] Socket listener cleanup remains explicit.
- [x] Store tests cover simple reducers.
- [x] Machine tests cover workflow transitions and stale guards.
- [x] Client build passes.
- [x] Existing repo tests pass.

## Non-Goals

- No server changes.
- No socket event contract changes.
- No visual redesign.
- No global XState rewrite.
- No React Query/TanStack Query migration.
- No persistence middleware unless separately justified.

## Validation

```bash
vp run --filter client build
bun --env-file=.env run test
```

## Concrete Steps

1. Install `zustand`, `xstate`, and `@xstate/react`.
2. Add store/machine test pattern.
3. Implement `roomStore` with tests.
4. Refactor `useMusicRoom` to use `roomStore`.
5. Implement `adminQueueStore` with tests.
6. Refactor admin queue socket deltas to `adminQueueStore`.
7. Implement `participantFlowMachine` with tests.
8. Refactor `useParticipant` to combine `roomStore` + `participantFlowMachine`.
9. Implement `playbackMachine` with tests.
10. Refactor `PlaybackController` to use `playbackMachine`.
11. Audit socket listener cleanup.
12. Remove dead hook state/imports.
13. Update `CONTEXT.md` with final state map.
14. Run validation commands.
