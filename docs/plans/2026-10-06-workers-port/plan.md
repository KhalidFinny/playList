# Plan — Port playList to Cloudflare Workers

> **Status:** ⏸️ **Preview blocker resolved — port still large.** 2026-10-06.
>
> **Free-tier question is answered: it fits.** Measured, not assumed — see
> [issue 08](issues/08-critical-free-tier-requirements.md) and
> `docs/plans/2026-10-08-o11y-load-test/ANALYSIS.md`. ~10,400 DO requests/day at
> 50 connections against a 100,000/day allowance. **Two hard requirements fall
> out of it**: the DO must use the Hibernation API (duration, not requests, is
> what breaks a room), and the heartbeat should be served by
> `setWebSocketAutoResponse`.
>
> The original blocker was `yt-dlp` preview audio + speaker routing (`setSinkId`).
> That is now solved **without yt-dlp**: `server/src/services/preview/` resolves
> audio through a single innertube HTTP call and streams it same-origin, so the
> feature is pure `fetch` and portable to Workers. Verified live.
>
> What remains for a Workers port is the rest of the stack, and it is not small:
> **Socket.IO** (24 handlers), **Redis** (`ioredis` + 6 Lua scripts), **Postgres**
> (Neon), and `Bun.password`. Issue 06 shrinks to the search swap only.
>
> **The app is already served by Cloudflare** — the `PlayList` tunnel fronts
> `playlist.fiinnyy.my.id` with every feature intact and verified. Execute this
> plan only if removing the machine dependency is worth the port.

## Goal

Serve `playlist.fiinnyy.my.id` from Cloudflare Workers on the free plan, with no
dependency on `finny-pc`.

## Architecture

Worker (assets + `/socket.io` routing) → one Durable Object per room (WebSocket
Hibernation, Socket.IO wire protocol, queue in DO SQLite) → D1 for admins,
sessions, and rooms.

## Tech Stack

Cloudflare Workers + Durable Objects (SQLite backend) + D1 + Workers assets;
Wrangler for dev/deploy; client stays on `socket.io-client`.

## Must Not Forget

- **Free tier only.** No KV for auth (eventual consistency breaks sessions). No
  paid DO storage backend — SQLite-backed DO only. Rows written stay under
  100k/day; use DO SQLite for the hot queue path, D1 only for global rows.
- **Do not rewrite the client.** Only `client/src/shared/lib/socket.ts` may
  change (`transports: ['websocket']`). A second thread is editing
  `client/src/styles`, `shared/motion`, `shared/shapes`, `shared/components`.
- **Preserve handler signatures.** `socket.on(event, (data, callback) => ...)`
  and `io.to(roomId).emit(...)` must keep working so the 24 handlers port with
  minimal edits.
- **Password is `12345678`** for `admin1` (super_admin), `admin2`, `admin3`.
- **Preview audio is out of scope** — `yt-dlp` cannot run on Workers.
- Tests are not run unless asked. Verify with `--dry-run` deploy, `tsc`, and a
  live handshake.
- Do not commit or deploy without an explicit command.

## Issue Index

**Critical**
1. [01-critical-worker-scaffold](issues/01-critical-worker-scaffold.md) — Worker, assets, DO + D1 bindings, `wrangler.jsonc`
2. [02-critical-socketio-protocol](issues/02-critical-socketio-protocol.md) — EIO4/Socket.IO wire protocol + `Socket`/`Server` adapters
3. [03-critical-d1-schema-auth](issues/03-critical-d1-schema-auth.md) — D1 schema, WebCrypto hashing, admin seed, sessions
4. [04-critical-room-do-queue](issues/04-critical-room-do-queue.md) — per-room DO: queue SQL replacing Redis + 6 Lua scripts

**High**
5. [05-high-handler-port](issues/05-high-handler-port.md) — port the 5 handler modules onto the adapters
6. [06-high-search-and-preview](issues/06-high-search-and-preview.md) — YouTube Data API search; drop preview

**Medium**
7. [07-medium-deploy-and-route](issues/07-medium-deploy-and-route.md) — deploy, custom domain, verify live

## Target Architecture

```
playlist.fiinnyy.my.id
  └─ Worker (worker/index.ts)
       ├─ ASSETS            → client/dist (SPA fallback)
       ├─ /socket.io        → RoomDO(idFromName(roomId))
       │                       EIO4 + Socket.IO packets over WebSocket
       │                       SQLite: songs, queue_pos, playback, meta
       └─ DB (D1)           → admins, sessions, rooms
```

## Priority Order

1 → 2 → 3 → 4 → 5 → 6 → 7

## Validation Commands

```bash
bun install
bunx wrangler d1 migrations apply playlist-db --local
bunx wrangler dev                 # local Worker
bunx wrangler deploy --dry-run    # bundle check
bunx tsc --noEmit -p worker/tsconfig.json
bun run build                     # client assets
```

Live proof: WebSocket `101` on `/socket.io/?EIO=4&transport=websocket`,
`join_room` ack, `admin_login` as `admin1` / `12345678`, and one
`submit_song` → `queue_updated` round-trip.

## Rollout Plan

- [ ] Phase 1 — Worker skeleton serving the existing client, deployable empty
- [ ] Phase 2 — Protocol layer; client connects and `join_room` acks
- [ ] Phase 3 — D1 schema, seed admin1–3, `admin_login` works
- [ ] Phase 4 — Room DO queue; submit/approve/delete/transition round-trip
- [ ] Phase 5 — Port remaining handlers; search via YouTube API
- [ ] Phase 6 — Deploy and route `playlist.fiinnyy.my.id`
- [ ] Phase 7 — Keep the tunnel as fallback until the Worker is proven

## Done Criteria

- [ ] `playlist.fiinnyy.my.id` serves the app from Workers with no tunnel running
- [ ] `admin1` / `admin2` / `admin3` log in with `12345678`
- [ ] A participant joins by passkey and submits a song
- [ ] An admin approves it; all clients see `queue_updated`
- [ ] Playback sync + next/previous transition work
- [ ] Free-tier limits are not exceeded (DO requests, D1 rows written)
