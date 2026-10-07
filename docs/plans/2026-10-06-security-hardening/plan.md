# Plan — security & resource hardening

> **Status:** ✅ Complete — implemented and verified live. 2026-10-06.

## Goal

Close the six audited defects without changing the client beyond one invite-code
input.

## Architecture

Server-keyed rate limits via a shared `RateLimiter`; crypto passkeys; retention
caps on queue + event log; a startup maintenance pass.

## Tech Stack

Unchanged — Bun, Socket.IO, Redis, Neon Postgres.

## Must Not Forget

- **Server-side enforcement only.** Do not trust any client-supplied identity
  (`userId`, `roomId` alone) for a limit.
- **One client change only**: the invite-code field in `AdminLoginPage.tsx`. The
  M3 thread owns the rest of `client/src`.
- **Do not break existing response shapes** — the client reads
  `{ success, error }`, `{ results }`, `{ suggestions }`, `{ nowPlaying }`.
- `ADMIN_INVITE_CODE` is already set in `.env` (`PLAYLIST`).
- Tests are not run unless asked. Verify with `tsc` + live probes.
- No commit, no push, no deploy without an explicit command.

## Issue Index

**Critical**
1. [01-critical-passkey-entropy-and-ratelimit](issues/01-critical-passkey-entropy-and-ratelimit.md)
2. [02-critical-invite-code-and-auth-limits](issues/02-critical-invite-code-and-auth-limits.md)

**High**
3. [03-high-unbounded-growth](issues/03-high-unbounded-growth.md)
4. [04-high-map-leaks-and-client-identity](issues/04-high-map-leaks-and-client-identity.md)

**Medium**
5. [05-medium-queue-state-correctness](issues/05-medium-queue-state-correctness.md)

## Priority Order

1 → 2 → 3 → 4 → 5

## Validation Commands

```bash
cd server && bun tsc --noEmit
systemctl --user restart playlist-app.service
bun .amp/in/audit-verify2.ts      # invite code, brute-force limit, participant read
```

## Rollout Plan

- [x] Phase 1 — shared primitives (`rateLimit`, `clientIp`, `passkey`, `actor`, `prune`)
- [x] Phase 2 — passkey entropy + `join_by_passkey` limit + unique index
- [x] Phase 3 — invite code enforcement + auth rate limits
- [x] Phase 4 — retention caps + maintenance worker
- [x] Phase 5 — server-keyed limits + pruning in `participantHandler`
- [x] Phase 6 — the four correctness fixes
- [x] Phase 7 — verify live, update handoff/progress

## Done Criteria

- [x] Passkeys come from `crypto`, are unique, and are rate-limited on lookup
- [x] Registration requires a valid `ADMIN_INVITE_CODE`
- [x] `admin_login` / `admin_register` / `join_by_passkey` are rate-limited per IP
- [x] `done` history and `db_event_log` are bounded
- [x] Spam maps prune; limits key on server-derived identity
- [x] The four correctness fixes are in
- [x] `tsc` passes (client + server) and the live regression suite is green

## Verified (live)

11/11 probe checks passed: invite code rejected when absent/wrong and accepted
when correct; passkeys 5-digit and distinct; legitimate lookup resolves; brute
force capped at 7 attempts (was unlimited, ~93 ms each); participant still
blocked from the pending queue; rotating `userId` no longer bypasses the
cooldown. Queue state: deleting the playing song clears now-playing, and
`clear_queue` marks the playing song `done` (confirmed in Postgres). Primitives
unit-checked (`RateLimiter` window/reset/prune, `pruneAll`, size cap). Maintenance
SQL executed against the live DB. Regression: landing/login/socket/preview 200,
preview range 206, search returns results.

## Deviation

The one client change exposed a latent bug: the animated `height: auto` wrapper
on the register form settled on a stale height measured before the web font
loaded, clipping its content (the invite field was cut off). Fixed at the root by
dropping the height animation in favour of `opacity` + `y`, which has no measured
value to go stale. Verified by measurement (container now fits 4 × 56px fields)
and screenshot.
