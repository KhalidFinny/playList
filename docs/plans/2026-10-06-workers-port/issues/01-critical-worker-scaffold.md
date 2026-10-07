# 01 — Worker scaffold, assets, bindings

**Severity:** critical

## Current Problem

There is no Worker. `server/index.ts` is a Bun HTTP server; the repo has no
`wrangler.jsonc`, no Worker entry, and no build target that produces a Worker
bundle. Nothing can be deployed to Cloudflare.

## Target

A Worker that serves the existing built client and routes `/socket.io` to a
Durable Object.

```
worker/
  index.ts        # fetch handler: /socket.io -> DO, else ASSETS
  room-do.ts      # exported RoomDO class (issue 04)
wrangler.jsonc    # name, main, assets, d1, durable_objects, migrations, route
```

`worker/index.ts`:

```ts
export { RoomDO } from "./room-do";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/socket.io")) {
      const roomId = url.searchParams.get("roomId") ?? "lobby";
      const id = env.ROOM.idFromName(roomId);
      return env.ROOM.get(id).fetch(req);
    }
    return env.ASSETS.fetch(req); // SPA fallback via not_found_handling
  },
} satisfies ExportedHandler<Env>;
```

`wrangler.jsonc` mirrors the sibling projects' style (`greenshift`, `finny`):
`compatibility_date`, `nodejs_compat`, `assets.not_found_handling:
"single-page-application"`, `assets.directory: "./client/dist"`, a `d1_databases`
binding, a `durable_objects` binding, and a `migrations` entry with
`new_sqlite_classes: ["RoomDO"]`.

## Required Design

- SQLite-backed DO class only (`new_sqlite_classes`) — the KV storage backend is
  paid-only.
- Client build output stays `client/dist` so the existing `bun run build` works.
- Keep `client/vite.config.ts` dev proxy on `/socket.io` → `:3001` for local Bun
  development; it does not affect the Worker.
- Do not add Hono or other frameworks — the routing is three branches.

## Tests

`bunx wrangler deploy --dry-run` succeeds; `bunx wrangler dev` serves the client
at `/`.

## Done Criteria

- [ ] `wrangler.jsonc` declares ASSETS, DB (D1), ROOM (DO), and a migration
- [ ] Worker serves the SPA at `/` and deep links (e.g. `/login`)
- [ ] `/socket.io` is routed to `RoomDO`
- [ ] `wrangler deploy --dry-run` passes
