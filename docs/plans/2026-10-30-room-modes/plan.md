# Room modes: listening party

> **Status:** complete, verified 2026-10-30

- **Goal:** a room can run as a listening party, where requests join the queue
  immediately instead of waiting for admin approval.
- **Architecture:** one `rooms.mode` column, read on join and on submission.
- **Tech Stack:** Bun + Socket.IO + Neon Postgres + Redis (existing), React 19 +
  TanStack Router + Tailwind (existing).

## Must Not Forget

- Existing rooms must keep approval behavior; the migration default is
  `approval`.
- The mode check on `submit_song` is server-side and authoritative. Never trust a
  client flag.
- Do not remove the pending queue code; approval rooms still need it.
- Reuse existing primitives (`Modal`, `TextField`, `Button`, `Card`). No new UI
  library, no inline styles.
- Do not run unit/smoke/e2e tests unless asked. Typecheck and build are allowed.
- Do not restart or deploy the live `playlist-app.service`; verify on an isolated
  local stack.

## Issue Index

### High

- [01 — Store and expose the room mode](issues/01-high-room-mode-storage.md)
- [02 — Auto-approve submissions in party rooms](issues/02-high-party-auto-approve.md)

### Medium

- [03 — Client: choose, show, and honor the mode](issues/03-medium-client-mode-ui.md)

## Target Architecture

```diagram
create_station { mode } -> rooms.mode
join_room -> { success, mode }
submit_song -> getRoomMode(roomId)
                |- approval -> pending + new_pending_song
                '- party    -> approved + song_approved + queue_updated
```

## Priority Order

1. 01 storage and join payload
2. 02 submission branch
3. 03 client

## Validation Commands

```bash
bun run check                 # client tsc + server tsc + lint + format
bun run build                 # client production build
```

Isolated live run (no production data):

```bash
podman run -d --name playlist-verify-db -p 5544:5432 \
  -e POSTGRES_USER=playlist -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=playlist \
  docker.io/library/postgres:16-alpine
podman run -d --name playlist-verify-redis -p 6380:6379 \
  docker.io/library/redis:7-alpine
DATABASE_URL=postgresql://playlist:verify@localhost:5544/playlist \
REDIS_URL=redis://localhost:6380 PORT=3099 \
ADMIN_INVITE_CODE=PLAYLIST bun server/index.ts
```

Then: log in as `admin1` / `12345678`, create a party station, submit a track as
a participant, and confirm it appears in the approved queue with no pending item.

## Rollout Plan

- [x] 01 — `rooms.mode`, `getRoomMode`, join payload, create/get station
- [x] 02 — `submit_song` auto-approve branch
- [x] 03 — creation dialog, station card label, dashboard tabs, toast
- [x] typecheck + build
- [x] isolated live run with screenshots
- [x] clean up temporary containers and test data

## Done Criteria

- [x] Existing rooms behave as before (approval).
- [x] A party room adds submissions straight to the approved queue.
- [x] Admin dashboard for a party room has no Review queue tab.
- [x] Station creation records the chosen mode and the hub shows it.
- [x] `bun run check` and `bun run build` pass.
- [x] Rendered UI inspected in screenshots.
