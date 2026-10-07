# CONTEXT — Port playList to Cloudflare Workers

## Problem

The app must run as `playlist.fiinnyy.my.id` on Cloudflare. Today it runs as a
Bun process on `finny-pc` behind a Cloudflare Tunnel. The tunnel already gives
the subdomain for free, but it requires this machine to stay on.

The backend cannot run on Workers as written. Concretely it uses, none of which
exist in the `workerd` runtime:

- `socket.io` server (`Server`, `Socket`) — 24 handlers across 5 files
- `ioredis` over raw TCP — queue lists, playback hash, room keys, sessions, and
  a blocking `XREADGROUP` stream reader
- 6 Redis Lua scripts (255 lines) for atomic queue transitions
- `postgres` (Neon) over raw TCP — 7 `information_schema` migrations,
  `gen_random_uuid`, `TIMESTAMPTZ`
- `Bun.password`, `child_process` + `yt-dlp` (preview audio), `node:fs` (Lua reads)

## Fix

Port to a Worker + Durable Object + D1 app on the Workers **free** plan, keeping
the existing client untouched by implementing the Engine.IO/Socket.IO wire
protocol in the Durable Object.

The single highest-leverage decision: **the client keeps `socket.io-client`.**
We implement enough of the protocol (websocket transport only, EIO=4) that all
94 client call sites and all 24 handler signatures survive. That avoids a
client rewrite and avoids colliding with the in-flight M3 UI work.

## Architecture Now

```
browser ──► Cloudflare Worker (playlist.fiinnyy.my.id)
              ├── /assets/*        static (Workers assets)
              ├── /socket.io/*     ──► RoomDO (idFromName(roomId))
              │                        ├── WebSocket Hibernation API
              │                        ├── EIO4 + Socket.IO packet layer
              │                        └── DO SQLite: songs, queue, playback
              └── auth / rooms     ──► D1 (admins, sessions, rooms)
```

State placement:

| State | Was | Becomes | Why |
|---|---|---|---|
| Queue (pending/approved/done), now-playing, playback | Redis + Lua | DO SQLite per room | Atomic, single-writer, hibernation-safe |
| Admins, sessions, rooms | Postgres | D1 | Global, queried across rooms |
| Room→passkey lookup | Redis + rooms table | D1 (`rooms.passkey` indexed) | Global lookup |
| Admin session tokens | Redis `SETEX` | D1 `sessions` | KV is eventually consistent — unusable for auth |
| Search cache / rate limits | In-memory Maps | DO in-memory | Per-room, reset is acceptable |
| `yt-dlp` preview | child process | **removed** | Impossible on Workers |
| `yt-search` | HTML scrape | YouTube Data API v3 | Workers-compatible |

## Key Files

**New (Worker app):**
- `worker/index.ts` — Worker entry, asset serving, `/socket.io` upgrade routing
- `worker/room-do.ts` — Durable Object: WS hibernation, protocol, queue SQL
- `worker/socketio/protocol.ts` — EIO4 + Socket.IO packet encode/decode
- `worker/socketio/socket.ts` — `Socket`-shaped adapter (`on`/`emit`/`join`/`id`)
- `worker/socketio/server.ts` — `Server`-shaped adapter (`io.to(room).emit`)
- `worker/handlers/*.ts` — the 5 ported handler modules
- `worker/db/d1.ts` — D1 client + typed queries
- `worker/db/schema.sql` + `worker/db/seed.ts` — D1 schema, admin bootstrap
- `wrangler.jsonc` — DO + D1 + assets bindings, route

**Ported (signatures preserved):**
- `server/src/socket/{connection,auth,participant,admin,eo}Handler.ts`
- `server/src/services/liveQueue/index.ts`
- `server/src/state/roomManager.ts`

**Client (one line):**
- `client/src/shared/lib/socket.ts` — pin `transports: ['websocket']`

## Important Behavior Changes

- **Preview audio is removed.** `yt-dlp` cannot run on Workers. The admin
  speaker-routing feature (`PreviewAudioPlayer`, `/api/preview/:id`) goes away.
- **Search moves to the YouTube Data API v3** (free quota ~100 searches/day).
  The `yt-search` scrape is replaced; result shape is kept identical so
  `SongSearch`/`ResultCard` do not change.
- **Passkeys become global-unique** (D1 unique index) rather than per-room.
- Deploy is `wrangler deploy`; no machine, no tunnel, no Redis, no Neon.

## Tests

Existing suites (`tests/*.test.ts`) target the Bun server and Redis and will not
run against the Worker. Per contract, tests are not run unless asked. Verification
is: `wrangler deploy --dry-run`, `tsc --noEmit`, and a live check of the
handshake + one event round-trip.

## Validation Done

- `client` production build passes; `server` `tsc --noEmit` passes (pre-port).
- Tunnel path verified live on the runner: SPA 200, `/socket.io` polling 200,
  admins seeded in Neon (admin1–3).
- Public hostname currently returns 522 (routing config, not code).

## Known Notes

- **A second thread is actively editing the client** (M3 redesign:
  `client/src/styles/*`, `shared/motion/*`, `shared/shapes/*`,
  `shared/components/*`, `docs/plans/2026-10-06-m3-expressive-ui/`). This plan
  deliberately touches **one** client line (`socket.ts`) to stay clear of it.
- One DO per room is idiomatic and keeps rooms independent; a single global DO
  was rejected as it serialises every room's traffic through one object.
- WebSocket Hibernation is used so idle rooms cost no duration.
- `wrangler` OAuth token on this machine is expired and lacks DNS/Tunnel edit
  scope, so the Worker's custom domain must be set in the dashboard (or with a
  token that has `Workers Routes:Edit`).
