# Medium 08 — Participant Surface Migration

> **Status:** Done — 2026-10-06. Implemented and verified; see `plan.md` for the deviations
> recorded during execution.

## Severity

Medium — depends on 03, 05, 06.

## Current Problem

Files:

- `client/src/features/participant/components/JoinFlow.tsx`
- `client/src/features/participant/components/NowPlayingBar.tsx`
- `client/src/features/participant/components/RequestFlow.tsx`
- `client/src/features/participant/components/ResultCard.tsx`
- `client/src/features/music-room/components/LyricsDisplay.tsx`
- `client/src/features/music-room/components/StationSequence.tsx`
- `client/src/features/music-room/components/TrackMetadata.tsx`
- `client/src/features/shared/components/MusicRoomView.tsx`
- `client/src/features/shared/components/Turntable.tsx`
- `client/src/features/shared/components/MiniVinyl.tsx`
- `client/src/features/shared/components/SoundwaveVisualizer.tsx`
- `client/src/features/shared/components/Visualizer.tsx`
- `client/src/pages/ParticipantPage.tsx`, `MusicRoom.tsx`

This is the surface where the app's identity is most visible and where M3 Expressive pays off
most — it is a live, animated, music-playing screen.

Problems:

- **`JoinFlow`** — the access-code entry uses the `premium-code` input (`text-[80px]` in Bebas
  Neue). Bebas is being removed, so this must be rebuilt as an M3 code field with display type
  applied by the caller.
- **`Turntable.tsx` (174 lines) and `MiniVinyl.tsx` (105)** — bespoke SVG discs. `MiniVinyl` is
  the obvious place to use `Cookie12Sided` from issue 04.
- **`SoundwaveVisualizer.tsx` (143) and `Visualizer.tsx`** — ad-hoc bars. `Flower` and `Puffy`
  give this an M3 vocabulary; the M3 Expressive motion physics card in the reference screenshot
  is exactly this kind of waveform treatment.
- **`NowPlayingBar.tsx`** — a transport bar with no M3 role separation; the natural home for a
  mini-player with `surface-container` elevation and shape-morph on play.
- **`RequestFlow.tsx` (159) / `ResultCard.tsx`** — search-and-request flow that should use the
  M3 search bar and list items, matching admin.
- **`LyricsDisplay.tsx`** — text presentation with no type scale.
- **`MusicRoomView.tsx` (206)** — the composition root; currently hardcodes surfaces.
- **`ParticipantPage.tsx` (161) / `MusicRoom.tsx` (80)** — page chrome with hardcoded surfaces.

## Target

- **`JoinFlow`** — M3 text field, `extra-small` top radius, with display type on the value.
  Uses `Burst` or `Cookie12Sided` as the focal shape.
- **`MiniVinyl` / `Turntable`** — reframed on `Cookie12Sided`; the disc keeps its rotation but
  the silhouette comes from the shape library.
- **`SoundwaveVisualizer` / `Visualizer`** — `Flower` and `Puffy` driven by the M3 expressive
  spring. When idle, this becomes the squiggle loading indicator from issue 04.
- **`NowPlayingBar`** — M3 mini-player on `surface-container-high`, icon buttons with
  shape-morph, progress as an M3 linear indicator.
- **`RequestFlow` / `ResultCard`** — M3 search bar + list items, consistent with admin.
- **`LyricsDisplay`** — `body-large` / `title-medium` roles, readable line length.
- **Pages** — M3 surface roles, no hardcoded backgrounds.

## Required Design

- Compose from issue 03 primitives and issue 04 shapes. No new one-offs.
- **Keep the vinyl identity.** This surface is why the app exists; M3 shapes should reinforce
  the record motif, not replace it with generic M3 chrome.
- Motion uses the M3 expressive springs, and respects `prefers-reduced-motion`.
- `ParticipantLayout.tsx`'s `bg-[#fcfcfc]` becomes the `surface` role.
- Loading, empty and error states exist for join, request and now-playing.
- No `orange-500`, no raw hex, no `premium-*`.
- Mobile-first: this is the screen most likely to be used on a phone, so the navigation bar
  from issue 05 must be correct here.

## Tests

No test suite. Verified by:

- `vp run --filter client check`
- `vp run --filter client build`
- Screenshots at 375px and 1440px: join flow, request flow, now-playing with the visualizer
  active, and the idle loading state.

## Done Criteria

- [x] All participant, music-room and shared components use M3 primitives and roles only.
- [x] `JoinFlow` no longer depends on Bebas Neue.
- [x] `MiniVinyl` / `Turntable` use `Cookie12Sided`.
- [x] The visualizer uses `Flower` / `Puffy` with M3 springs, and the squiggle when idle.
- [x] `NowPlayingBar` is an M3 mini-player with shape-morph on play.
- [x] Loading, empty and error states exist.
- [x] `prefers-reduced-motion` honoured.
- [x] Screenshots captured at 375px and 1440px.
- [x] `check` and `build` pass.
