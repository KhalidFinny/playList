# Frontend Zustand + XState Migration — Context

> **Status:** Partially implemented. Zustand stores and XState machines exist; public room, participant flow, admin queue deltas, and playback controller are wired. Remaining work is deeper admin room-state cleanup if desired.

## Problem

Frontend state is scattered across large React hooks. Some state is simple shared data, some is real workflow state.

Current pain:

- `useAdminDashboard` owns connection, room, queue, playback, moderation, search, socket callbacks.
- `useParticipant` mixes passkey join, search, submit, status, cooldown, room queue/playback.
- `useMusicRoom` duplicates room socket state.
- Queue/playback socket deltas mutate local React state directly.
- Search stale-response guards are duplicated.
- `PlaybackController` has implicit lifecycle transitions around A/B players, play/pause, track-end, previous/next, and sync.

## Decision

Use **both Zustand and XState**.

- **Zustand** for simple shared state and socket delta data.
- **XState** only for workflow/lifecycle state that benefits from explicit transitions.

Do **not** use XState for sepele/simple store state like arrays, payloads, flags, and basic socket deltas.

## Rule of Thumb

Use Zustand when state is:

- shared data
- list/map/payload shaped
- updated by direct socket deltas
- easy to express as reducer actions
- boring if written as a statechart

Use XState when state is:

- a lifecycle/workflow
- has mutually exclusive states
- has impossible-state risk
- has retries/cancellation/stale guards
- has event sequencing/race concerns

## Target Split

```txt
Zustand:
  roomStore.ts
    - nowPlaying
    - queue
    - roomKey
    - playback sync payload
    - connection flags

  adminQueueStore.ts
    - pendingQueue
    - fullQueue
    - processing/editing fields
    - queue delta reducers

XState:
  participantFlowMachine.ts
    - locked/joining/joined
    - search/suggest/submit/cooldown workflow
    - stale search response guards

  playbackMachine.ts
    - idle/loading/ready/playing/paused/transitioning/error
    - EO next/previous/track-ended lifecycle
```

Potential later XState:

```txt
adminModerationMachine.ts
  - only if admin approve/edit/delete workflow becomes race-prone
```

## Current Important Files

### Hooks to refactor

- `client/src/features/admin/hooks/useAdminDashboard.ts`
- `client/src/features/participant/hooks/useParticipant.ts`
- `client/src/features/participant/hooks/useMusicRoom.ts`
- `client/src/features/admin/components/PlaybackController.tsx`
- `client/src/shared/hooks/usePlayback.ts`

### Consumers

- `client/src/hooks/pages/useAdminDashboardPage.ts`
- `client/src/hooks/pages/useParticipantPage.ts`
- `client/src/hooks/pages/useMusicRoomPage.ts`
- `client/src/pages/AdminDashboardPage.tsx`
- `client/src/pages/ParticipantPage.tsx`
- `client/src/pages/MusicRoom.tsx`
- `client/src/features/shared/components/MusicRoomView.tsx`

### Socket transport

- `client/src/shared/lib/socket.ts`

## Implemented Structure

```txt
client/src/stores/
  roomStore.ts
  adminQueueStore.ts

client/src/machines/
  participantFlowMachine.ts
  playbackMachine.ts
```

Tests:

```txt
tests/frontendState.unit.test.ts
```

## Zustand Store Responsibilities

### `roomStore.ts`

Shared live room data:

- `roomId`
- `roomKey`
- `nowPlaying`
- public approved queue
- `isPlaying`
- `currentTime`
- `duration`
- `isConnecting`

Actions:

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

### `adminQueueStore.ts`

Admin queue/moderation data:

- `pendingQueue`
- `fullQueue`
- `processingId`
- `editingId`
- `editValue`

Actions:

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

## XState Machine Responsibilities

### `participantFlowMachine.ts`

Owns workflow, not shared room data.

States:

```txt
locked
joining
joined
searching
submitting
cooldown
error
```

Context:

- `passkey`
- `query`
- `suggestions`
- `results`
- `isConfirmed`
- `submittingId`
- `statusMsg`
- `cooldownSeconds`
- request sequence ids

Events:

- passkey changes/submission
- join success/failure
- query changes
- suggestion/search request/result
- select song
- submit success/failure
- cooldown tick
- clear status

### `playbackMachine.ts`

Owns EO player lifecycle.

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
- `lastSync`
- `error`

Store-backed data like `nowPlaying`/`upNext` may stay in hook/admin state or be passed in as event payload. YouTube player refs stay in React refs, not machine context.

## Socket Integration Rule

Hooks bind sockets and dispatch to Zustand/XState.

```txt
socket.on(event)
  -> Zustand action for simple data delta
  -> XState actor.send(event) for workflow event
```

Stores should not import socket.
Machines should not register global socket listeners in the first migration.

## Test Strategy

Zustand tests:

- queue snapshot/deltas
- playback sync reducer
- admin queue approve/delete/update reducers
- reset behavior

XState tests:

- participant join success/failure
- stale search response rejected
- submit success/failure/cooldown
- playback track-ended transition
- duplicate next ignored while transitioning
- previous success/failure

## Validation Commands

```bash
vp run --filter client build
bun --env-file=.env run test
```

## Migration Safety Notes

- Do Zustand stores first for simple data.
- Add XState only to participant workflow and playback lifecycle.
- Keep hook return shapes stable where possible.
- No server/socket protocol changes.
- Keep tiny UI-only state local.
- Reset stores/machines on room changes.
