# Plan — headset mode (listen on your own laptop)

> **Status:** ✅ Complete — implemented and verified. 2026-10-08.

## Goal

Let a participant play the room's broadcast on their own laptop so they can
plug in headphones, in sync with the venue speaker.

## Architecture

Client-only. Reuse the existing preview audio proxy and the existing
`playback_sync` relay; add a local `<audio>` engine anchored on a
client-stamped sync timestamp.

## Tech Stack

Unchanged — React 19, zustand, TanStack Router, Tailwind, Bun. No server change.

## Must Not Forget

- **Client-only.** No new socket events, no new endpoints, no server edits. The
  proxy at `/api/preview/:id/stream` and the `playback_sync` relay are reused
  unchanged.
- **Reuse, do not rebuild.** The audio path is the one proven by
  `PreviewAudioPlayer.tsx`; the control treatment is the one already in the
  header (`theme-toggle.tsx`).
- **The engine must be a module singleton.** It has to keep playing while the
  participant moves between `/r/$roomId` and `/r/$roomId/request`; both pages
  unmount on navigation.
- **No device selection.** The OS routes audio to the plugged-in headset.
  `setSinkId` is Chromium-only and was explicitly not asked for.
- **No dead control.** The toggle keeps its space and goes inert (`opacity-38`)
  when there is no track, matching `TransportButton` in `MusicRoomView.tsx`.
- Tests are not run unless asked. Verify with `check` + `build` + a screenshot.
- No commit, no push, no deploy without an explicit command.

## Issue Index

**High**

1. [01-high-store-sync-anchor](issues/01-high-store-sync-anchor.md)
2. [02-high-local-listener-engine](issues/02-high-local-listener-engine.md)

**Medium**

3. [03-medium-listen-toggle](issues/03-medium-listen-toggle.md)

**Low**

4. [04-low-handoff-and-progress](issues/04-low-handoff-and-progress.md)

## Priority Order

1 → 2 → 3 → 4

## Validation Commands

```bash
bun run check          # client tsc + server tsc + lint + format
bun run build
bun run dev:client     # screenshot the header at 1440 and 390
```

## Rollout Plan

- [x] Phase 1 — anchor the broadcast position in `roomStore` (`syncedAt`)
- [x] Phase 2 — the local listener engine
- [x] Phase 3 — the toggle, mounted in both participant headers
- [x] Phase 4 — handoff / progress, verify

## Done Criteria

- [x] A participant can start and stop local playback from the header
- [x] Local playback seeks to the broadcast position and holds it
- [x] Playback survives navigation between the room and the request page
- [x] The control is inert, not missing, when there is nothing to play
- [x] No server file changed
- [x] `bun run check` and `bun run build` pass
- [x] Screenshot of the header, on and off

## Verified

- `bun run check` — clean (client tsc + server tsc + lint + format).
- `bun run build` — passes.
- Screenshots: `.amp/in/artifacts/headset-*.png`.

## Deferred

- **Exact start-up sync.** A listener enabling mid-track is anchored on the last
  relayed sync, which is at most ~3 s old for a just-joined socket. A
  `request_playback_sync` event relayed by the server to the room's controller
  socket, which answers with an immediate `sync_playback`, would make start-up
  exact to network latency. Not built — it needs a new event and a
  cross-client relay, and the current accuracy was judged sufficient.
- **Per-listener drift telemetry.** No way to see how far off a given laptop is
  in the field. Only worth it if listeners report it.
