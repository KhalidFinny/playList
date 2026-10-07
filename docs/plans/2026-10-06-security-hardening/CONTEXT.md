# CONTEXT — security & resource hardening

## Problem

A bug audit of the live server found six classes of defect. All are server-side
except one (the invite-code field).

1. **Room passkeys are predictable.** `Math.random()` generates the 5-digit code
   in `connectionHandler.ts` and `adminHandler.ts`. `join_by_passkey` has no rate
   limit; measured ~93 ms per attempt, so the 90k space falls in ~2h from one
   socket and minutes across parallel sockets. Knowing a passkey is the only
   credential a participant needs.
2. **`ADMIN_INVITE_CODE` is never enforced.** `admin_register` only checks the
   `@playit.com` suffix. The code is printed at boot and then unused. There is no
   rate limit on `admin_register` or `admin_login` either.
3. **Unbounded growth.** `rebuildRoomQueue` loads *every* song for a room,
   including all `done` history; the Redis `done` list, the `songs` table, and
   `db_event_log` are never pruned. Matters on Neon's free 5 GB tier.
4. **In-memory maps leak.** The seven spam-protection maps in
   `participantHandler.ts` are never pruned; only the two search caches are.
5. **`userId` is client-supplied** (localStorage) and is the key for every spam
   and rate check, so all of them are bypassable by rotating it.
6. **Minor correctness.** `clear_queue` leaves the playing song `playing` in
   Postgres while deleting the Redis `nowPlaying`; `delete_song` does not clear
   `roomManager.nowPlaying`; suggestions are fetched over plain `http://`;
   `join_room`'s admin room-creation `INSERT` has no `ON CONFLICT`.

## Fix

Introduce two small shared primitives and use them everywhere a limit is needed,
so limits are server-keyed and self-pruning:

- `lib/rateLimit.ts` — fixed-window `RateLimiter` with `deleteExpired()`, matching
  the existing `TtlLruCache` shape in `socket/searchCache.ts`.
- `lib/clientIp.ts` — resolve the caller's IP from `cf-connecting-ip` (the server
  sits behind a Cloudflare Tunnel, so the socket address is always localhost).

Then: crypto passkeys with a uniqueness check and a DB unique index; per-IP
limits on the unauthenticated auth + passkey surfaces; retention caps on the
queue and event log; server-derived actor keys for enforcement; and the four
small correctness fixes.

## Architecture Now

```
socket connect
  └─ actorId (server-assigned) + clientIp (cf-connecting-ip)
       ├─ join_by_passkey   → RateLimiter per IP + per socket
       ├─ admin_login       → RateLimiter per IP
       ├─ admin_register    → invite code + RateLimiter per IP
       └─ submit_song       → actor cooldown / duplicate / soft-ban
                            → per-IP limit + per-room flood + queue caps

startup ─ startDbPersistenceWorker()   (existing)
        └ startMaintenance()           (new: prune db_event_log + old done songs)
```

## Key Files

**New**
- `server/src/lib/rateLimit.ts` — `RateLimiter`
- `server/src/lib/clientIp.ts` — `clientIpOf(socket)`
- `server/src/lib/passkey.ts` — crypto generation + uniqueness
- `server/src/workers/maintenance.ts` — retention pruning

**Changed**
- `server/src/socket/connectionHandler.ts` — passkey, join_by_passkey limit, INSERT
- `server/src/socket/adminHandler.ts` — passkey, delete_song state
- `server/src/socket/authHandler.ts` — invite code, auth rate limits
- `server/src/socket/participantHandler.ts` — server-keyed limits, pruning, https
- `server/src/services/liveQueue/index.ts` + `scripts/transition.lua` — done cap
- `server/src/workers/dbEventHandlers.ts` — `queue_cleared` covers `playing`
- `server/src/db/schema.ts` — unique index on `rooms.passkey`
- `server/index.ts` — start maintenance
- `client/src/pages/AdminLoginPage.tsx` — invite-code field (one input + payload)

## Important Behavior Changes

- **Registration now requires the invite code.** `ADMIN_INVITE_CODE` must be set
  in `.env`; the registration form gains a field. Without it, registration fails
  with a clear error.
- **`done` history is capped** (Redis `LTRIM`, 50 in the rebuild query). Previous
  track still works within that window.
- **Per-user limits become per-connection/per-IP.** Reconnecting no longer resets
  the IP-backed limits.
- The client change is one input + one payload field, kept surgical to avoid the
  M3 thread's surface.

## Tests

Per contract, tests are not run. Verification is `tsc`, a live probe suite
(brute force, invite code, participant read), and a regression pass.

## Validation Done

- Audit probes reproduced 1, 2, 3 (via code + measured 93 ms/attempt), 4, 5.
- No duplicate passkeys exist in the DB, so the unique index is safe to add.
