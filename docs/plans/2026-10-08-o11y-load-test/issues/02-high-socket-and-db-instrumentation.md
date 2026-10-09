# 02 — Socket, HTTP, DB and Redis instrumentation

**Severity:** high

## Current Problem

Even with a registry, nothing reports into it. The 24 socket handlers, the HTTP
routes, the Postgres queries and the Redis calls are all dark.

## Target

`server/src/lib/instrument.ts` — thin wrappers, applied at the choke points so
the change is small and cannot drift per handler:

- **Socket:** wrap `socket.on` once, in `connectionHandler.ts`, so every handler
  registered by `handleParticipantEvents` / `handleAdminEvents` /
  `handleEOEvents` / `handleAuthEvents` is timed and counted by event name, with
  an error counter. One wrapper, 24 handlers covered.
- **HTTP:** wrap the route dispatch in `server/index.ts` so each path pattern
  (`/api/preview/:id`, `/api/top-tracks`, `/api/metrics`) gets count, latency
  and status.
- **Postgres:** `server/src/db/client.ts` reports rows touched per query. This
  is the D1 free-tier budget, so it must be per-query, not per-request.
- **Redis:** `server/src/lib/redis.ts` counts commands by operation.

Also add gauges: `socket.connections`, `socket.rooms`, `process.rss_bytes`,
and a periodic `process.cpuUsage()` delta so CPU per second is visible.

## Required Design

- **Wrap at the boundary, not in each handler.** 24 hand-edits will rot; one
  wrapper will not.
- **Count WebSocket messages explicitly.** The Cloudflare question is decided by
  messages-into-a-DO per day, so `socket.inbound_messages` is a first-class
  metric, and it must include heartbeats (Socket.IO ping/pong), not just
  application events. Instrument the Engine.IO layer, not only `socket.on`.
- **Rows, not queries.** D1 and DO bill rows scanned, so a single unindexed
  `SELECT` is the risk. Record `rows_read` per query with the query's shape.
- Never let a metrics failure break the request path — instrumentation is
  best-effort and must swallow its own errors.

## Tests

Not run. Verify: a join increments `socket.join_room`; a search increments
`socket.search_songs` and `db.rows_read`; the heartbeat counter rises while a
client sits idle.

## Done Criteria

- [ ] Every socket event is counted and timed by name
- [ ] Inbound WebSocket messages, heartbeats included, are counted
- [ ] HTTP routes report count, latency and status
- [ ] DB rows read/written are counted per query
- [ ] Connection and memory gauges are live
