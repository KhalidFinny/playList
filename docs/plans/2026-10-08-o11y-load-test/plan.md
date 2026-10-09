# Plan — observability, load testing, and Cloudflare free-plan fit

> **Status:** ✅ Complete — instrumented, load-tested, verdict written. 2026-10-09.
> **Result: it fits.** ~10,400 DO requests/day at 50 connections against a
> 100,000/day allowance. The first verdict said the opposite and was wrong — see
> the erratum at the top of [ANALYSIS.md](ANALYSIS.md). Hard requirements for the
> port: [workers-port issue 08](../2026-10-06-workers-port/issues/08-critical-free-tier-requirements.md).

## Goal

Get real numbers on what this app does under a realistic event load, and decide
from the data whether the Workers free plan is viable.

## Architecture

A metrics registry inside the Bun server, exposed at `/api/metrics`; k6 drives
the live server over real Socket.IO; the captured numbers are compared against
Cloudflare's published free-tier limits.

## Tech Stack

Unchanged for the app — Bun, Socket.IO, Redis, Postgres. Added: k6 for load, and
nothing else (no metrics daemon, no exporter).

## Must Not Forget

- **Never point a load test at the production Neon database.** `.env`'s
  `DATABASE_URL` is live. Use a throwaway local Postgres.
- **Never load-test `playlist.fiinnyy.my.id`.** Real users. Target
  `localhost:3001`.
- **`/api/metrics` must not be public.** Loopback-only or token-gated.
- **The decision metric is DO requests/day**, not HTTP requests/day. A
  WebSocket message to a Durable Object counts as one DO request, and Socket.IO
  heartbeats are the thing that may blow the 100,000/day free limit.
- **k6 has no Socket.IO support and Go is not installed**, so the script speaks
  EIO4 + Socket.IO frames over `k6/experimental/websockets` directly.
- **Instrumentation must not distort the measurement.** Prove the overhead is
  small by comparing a run with it on against one with it off.
- Tests are not run unless asked. No commit, no push, no deploy.
- `HANDOFF.md` / `PROGRESS.md` are append-only and shared.

## Issue Index

**High**

1. [01-high-metrics-registry](issues/01-high-metrics-registry.md)
2. [02-high-socket-and-db-instrumentation](issues/02-high-socket-and-db-instrumentation.md)
3. [03-high-k6-load-harness](issues/03-high-k6-load-harness.md)

**Medium**

4. [04-medium-isolated-load-target](issues/04-medium-isolated-load-target.md)
5. [05-medium-cloudflare-fit-analysis](issues/05-medium-cloudflare-fit-analysis.md)

## Priority Order

1 → 2 → 4 → 3 → 5

(4 before 3: the isolated target has to exist before anything is driven hard.)

## Target Architecture

```
socket.on(name, handler) ──► instrumented wrapper ──► metrics.observe(event, ms, err)
http route              ──► timed(handler)        ──► metrics.observe(path, ms, status)
db query                ──► countRows(sql, n)     ──► metrics.addRowsRead/Write(n)
redis command           ──► countCmd(op)          ──► metrics.count("redis.op")
                                                          │
                              GET /api/metrics ◄──────────┘
```

## Validation Commands

```bash
bun run check                                   # client + server tsc, lint, format
systemctl --user restart playlist-app.service   # server changes need this
curl -s localhost:3001/api/metrics | head       # the endpoint answers
k6 run tests/load/event.js                      # the scenario
```

## Rollout Plan

- [x] Phase 1 — metrics registry + `/api/metrics`
- [x] Phase 2 — socket, HTTP, DB and Redis instrumentation
- [x] Phase 3 — isolated Postgres for the load target
- [x] Phase 4 — k6 scenario modelling a 50-participant event
- [x] Phase 5 — run it, capture, analyse, write the verdict

## Done Criteria

- [x] `/api/metrics` reports counters, latencies and gauges for every socket
      event and HTTP route
- [x] The registry is not reachable without the token (401 without, 200 with)
- [x] k6 opens real Socket.IO connections and exercises join → search → idle
- [x] The runs happened against an isolated database, not Neon
- [x] A written verdict states, with arithmetic, whether the free plan holds —
      and names the first limit to break: **DO requests, on heartbeats**
- [x] `check` passes and `HANDOFF.md` / `PROGRESS.md` record the outcome

## Not done, and why

- **Instrumentation overhead was not measured against an uninstrumented
  baseline.** The added work is a `Map` increment per event and one `Proxy` trap
  per query; that is an argument, not a measurement.
- **Per-request CPU was not isolated.** The 10 ms Worker CPU budget is therefore
  unproven rather than passing. `ANALYSIS.md` says so explicitly.
- **`rows_written` stayed 0** through every run. The `Proxy` reads
  `pending.count`, which postgres.js does not appear to set on the paths this app
  uses, so write counts are missing. Read counts work.
