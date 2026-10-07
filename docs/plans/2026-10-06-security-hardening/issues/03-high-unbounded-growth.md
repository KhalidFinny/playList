# 03 — Bound queue history and the event log

**Severity:** high

## Current Problem

Nothing is ever pruned:

- `rebuildRoomQueue` selects **every** song for the room, including all `done`
  rows, and pushes them all into the Redis `done` list.
- `transition.lua` `LPUSH`es to `doneKey` with no `LTRIM`.
- The `songs` table keeps every row forever, including old `done` ones.
- `db_event_log` grows one row per queue mutation, forever.

Live snapshot at audit time: 7 songs / 14 event rows / 7.6 MB. Small now, but the
Neon free tier is 5 GB and the growth is unbounded.

## Target

- `transition.lua`: `LTRIM doneKey 0 (DONE_HISTORY_MAX - 1)` after the push.
- `rebuildRoomQueue`: load pending/approved/playing as before, but only the most
  recent `DONE_HISTORY_MAX` done rows (separate query with `LIMIT`).
- New `workers/maintenance.ts` + `startMaintenance()` called from `index.ts`:
  hourly, delete `db_event_log` rows older than 7 days and `done` songs older
  than 30 days.

## Required Design

- `DONE_HISTORY_MAX = 50` — previous-track only needs a short history.
- Pruning `songs` must not touch non-`done` rows.
- Use `make_interval(days => $n)` rather than an interpolated `INTERVAL` literal.
- Maintenance is fire-and-forget with errors logged, never thrown — a failed
  prune must not take down the process.
- The maintenance interval is `unref()`'d, matching the existing cleanup timers.
- Deleting an old `done` song leaves its Redis `song:` key until that room is
  rebuilt; harmless (the row no longer exists to update).

## Tests

Not run. Verify: the rebuild query returns at most 50 done items; a `done` song
older than the retention window is removed by a manual maintenance run.

## Done Criteria

- [ ] `transition.lua` trims the done list
- [ ] `rebuildRoomQueue` caps done rows
- [ ] Maintenance prunes `db_event_log` and old `done` songs
- [ ] Maintenance runs from `index.ts` and never throws on failure
