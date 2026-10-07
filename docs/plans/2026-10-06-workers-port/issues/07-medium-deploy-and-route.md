# 07 — Deploy and route the custom domain

**Severity:** medium

## Current Problem

`playlist.fiinnyy.my.id` currently returns **522** and never reaches the origin.
The DNS record points at a dead origin and the `PlayList` tunnel has no ingress
rule for the hostname. Once the Worker exists, it needs to own that hostname.

## Target

The Worker is deployed and serves `playlist.fiinnyy.my.id` with no tunnel, no
Redis, and no Neon.

## Required Design

- `wrangler.jsonc` gets `routes: [{ pattern: "playlist.fiinnyy.my.id",
  custom_domain: true }]`, matching `greenshift`/`finny`.
- Applying the route requires a token with **Workers Routes:Edit**. The wrangler
  OAuth token on this machine is expired and lacks DNS/Tunnel edit scope, so
  either re-auth (`wrangler login`) or set the custom domain in the dashboard.
- If the stale `playlist` **A** records conflict, delete them first (DNS →
  Records) — a Worker custom domain needs to create its own record.
- Do not deploy or push without an explicit command.
- Keep the tunnel services stopped (or as a fallback) until the Worker is proven.

## Validation

```bash
bun run build
bunx wrangler d1 migrations apply playlist-db --remote
bunx wrangler deploy
curl -sI https://playlist.fiinnyy.my.id/          # expect 200 text/html
```

Live proof required:

- WebSocket `101` on `/socket.io/?EIO=4&transport=websocket`
- `admin1` / `12345678` logs in
- one `submit_song` → `queue_updated` round-trip
- a screenshot of the live landing page

## Done Criteria

- [ ] Worker deployed and bound to `playlist.fiinnyy.my.id`
- [ ] `curl -I` returns 200 and the SPA renders
- [ ] WebSocket upgrade returns 101 through Cloudflare
- [ ] Admin login + one queue round-trip verified live
- [ ] Screenshot captured as evidence
