# 02 — Auto-approve submissions in party rooms

**Severity:** high

## Current Problem

`submit_song` always calls `submitSong`, which pushes to the pending list and
emits `new_pending_song` to the admin. In a listening party that is an approval
step nobody is there to take.

## Target

After the existing spam checks, `submit_song` reads `getRoomMode(roomId)`:

- `approval`: unchanged.
- `party`: `addApprovedSong(...)`, emit `song_approved` to the admin,
  participant, and EO role rooms, emit an authoritative `queue_updated` snapshot
  to the room, and reply `{ success: true, message: "Added to the queue" }`.

## Required Design

- The mode check is server-side; the client sends no flag.
- Reuse the existing `addApprovedSong` and the emission pattern from
  `admin_add_song`.
- Spam limits (per IP, per connection, duplicate, room flood) stay in force.

## Tests

No automated test. Verified by the isolated run: a participant submission appears
in the approved queue and the admin receives no pending item.

## Done Criteria

- [x] Party submissions skip `pending`.
- [x] Admin and participants receive the new track live.
- [x] Approval rooms are unchanged.
