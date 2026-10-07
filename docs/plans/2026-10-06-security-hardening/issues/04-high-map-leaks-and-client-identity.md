# 04 — Prune spam maps; stop trusting client identity

**Severity:** high

## Current Problem

`participantHandler.ts` keeps seven module-level maps that are never pruned
(`lastRequestTime`, `lastSearchTime`, `lastSuggestionTime`, `recentSubmissions`,
`roomRequestLog`, `violationLog`, `softbannedUsers`). Only the two search caches
are cleaned by `cacheCleanupTimer`, so the rest grow with distinct keys forever.

Worse, the keys are client-controlled: `submit_song` passes `userId` straight
from the payload, and every check (`isUserRateLimited`, `isDuplicate`,
`isSoftBanned`, the per-user pending cap) keys on it. Rotating `userId` bypasses
all of them.

## Target

- `lib/rateLimit.ts` — a fixed-window `RateLimiter` with `deleteExpired()`,
  mirroring the `TtlLruCache` API in `socket/searchCache.ts`.
- Replace the cooldown/flood maps with `RateLimiter` instances and the
  duplicate/violation/soft-ban maps with `TtlLruCache`, so every one of them is
  prunable from the existing cleanup interval.
- Key enforcement on **server-derived** identity:
  - `actorId` — assigned per socket at connection (`socket.data.actorId`), used
    for the short cooldown and duplicate checks.
  - `clientIp` — from `cf-connecting-ip`, used for the abuse-grade limits
    (soft-ban, per-IP submission limit) because it survives reconnects.
- Keep `submittedBy` as the client `userId` for display and attribution, and keep
  the 5-pending-per-user cap as a UX guardrail — it is now backstopped by the
  per-IP and per-room limits.

## Required Design

- `clientIpOf(socket)` prefers `cf-connecting-ip`, then the first
  `x-forwarded-for` entry, then `socket.handshake.address`. The server is behind
  a Cloudflare Tunnel, so the raw socket address is always localhost — reading the
  header is required, not an optimisation.
- `socket.data.actorId` is set in `connectionHandler` before any handler can run.
- The prune interval covers every limiter/cache and stays `unref()`'d.
- Response strings stay identical so the client's existing messages still render.
- No `any` in the new modules; type the limiter generically.

## Tests

Not run. Verify: repeated submissions from one socket throttle; rotating `userId`
no longer resets the cooldown; the maps stop growing (size check after a burst).

## Done Criteria

- [ ] All seven maps are replaced by pruning `RateLimiter` / `TtlLruCache`
- [ ] Cooldown and duplicate checks key on `actorId`
- [ ] Soft-ban and the new per-IP submission limit key on `clientIp`
- [ ] `cf-connecting-ip` is honoured behind the tunnel
