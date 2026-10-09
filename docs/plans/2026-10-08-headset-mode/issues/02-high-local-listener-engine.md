# 02 — The local listener engine

**Severity:** high

## Current Problem

There is no participant-side audio at all. `MusicRoomView` renders a disc,
metadata and a queue; the only sound in the app comes from the admin's hidden
YouTube players in `PlaybackController.tsx`. A participant who wants to listen
in headphones has nothing to listen to.

## Target

`client/src/features/participant/lib/localListener.ts` — a module singleton
that owns one `<audio>` element, plays the broadcast track through the existing
preview proxy, and keeps it on the broadcast position.

```ts
startLocalListener(): void
stopLocalListener(): void
```

Lifecycle:

1. On start, create the element, subscribe to `useRoomStore`, start a 2 s drift
   check, and load the current track if there is one.
2. On a track change, `fetch('/api/preview/<youtubeId>')`, set the returned
   same-origin `url`, wait for `canplay`, seek to the broadcast position, play.
3. On play/pause, mirror the broadcast.
4. Every 2 s, if `|audio.currentTime − expectedPosition()| > 1 s`, seek.

Position:

```ts
function expectedPosition(): number {
  const { currentTime, duration, isPlaying, syncedAt } = useRoomStore.getState();
  const elapsed = isPlaying && syncedAt > 0 ? (Date.now() - syncedAt) / 1000 : 0;
  const position = Math.max(0, currentTime + elapsed);
  return duration > 0 ? Math.min(position, duration) : position;
}
```

## Required Design

- **Module singleton, not a component.** `MusicRoom.tsx` and
  `ParticipantPage.tsx` unmount on navigation between them; playback must not
  stop when the participant goes to the request page. `socket.ts` is the
  existing precedent for this shape.
- **Seek before play.** Set `currentTime` after `canplay` and before `play()`
  so audio never starts from 0 and jumps.
- **No `crossOrigin`.** The stream URL is same-origin, so CORS is not in play.
  (`PreviewAudioPlayer.tsx` sets it, vestigially, from the googlevideo era.)
- **Generation token.** Every load takes a token; a stale in-flight load must
  not write `src` or phase after the track changed or the listener stopped.
- **Errors tear down.** A failed load stops the engine and records the message,
  so the control goes inert-but-retryable rather than pretending to play.
- **No `try/catch` around everything.** Only the network/load boundary.
- Read the store with `getState()`/`subscribe()`, not hooks — this is not a
  React component and must not re-render the tree on every sync.

## Tests

Not run. Verify: `check`, then in a live room confirm the element seeks to the
broadcast position and that play/pause follows the admin.

## Done Criteria

- [x] `startLocalListener` / `stopLocalListener` exported
- [x] Plays the same track as the broadcast, seeked to its position
- [x] Mirrors play/pause
- [x] Corrects drift over 1 s
- [x] Survives route changes between the room and the request page
- [x] Stops cleanly — no element, no interval, no subscription left behind
