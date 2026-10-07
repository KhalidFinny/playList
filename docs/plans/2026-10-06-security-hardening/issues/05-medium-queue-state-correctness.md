# 05 — Queue state correctness

**Severity:** medium

## Current Problem

Four small defects found during the audit:

1. **`clear_queue` leaves the playing song `playing`.** `clear_queue.lua` deletes
   the Redis `nowPlaying` key, but the Postgres `queue_cleared` handler only
   updates rows `WHERE status IN ('pending','approved')`. The playing row stays
   `playing` forever, so a later `rebuildRoomQueue` resurrects it as now-playing.
2. **`delete_song` does not clear the in-memory now-playing.** `adminHandler`
   emits `now_playing_updated: null` when the deleted song was playing, but never
   calls `roomManager.setNowPlaying(roomId, null)`, so `get_now_playing` keeps
   returning the deleted song until a restart.
3. **Suggestions are fetched over plain `http://`.** `get_search_suggestions`
   calls `http://suggestqueries.google.com/...`, sending the query unencrypted.
4. **`join_room`'s admin room-creation `INSERT` has no `ON CONFLICT`.** Two
   sockets racing to auto-create the same room id make the second one throw.

## Target

- `dbEventHandlers.ts` `queue_cleared`: include `'playing'` in the status set.
- `adminHandler.ts` `delete_song`: clear `roomManager.setNowPlaying(roomId, null)`
  when the deleted song was the playing one.
- `participantHandler.ts`: use `https://` for suggestions.
- `connectionHandler.ts`: `INSERT ... ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
  RETURNING id, passkey, owner_id` so a racing create returns the existing row
  instead of throwing.

## Required Design

- The `ON CONFLICT DO UPDATE SET id = EXCLUDED.id` form is a deliberate no-op that
  makes `RETURNING` yield the existing row.
- `delete_song` must still emit `now_playing_updated` exactly as before.
- Changing `clear_queue` to mark `playing` as `done` must not affect
  `previous_track` semantics for the songs that are still in the Redis done list.

## Tests

Not run. Verify: after `clear_queue` the playing song is `done` in Postgres;
after deleting the playing song `get_now_playing` returns null.

## Done Criteria

- [ ] `queue_cleared` marks `playing` songs `done`
- [ ] `delete_song` clears in-memory now-playing
- [ ] Suggestions use `https://`
- [ ] Room creation is race-safe
