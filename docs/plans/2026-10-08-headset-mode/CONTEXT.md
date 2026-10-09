# Context — headset mode (listen on your own laptop)

> **Status:** ✅ Complete — implemented, `check` + `build` green. 2026-10-08.

## Problem

At an event the broadcast plays through the venue speaker, driven by the admin's
laptop. Attendees want to hear the same track in their own headphones, plugged
into their own laptop.

Today that is impossible. The participant client receives playback **state**
only — `nowPlaying`, `isPlaying`, `currentTime`, `duration` — and renders a
visual mirror of the disc and progress. The only audio in the system comes out
of the admin's hidden YouTube players in `PlaybackController.tsx`. No
participant device ever plays a sample.

The venue speaker is still on, so the laptop playback has to land on the same
position as the broadcast, not merely play the same track.

## Fix

A "listen on this device" toggle in the participant header that plays the
broadcast locally in an `<audio>` element, seeked to the broadcast position and
held there.

Everything it needs already exists:

- `/api/preview/:id` and `/api/preview/:id/stream` — the same-origin audio
  proxy built for the admin preview. Public, CORS, `Range` support. Reused
  as-is, no server change.
- `playback_sync` — the server already relays `{currentTime, duration,
  isPlaying}` to every participant, including an immediate replay from Redis on
  join (`connectionHandler.ts:157`).

## Architecture Now

```
admin PlaybackController (YouTube)
        │  sync_playback  ~every 3s
        ▼
   server (Redis room:<id>:playback)  ──broadcast──►  room
                                                       │
                        roomStore: currentTime, isPlaying, syncedAt
                                                       │
                            localListener (module singleton)
                                 │  expectedPosition() = currentTime + (now - syncedAt)
                                 ▼
                            <audio> → laptop output → headphones
```

`syncedAt` is stamped on the client when a sync is applied, so the anchor needs
no clock agreement with the server. Between syncs the position is extrapolated
from that anchor; a 1s-tolerance drift check corrects only gross error.

The listener is a **module singleton**, not a component: it has to survive
route changes between the room and the request page, which unmount their pages.

## Key Files

**New**

- `client/src/stores/listenStore.ts` — `enabled` / `phase` / `error` for the UI
- `client/src/features/participant/lib/localListener.ts` — the audio engine
- `client/src/features/participant/components/ListenToggle.tsx` — the control

**Changed**

- `client/src/stores/roomStore.ts` — add `syncedAt`, refreshed on every sync and
  play/pause so extrapolation has a valid anchor
- `client/src/pages/MusicRoom.tsx`, `client/src/pages/ParticipantPage.tsx` —
  mount the toggle in the participant header

## Important Behavior Changes

- A participant device can now produce audio. Before, only the admin's did.
- No new socket events, no new endpoints, no server change. The audio proxy
  becomes participant-facing, so its load is no longer one admin preview at a
  time.

## Tests

Not run (contract: tests only when asked). Verified with `bun run check`
(client tsc + server tsc + lint + format) and `bun run build`.

## Validation Done

See `plan.md` → Verified.

## Known Notes

- **Echo.** The venue speaker keeps playing, so a listener wearing headphones
  also hears PA bleed. Both are driven from the same position, so the offset is
  roughly the network latency plus the PA's own output latency (~100–300 ms),
  not a slap-back. If it is audible in the room, the fix is the venue's PA
  level, not the client.
- **Accuracy.** ~100 ms while the room is syncing (a live `playback_sync` is
  fresh on arrival). A participant who joins and enables instantly may be up to
  ~3 s off until the next live sync arrives, then corrected. The relay upgrade
  that would make start-up exact is described in the plan.
- **Bandwidth.** 50 listeners at ~128 kbps ≈ 6.4 Mbps sustained, proxied
  googlevideo → server → client. Fine on the current box; worth watching if the
  count grows.
- **Seeking.** Starting mid-track requires a byte-range seek into the WebM
  stream. The proxy supports `Range`; this is the one thing to watch if a
  listener reports starting from the top.
- **No device selection.** Deliberate. The request was "plays on the laptop, I
  plug in the headset" — the OS routes it. `setSinkId` is Chromium-only and was
  not needed.
