# 05 — The Cloudflare free-plan verdict

**Severity:** medium

## Current Problem

`docs/plans/2026-10-06-workers-port/` assumes the Workers free plan is
sufficient. That assumption is untested, and one piece of arithmetic suggests it
may be wrong: if each WebSocket message to a Durable Object counts as a DO
request, Socket.IO heartbeats alone put ~176,000 requests/day on a 100,000/day
allowance for 51 connections.

## Target

A written verdict, with the arithmetic shown, stating:

1. Whether a 50-participant, ~3-hour event fits each free-plan limit.
2. **Which limit breaks first**, in the order it would be hit.
3. The projected daily figures from measured per-hour rates — not guesses.
4. The cheapest change that buys the most headroom, if it does not fit.

The comparison table to fill in, from the measured run:

| Limit | Free | Measured/hour | Projected/day | Verdict |
|---|---|---|---|---|
| Worker requests | 100,000/day | | | |
| Worker CPU > 10 ms | 10 ms/req | | | |
| DO requests | 100,000/day | | | |
| DO rows read | 5,000,000/day | | | |
| DO rows written | 100,000/day | | | |

## Required Design

- **Project from measurement, do not extrapolate from theory.** If the measured
  heartbeat rate disagrees with the 25 s assumption, the measurement wins.
- **Name the mitigation for each break**, concretely:
  - heartbeat pressure → raise `pingInterval`, or move liveness off the DO
  - rows read → the queue query shapes and their indexes
  - CPU → the two known heavy handlers (`admin_login`'s `Bun.password`, search's
    outbound fetch)
- **State the paid-plan cost** if the verdict is "does not fit": Workers Paid is
  $5/month and lifts the request caps and the CPU budget. A one-line cost
  comparison is more useful than a bare "no".
- **Do not overstate.** Anything measured on Bun is an upper or lower bound on
  Workers, not a translation: `workerd` has different startup, no TCP Redis, and
  a different Postgres story. Say which numbers transfer and which do not.

## Tests

None.

## Done Criteria

- [ ] Every free-plan limit has a measured-or-projected figure against it
- [ ] The first limit to break is named
- [ ] Each break has a concrete mitigation
- [ ] The paid-plan comparison is stated
- [ ] The limits of the measurement itself are stated
