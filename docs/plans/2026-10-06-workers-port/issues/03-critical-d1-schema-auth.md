# 03 — D1 schema, WebCrypto auth, admin seed, sessions

**Severity:** critical

## Current Problem

`server/src/db/schema.ts` runs Postgres DDL (7 `information_schema` migration
blocks, `gen_random_uuid()`, `TIMESTAMP WITH TIME ZONE`), `server/src/db/seed.ts`
uses `Bun.password.hash`, and `authHandler.ts` stores sessions with
`redisCache.client.setex`. None of this runs on Workers.

## Target

D1 (SQLite) holds the global tables; WebCrypto hashes passwords; sessions live in
D1 so reads are immediately consistent.

`worker/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_admin_idx ON sessions(admin_id);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  passkey TEXT UNIQUE NOT NULL,
  owner_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rooms_passkey_idx ON rooms(passkey);
```

- `id` = `crypto.randomUUID()`; timestamps = epoch **milliseconds** (matches the
  `dev-tendencies` Cloudflare convention and avoids `TIMESTAMPTZ`).
- Password hashing: PBKDF2 via WebCrypto (`deriveBits`, SHA-256, ≥100k
  iterations) with a per-admin random salt. No `Bun.password`.
- Sessions: random token, `expires_at = now + 7d`; `admin_authenticate` looks up
  `sessions` and joins `admins`. Delete on logout.
- Seed: `admin1` (super_admin), `admin2`, `admin3`, all `active`, password
  `12345678`, idempotent via `INSERT ... ON CONFLICT(username) DO UPDATE`. Must
  also delete legacy `admin4`/`admin5` if present.
- Port the `rooms.passkey` lookup to an indexed D1 query (replaces the Redis
  room-key cache). Passkeys become globally unique.

## Required Design

- No KV for sessions — KV reads are eventually consistent and would let a stale
  read reject a valid login.
- `admins`/`sessions`/`rooms` are the only D1 tables. The hot queue path stays in
  DO SQLite (issue 04) to keep D1 rows-written under 100k/day.
- Migrations live in `worker/db/migrations/` and apply with
  `wrangler d1 migrations apply`.
- Port `admin_register`, `admin_login`, `admin_authenticate`, `admin_logout`,
  `get_pending_admins`, `approve_admin`, `deny_admin` onto D1, preserving their
  callback response shapes exactly.

## Tests

Not run by default. Verify: seed once, `admin_login` with `admin1`/`12345678`
returns `success: true` and a token; a wrong password returns
`Invalid credentials`; a suspended/pending admin is rejected.

## Done Criteria

- [ ] D1 migration creates `admins`, `sessions`, `rooms` with indexes
- [ ] Seed creates exactly admin1–admin3 (password `12345678`), removes admin4/5
- [ ] `admin_login` / `admin_authenticate` / `admin_logout` work end to end
- [ ] No `Bun.password`, no Postgres, no `information_schema` remains
