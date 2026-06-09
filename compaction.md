# Compaction — 2026-05-16

## Summary

Massive polish pass across the remaining rough edges of PlayMusic:

### 1. Admin Music Room — Working Timeline & Progress Bar
The admin's `MusicRoomView` now shows real `currentTime` / `duration` alongside a live progress bar, same as the participant side. Previously the admin only got a dead visual. The `PlaybackController` now polls the active YouTube player every second for timing, and passes it through to `TrackMetadata`.

### 2. Playback Sync Fix (Needle + Play/Pause for Participants)
**Root cause:** The old sync interval in `useAdminDashboard` hardcoded `isPlaying: true` — every 1s tick overwrote any pause signal the admin sent. The sync interval is now in `PlaybackController`, where it reads `ref.getPlayerState() === 1` for the **true** YouTube player state. Participants now see play/pause properly synced.

Also fixed `onPlayerEnd` in `useAdminDashboard` — it was using stale closures for `upNext` / `activePlayer`. Replaced with refs.

### 3. Needle Position on Vinyl
Iterated through multiple passes; final state:
- Pivot moved inward (`right-[30%]`) so the arm has swing room
- Playing angle **`-20°`** (counter-clockwise → swings left onto the groove area)
- Idle angle **`+10°`** (clockwise → parks right, off the record)
- Arm length `clamp(150px, 26vw, 300px)` — compact but reaches
- Container `top-[8%] right-[8%] w-[55%]` — naturally anchored

### 4. Removed "Currently Playing" Duplication
`MusicRoomView` had a redundant block showing `Currently Playing: {title}` and author — removed. `TrackMetadata` already covers this information.

### 5. Preview Audio — Separate Speaker Routing
**Key behavior:** The main broadcast keeps playing while preview runs. No muting.

- Server adds `/api/preview/:videoId` endpoint using `yt-dlp` (`server/bin/yt-dlp`) to extract the direct audio stream URL
- `PreviewAudioPlayer` component fetches the URL, creates an `<audio>` element with `setSinkId()` to route audio to a different speaker
- Admin dashboard includes a **speaker selector dropdown** in the Review tab — enumerates all audio output devices via `navigator.mediaDevices.enumerateDevices()`
- Selection persists in localStorage
- Falls back to YouTube iframe if `setSinkId()` not supported or default device selected

**Files touched:**
- `server/index.ts` — added HTTP server + `/api/preview/:videoId` route
- `server/bin/yt-dlp` — added yt-dlp binary
- `client/.../PreviewAudioPlayer.tsx` (new) — audio routing component
- `client/.../useAudioOutput.ts` (new) — device enumeration hook
- `client/.../ModerationQueue.tsx` — preview button always visible, dedicated Preview button in actions, device selector UI
- `client/.../PlaybackController.tsx` — removed mute-during-preview logic (main broadcast keeps playing)
- `client/.../AdminDashboardPage.tsx` — wired `onPreviewChange` callback
- `client/.../admin/types.ts` — updated props

### 6. Participant Alert on Tab Navigation
`useParticipantPage` now calls `clearStatusMsg()` when switching to the request tab, preventing stale alerts from popping up on navigation.

---

## Next To-Dos

- [ ] **Mobile responsive design** — plan saved at `docs/mobile-responsive-plan.md`. Start with participant music room (most common mobile use case).
- [ ] **Needle position still needs visual confirmation** — the math looks right but needs a screenshot verify
- [ ] **Preview audio routing** — test with actual multi-speaker setup to confirm `setSinkId()` works end-to-end
- [ ] **yt-dlp binary** — needs to be present in production deployment (Dockerfile or CI step)
- [ ] **Add server-side caching for stream URLs** — already implemented (5-min TTL), but verify it works under load

---

## Still Needs Fixing

- **Needle visual** — last geometry pass is the best so far (`-20°` playing / `+10°` idle, `150–300px` arm), but the user hasn't confirmed the final screenshot yet. The arm now swings LEFT toward grooves which is correct direction. May need fine angle tuning of ±2–3 degrees after visual check.
- **`yt-dlp` binary path** — currently hardcoded as `./bin/yt-dlp` relative to server cwd. Should be configurable via env var (`YT_DLP_PATH` already supported).
- **Turntable progress ring** — is functional but the circular SVG progress arcs might need performance optimization for very large viewports.
- **Admin `onPlayerEnd`** — refs fix applied but the dual-player A/B switching logic could benefit from a more robust state machine in the future.
- **Edge case:** What happens when the admin's selected preview device is disconnected? Need graceful fallback. Currently falls back to YouTube iframe.
