# 05 — Port the five handler modules

**Severity:** high

## Current Problem

Five modules are written against `socket.io`'s `Server`/`Socket`, `sql`
(Postgres), `redis`, `roomManager`, and `node:fs`:

- `server/src/socket/connectionHandler.ts` — `join_room`, `get_now_playing`,
  `get_queue_page`, `join_by_passkey`, `disconnect`
- `server/src/socket/authHandler.ts` — 7 admin auth events
- `server/src/socket/participantHandler.ts` — `search_songs`,
  `get_search_suggestions`, `submit_song`
- `server/src/socket/adminHandler.ts` — `approve_song`, `delete_song`,
  `edit_song`, `clear_queue`, `admin_add_song`, `create_station`,
  `get_my_stations`
- `server/src/socket/eoHandler.ts` — `eo_track_ended`, `sync_playback`,
  `previous_track`, `toggle_playback`

## Target

Move them to `worker/handlers/*.ts` and repoint their dependencies at the
adapters from issue 02 and the D1/DO layers from issues 03–04. The handler bodies
should be near-identical: same event names, same payload shapes, same callback
responses.

Dependency swap:

| Import today | Becomes |
|---|---|
| `import { Server, Socket } from "socket.io"` | `import type { ServerLike, SocketLike } from "../socketio/types"` |
| `sql` from `../db/client` | `d1` helpers from `../db/d1` |
| `redisCache` / `redis` | D1 `sessions` / DO `meta` |
| `roomManager` | DO fields |
| `liveQueue/*` | DO methods |
| `node:fs` (Lua reads) | removed |

`connectionHandler.join_room` is the critical path and must preserve:

- passkey validation for `participant` → `{ success: false, code: "WRONG_PASSKEY" }`
- admin token check via `sessions` → `room_key_info` emitted to that socket only
- auto-ownership when `rooms.owner_id` is null
- EO registration exclusivity → `error` + `disconnect()` when already controlled
- the initial `now_playing_updated` / `playback_sync` / `queue_updated` burst

## Required Design

- Keep every event name and callback field identical — the client is unchanged.
- `join_room` needs the room's D1 row (owner/passkey) plus the DO's live state;
  resolve D1 first, then hand off to the DO.
- Preserve role rooms `${roomId}:admin`, `:participant`, `:eo` exactly, since
  `adminHandler` and `eoHandler` broadcast to them.
- `disconnect` must clear the DO's `eo_socket` if this socket owned it.
- No `any` to dodge types; type the DO and D1 return values.

## Tests

Not run by default. Verify by hand: participant joins with the right and wrong
passkey; admin joins and receives `room_key_info`; a second `eo` is rejected.

## Done Criteria

- [ ] All 24 events are registered and reachable
- [ ] `join_room` works for participant, admin, and eo, including error paths
- [ ] `approve_song` / `delete_song` / `clear_queue` broadcast to all clients
- [ ] `eo_track_ended` / `previous_track` / `toggle_playback` / `sync_playback` work
- [ ] No `socket.io`, `postgres`, `ioredis`, or `node:fs` import remains
