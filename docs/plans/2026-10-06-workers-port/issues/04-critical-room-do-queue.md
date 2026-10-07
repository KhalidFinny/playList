# 04 — Room Durable Object: queue state replacing Redis + Lua

**Severity:** critical

## Current Problem

The live queue is Redis lists (`room:<id>:queue:pending|approved|done`), a
`nowPlaying` key, per-song JSON hashes, a version counter, and a playback hash —
with 6 Lua scripts (255 lines) providing atomic `approve`, `delete`,
`previous`, `transition`, `update`, and `clear`. `roomManager` keeps
`playbackControllerSocketId`, `nowPlaying`, `nextTrack`, `isPlaying`, `passkey`,
and `queue` in process memory. Neither exists on Workers.

## Target

One Durable Object per room holds the WebSockets, the protocol layer, and the
queue in DO SQLite. A DO is single-threaded, so the Lua scripts' atomicity comes
free from sequential execution — no scripting needed.

`worker/room-do.ts` SQLite schema:

```sql
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  status TEXT NOT NULL,          -- pending | approved | playing | done
  submitted_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  approved_at INTEGER,
  done_at INTEGER,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS songs_queue_idx ON songs(status, position);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);  -- nowPlaying, isPlaying, playback {currentTime,duration,updatedAt}, passkey
```

Map each service function to one DO method, preserving its return shape:

| `liveQueue` function | DO implementation |
|---|---|
| `submitSong` | INSERT status `pending`, append `position` |
| `addApprovedSong` | INSERT status `approved` |
| `approveSong` | UPDATE `pending`→`approved` (guarded by current status) |
| `deleteSong` | DELETE; also clear `meta.nowPlaying` if it was playing |
| `updateSongTitle` | UPDATE `title` |
| `transitionToNextTrack` | `playing`→`done`, next `approved`→`playing`, in one transaction |
| `previousTrack` | reverse: `done`→`approved`, `playing`→`approved`/`pending` |
| `clearQueue` | DELETE pending+approved |
| `getQueueWindow` / `getQueuePage` / `getNowPlaying` / `countPendingSongs` | SELECT |

- Idempotency: `transitionToNextTrack(idempotencyKey)` must be replay-safe. Keep
  a `transition_id` marker in `meta` (or a small table) so a retried
  `eo_track_ended` does not advance twice.
- `roomManager`'s playback-controller ownership becomes a DO field
  (`meta.eo_socket`) set on `eo` join and cleared on socket close.
- In-memory search cache and the spam/rate-limit Maps move into the DO instance
  (resetting on eviction is acceptable).

## Required Design

- All queue mutations happen inside the DO — never from the Worker directly.
- `blockConcurrencyWhile()` only for schema creation, not for reads/writes.
- Keep `status` transitions guarded so a double-approve cannot duplicate.
- Broadcast after commit: mutate, then `io.to(room).emit(...)`.
- `songs`/`meta` live only in the DO; do not mirror to D1 (avoids double writes).
- Drop the `db-events` Redis Stream + `db_event_log` idempotency layer — the DO
  is the single writer, so the durability workaround is no longer needed.

## Tests

Not run by default. Verify by hand: submit → appears pending; approve → appears
approved; transition → becomes `done`, next becomes `playing`; delete playing →
`nowPlaying` null; clear → queue empty.

## Done Criteria

- [ ] Submit/approve/delete/edit/clear/transition/previous all work in the DO
- [ ] `getQueueWindow` returns the same shape the client expects
- [ ] Transition is idempotent under a repeated `idempotencyKey`
- [ ] No Redis, no Lua, no `db-events` stream remains
