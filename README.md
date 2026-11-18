# playList

A shared listening room for a group of people in the same place or on a call. One person hosts a station, everyone else joins with a five digit code, and the room sees the same track at the same position while requests queue up for approval or play straight away.

It is built for small gatherings: a cafe, a classroom, an office, or a listening party where people want to pick the music without passing a laptop around.

## How it works

1. An admin signs in and creates a station. The station has a name, a mode (`approval` or `party`), and a five digit room code.
2. Participants open the app, enter the code, and land in the room. No account is needed.
3. Participants search YouTube and submit song requests.
4. In an `approval` station, requests wait in a moderation queue. The admin approves or rejects them, and only approved songs reach the queue.
5. In a `party` station, requests are approved as they arrive, so nobody has to moderate.
6. The admin's browser is the audio host. It plays a direct audio stream for the current track (resolved by the server) and broadcasts playback state to the room, so every participant's screen shows the same track and position.
7. A participant can turn on headset mode to listen on their own device instead of relying on the room's speakers.

## Features

- Five digit room codes, generated with the platform CSPRNG and checked for uniqueness (`server/src/lib/passkey.ts`).
- Admin accounts with invite code registration and login; registration is closed when `ADMIN_INVITE_CODE` is unset.
- Two room modes, `approval` and `party`, stored per room and read on every join.
- YouTube search and request submission, with per-IP, per-socket, and per-room rate limits plus duplicate and pending caps.
- Moderation queue with approve, reject, clear, and title edit actions.
- Playback control on the host: play, pause, seek, next, previous, with state synced to every client.
- Headset mode and audio output device selection, so a participant can listen locally.
- Queue state in Redis, mutated through Lua scripts so transitions are atomic.
- Postgres persistence for rooms, accounts, and song history, with a background writer and a maintenance worker.
- Weekly most played chart served from `GET /api/top-tracks`.
- Same-origin audio preview proxy (`/api/preview/:id`) that works around the IP lock and missing CORS headers on YouTube's stream URLs.
- Token gated metrics endpoint (`/api/metrics`), disabled when `METRICS_TOKEN` is unset.
- Material 3 Expressive design tokens on Tailwind CSS v4, with light and dark schemes.

## Stack

| Layer | What it uses |
| --- | --- |
| Client | React 19, TypeScript, Vite (vite-plus), TanStack Router (file based routes), Zustand, XState, Framer Motion, socket.io client |
| Styling | Tailwind CSS v4 with a Material 3 Expressive token layer (`client/src/styles/tokens.css`) |
| Server | Bun, socket.io, Postgres (Neon in production), Redis with Lua scripts |
| Tooling | Bun workspaces, vite-plus for dev, build, lint, and format, Vitest for tests |
| Deploy | systemd user units plus a Cloudflare Tunnel (`deploy/`), and a partial Cloudflare Workers port (`worker/`) |

## Getting started

Requirements: Bun 1.3 or newer, Docker (for Redis), and a Postgres database.

```bash
# 1. Install workspace dependencies
bun install

# 2. Create your environment file and fill it in
cp .env.example .env

# 3. Start the local containers
bun run infra
# or, if you prefer compose directly:
docker compose up -d

# 4. Run the client and server together
bun run dev
```

`bun run infra` runs `docker start` for the `playmusic_db` and `playmusic_redis` containers, so both must already exist. `docker-compose.yml` defines Redis, the server, and the client; the Postgres service in it is commented out, so `DATABASE_URL` must point at a Postgres instance you provide (Neon in production).

Environment keys in `.env.example`:

- `DATABASE_URL`: Postgres connection string. The server exits at boot if it is missing.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: used by the compose file.
- `REDIS_URL` and `REDIS_PASSWORD`: Redis connection and auth. The queue state lives here.
- `ADMIN_INVITE_CODE`: required to register an admin account.
- `PORT`: Bun server port, default `3001`.
- `ALLOWED_ORIGINS`: comma separated Socket.IO origins.

Ports in local development:

- Client dev server: `http://localhost:5173` (Vite default), which proxies `/api` and `/socket.io` to the server.
- Bun server: `http://localhost:3001` (`PORT`), serving the built SPA, Socket.IO, and the preview API.

Build and run the production shape:

```bash
bun run build   # type-checks and builds the client into client/dist
bun run start   # Bun server on PORT, serving client/dist and Socket.IO
```

Other scripts:

```bash
bun run dev:client   # client only
bun run dev:server   # server only, with watch
bun run check        # client tsc + lint/format, server tsc
bun run test         # Vitest; needs Redis running
```

## Project structure

```
client/   React SPA: routes, feature modules, Zustand stores, XState machines, M3 tokens
server/   Bun server: HTTP + preview API, socket handlers, Redis queue, Postgres persistence
worker/   Partial Cloudflare Workers port: one Durable Object hub, preview proxy, asset serving
deploy/   systemd user units for the app, Redis, and a Cloudflare Tunnel, plus a setup guide
tests/    Vitest unit and end to end tests, and a socket load script
docs/     Design and plan folders for past work, plus the mobile responsive plan
```

Inside `server/src`, the code is split into `socket/` (connection, auth, participant, admin, and playback controller events), `services/` (live queue, rooms, preview, top tracks), `db/`, `lib/`, and `workers/`.

## Self-hosting

`deploy/` contains three systemd user units and a tunnel environment example:

- `playlist-redis.service` runs Redis 7 in podman with a persistent volume.
- `playlist-app.service` runs `bun server/index.ts` from the repo root, with `.env` as its environment file. It serves `client/dist`, so run `bun run build` before starting or restarting it.
- `playlist-tunnel.service` runs `cloudflared tunnel run` with a token from `~/.cloudflared/playlist-tunnel.env`, which is copied from `playlist-tunnel.env.example`.

The public hostname is routed to the tunnel and to `http://localhost:3001`. `deploy/README.md` has the full sequence: build the client, create `.env`, create the tunnel token, route DNS, set the ingress rule, install the units, then enable them.

A Cloudflare Workers port exists under `worker/` with `wrangler.jsonc` (one `RoomHub` Durable Object, the preview stream proxy, and static assets from `client/dist`). It is incomplete: the production backend described in `deploy/README.md` runs on a normal host because it needs Socket.IO, Redis, Postgres, and `Bun.password`, none of which exist in the Workers runtime. Treat `worker/` as work in progress.

## Contributing

1. Fork the repository and create a branch for your change.
2. Keep `bun run check` green. It runs the client type check plus lint and format, then the server type check.
3. Keep `bun run build` passing.
4. Use semantic commit messages: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
5. Open a pull request that describes the change and how you verified it.

`bun run test` starts the Redis container with `docker compose up -d redis` and then runs Vitest against `tests/`. It reads `.env`, so the file needs to exist before the suite runs.

## License

MIT. See [LICENSE](LICENSE).
