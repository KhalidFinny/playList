# 01 — Anchor the broadcast position in `roomStore`

**Severity:** high

## Current Problem

`roomStore` keeps `currentTime`, but nothing records *when* that number was
true. `applyPlaybackSync` (`client/src/stores/roomStore.ts:60`) overwrites
`currentTime` and drops the moment of arrival:

```ts
applyPlaybackSync: ({ currentTime, duration, isPlaying }) =>
  set({ currentTime, duration, isPlaying }),
```

A local player cannot use a position without knowing its age. `currentTime` is
only refreshed when the admin's controller broadcasts (~every 3 s), so treating
it as "now" is wrong by up to 3 s.

The server already sends an `updatedAt`, but it is the **server's** clock; using
it on the client mixes two clocks and breaks if the VPS and the laptop disagree.
`playback_sync` from a live broadcast is fresh on arrival anyway, so the arrival
moment is the better anchor.

## Target

`roomStore` gains `syncedAt`, stamped locally whenever the position is known:

```ts
syncedAt: number;   // client epoch ms of the last known position
```

- `applyPlaybackSync` sets `syncedAt: Date.now()`.
- `applyPlaybackUpdated` (play/pause) also sets it — play/pause fixes the
  position at that instant, so the anchor must move with it or a resume would
  extrapolate across the whole pause.
- Initial value `0`, which the engine reads as "position unknown".

```ts
applyPlaybackSync: ({ currentTime, duration, isPlaying }) =>
  set({ currentTime, duration, isPlaying, syncedAt: Date.now() }),
applyPlaybackUpdated: (isPlaying) => set({ isPlaying, syncedAt: Date.now() }),
```

## Required Design

- Additive. No existing reader of the store changes; `currentTime` keeps its
  meaning.
- Do not use the server's `updatedAt` in the store. Client clock only.
- `syncedAt: 0` must remain distinguishable from a real timestamp — it means
  "no position has been received yet".

## Tests

Not run. Covered by `tsc`.

## Done Criteria

- [x] `RoomState` has `syncedAt`
- [x] Both `applyPlaybackSync` and `applyPlaybackUpdated` stamp it
- [x] `initialRoomState` sets it to `0`
- [x] No consumer of the store changed
