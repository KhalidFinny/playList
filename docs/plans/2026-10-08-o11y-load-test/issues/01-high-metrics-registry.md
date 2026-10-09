# 01 — The metrics registry

**Severity:** high

## Current Problem

There is no way to observe the server. `server/src/` has 101 `console.log` /
`console.error` calls and no counters, timings or gauges anywhere. "How is it
doing under load" can only be answered by reading logs after the fact.

## Target

`server/src/lib/metrics.ts` — a dependency-free registry:

```ts
count(name: string, by?: number): void            // monotonic counter
observe(name: string, ms: number): void           // latency histogram
gauge(name: string, value: number): void          // last-write-wins
rowsRead(n: number): void                         // D1/DO row budget
rowsWritten(n: number): void
snapshot(): Snapshot                              // for the endpoint
renderPrometheus(): string
```

- Counters and histograms keyed by a dotted name
  (`socket.search_songs`, `http./api/preview/:id`, `db.rows_read`).
- Histogram buckets in ms, tuned to this app: `[1, 2, 5, 10, 25, 50, 100, 250,
  500, 1000, 2500, 5000]`. The 10 ms free-plan CPU budget means the low buckets
  are the ones that matter.
- A rolling window so a long run does not accumulate unbounded memory.

`server/index.ts` gains `GET /api/metrics`, returning JSON by default and
Prometheus text when `Accept` asks for it.

## Required Design

- **No dependency.** No `prom-client`, no OpenTelemetry SDK — this is a small
  Bun server and the budget is a single file.
- **Must be cheap.** A `Map` increment on the hot path. No allocation per call,
  no string building unless `snapshot()` is called.
- **`/api/metrics` is not public.** Bind it to loopback, or require the existing
  admin token. It exposes load shape and connection counts.
- **The 10 ms CPU budget is the point.** Histograms must be able to show the
  share of requests over 10 ms, because that is the free-plan cliff.

## Tests

Not run. Verify: endpoint answers, a known request increments the expected
counter, histogram buckets land where expected.

## Done Criteria

- [ ] `metrics.ts` exports counters, histograms, gauges and row counters
- [ ] `GET /api/metrics` returns a snapshot
- [ ] Reachable only from the box
- [ ] Overhead measured against an uninstrumented run
