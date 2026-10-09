# 04 — An isolated load target

**Severity:** medium

## Current Problem

`.env`'s `DATABASE_URL` is the **live Neon instance** that the deployed app
writes to. There is no local Postgres, `docker` is not installed, and `psql` is
not present. So the obvious way to load-test — start the server locally and drive
it — would hammer the production database.

That is unacceptable: the row-read/row-write budgets are real, the data is real,
and a load test is exactly the shape of traffic that would corrupt it.

## Target

An isolated Postgres for the load target:

```bash
podman run -d --name playlist-load-pg \
  -e POSTGRES_PASSWORD=load -e POSTGRES_DB=playlist_load \
  -p 55432:5432 postgres:16-alpine
```

The server is started for load testing with `DATABASE_URL` pointed at
`localhost:55432`, and Redis pointed at a **separate** logical database (the
running instance is on `:6104`; use a different `REDIS_URL` db index or a second
container so the load run cannot flush the live queue).

The existing `server/src/db/schema.ts` migrations are `information_schema`-guarded
and idempotent, so they should create the schema on a blank database with no
changes.

## Required Design

- **Two separate guards, not one.** A different Postgres *and* a different Redis
  database. Sharing either makes the run unsafe.
- **Assert the target before driving load.** The harness prints the resolved
  `DATABASE_URL` host and the Redis db index and refuses to run if either looks
  like production. A comment is not a guard.
- `podman` is present and already runs `playmusic_redis`; use it rather than
  installing anything system-wide.
- The container is disposable and named so it is obvious what it is. Do not
  reuse the production container names.

## Tests

Not run. Verify: the server boots against the isolated DB, the schema is created,
and a join + search round-trips.

## Done Criteria

- [ ] A throwaway Postgres exists and the schema migrates onto it
- [ ] Load runs use a different Postgres and a different Redis database
- [ ] The harness refuses to run against anything that looks like production
- [ ] The production database and the live origin are untouched by every run
