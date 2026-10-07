# 01 — Passkey entropy + lookup rate limit

**Severity:** critical

## Current Problem

`Math.random()` is not cryptographically secure and its output is predictable
from prior values, so passkey sequences are guessable.

- `connectionHandler.ts:27` — `Math.floor(10000 + Math.random() * 90000)`
- `adminHandler.ts:174` — same expression

`join_by_passkey` (`connectionHandler.ts`) has **no rate limit**. Measured ~93 ms
per attempt, so the 90,000-code space falls in ~2h from a single socket and
minutes across parallel sockets. The passkey is the only credential a participant
presents, and `rooms.passkey` has no unique index, so collisions are silent.

## Target

- `lib/passkey.ts` — `generatePasskey()` using `crypto.getRandomValues`, and
  `generateUniquePasskey()` that re-rolls on an existing code.
- Both call sites use it.
- `join_by_passkey` is limited per IP **and** per socket.
- `rooms.passkey` gets a unique index (verified: no duplicates exist today).

```ts
export function generatePasskey(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(10000 + (buf[0] % 90000));
}

export async function generateUniquePasskey(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generatePasskey();
    const existing = await sql`SELECT 1 FROM rooms WHERE passkey = ${candidate} LIMIT 1`;
    if (existing.length === 0) return candidate;
  }
  throw new Error("Could not allocate a unique room passkey");
}
```

## Required Design

- Rate limit on `join_by_passkey` returns the existing
  `{ success: false, error: "..." }` shape so the client is unchanged.
- Limit per IP is the real defence (a socket can be reconnected cheaply).
- The unique index is added with `CREATE UNIQUE INDEX IF NOT EXISTS`; a NULL
  passkey is allowed and Postgres permits multiple NULLs.
- Keep the 5-digit, 10000–99999 format — the client and admin UI assume 5 digits.

## Tests

Not run. Verify: 30 rapid wrong-passkey attempts get throttled; a real passkey
still resolves; `tsc` passes.

## Done Criteria

- [ ] No `Math.random()` remains for passkey generation
- [ ] `generateUniquePasskey()` used by both call sites
- [ ] `join_by_passkey` throttles per IP and per socket
- [ ] Unique index on `rooms.passkey` exists
