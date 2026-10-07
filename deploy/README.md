# Deploy — `playlist.fiinnyy.my.id`

The app is served at **https://playlist.fiinnyy.my.id** through a Cloudflare
Tunnel that exposes the Bun server running on this machine.

## Why a tunnel and not Cloudflare Workers

The backend cannot run on Cloudflare Workers: it is a stateful **Socket.IO**
server that uses raw TCP **Redis** (`ioredis`), **Postgres** (`postgres`), and
`Bun.password`. None of those exist in the Workers runtime. Workers can host the
static client, but the real-time backend must run on a normal host. The existing
`PlayList` tunnel already fronts that host, so the whole app is served from one
origin:

```
browser ──https──> Cloudflare (playlist.fiinnyy.my.id)
                        │  tunnel
                        ▼
                  localhost:3001  (Bun server)
                    ├── client/dist           (built SPA, history fallback)
                    ├── /socket.io            (Socket.IO)
                    ├── /api/preview/:id      (resolve -> same-origin URL)
                    └── /api/preview/:id/stream (audio proxy)
```

## Preview audio

Admin preview + speaker routing (`setSinkId`) needs an `<audio>` element with a
real audio URL. Two things make the naive version fail, so the server proxies:

- **The googlevideo URL is IP-locked** to whoever resolved it — the browser gets
  a 403 from a different IP.
- **googlevideo sends no CORS header**, and the client sets
  `crossOrigin = "anonymous"`, which forces a CORS check.

`GET /api/preview/:id` therefore returns a **same-origin** URL
(`/api/preview/:id/stream`), and that endpoint streams the audio through this
origin with `Range` support. Same-origin means no CORS at all, and the fetch
happens from this server's IP, which satisfies the IP lock.

Resolution uses a single HTTP POST to YouTube's innertube player endpoint with the
`ANDROID_VR` client (`server/src/services/preview/innertube.ts`). That client is
served plain signed URLs with no `signatureCipher` to decode, so there is **no
yt-dlp binary and no subprocess** — just `fetch`. Resolved URLs are cached until
just before expiry.

The client is unchanged: it still calls `/api/preview/:id` and reads `{ url }`.

## One-time setup

1. **Build the client** so the server has something to serve:

   ```bash
   bun install
   bun run build        # -> client/dist
   ```

2. **Create `.env`** from `.env.example` with real `DATABASE_URL` (Neon) and
   `REDIS_URL`. The server needs both to boot. See `.env.example` for the
   runtime vars (`PORT`, `ALLOWED_ORIGINS`).

3. **Tunnel token**:

   ```bash
   printf 'TUNNEL_TOKEN=%s\n' "$(cloudflared tunnel token PlayList)" \
     > ~/.cloudflared/playlist-tunnel.env
   chmod 600 ~/.cloudflared/playlist-tunnel.env
   ```

4. **Route the public hostname.** A token-run tunnel takes its ingress rules from
   the dashboard / API, not a local config file. DNS and ingress are two separate
   things and both are needed:

   ```bash
   # 4a. DNS: point the hostname at the tunnel (creates a proxied CNAME).
   #     Use the flag BEFORE the positionals — this build rejects it after.
   cloudflared tunnel route dns --overwrite-dns PlayList playlist.fiinnyy.my.id

   # 4b. Ingress: tell the tunnel which local service serves that hostname.
   #     Replace $TOKEN with a token that has Cloudflare Tunnel:Edit.
   curl -X PUT \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     --data '{"config":{"ingress":[{"hostname":"playlist.fiinnyy.my.id","service":"http://localhost:3001"},{"service":"http_status:404"}]}}' \
     "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations"
   systemctl --user restart playlist-tunnel.service
   ```

   Same thing in the dashboard: Zero Trust → Networks → Tunnels → **PlayList** →
   Public Hostnames → Add → subdomain `playlist`, domain `fiinnyy.my.id`,
   service `http://localhost:3001`.

   Without 4b the hostname returns **503** (`No ingress rules were defined`);
   without 4a it returns **522** (nothing to route to).

5. **Install the systemd user services** (Redis included — nothing else provides
   it, and a plain `podman run` does not survive):

   ```bash
   cp deploy/playlist-redis.service deploy/playlist-app.service \
      deploy/playlist-tunnel.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now playlist-redis.service \
     playlist-app.service playlist-tunnel.service
   ```

   `Linger=yes` (`loginctl enable-linger "$USER"`) keeps them running after
   logout and across reboots.

## Day-to-day

```bash
bun run build                 # rebuild the client after frontend changes
systemctl --user restart playlist-app.service
systemctl --user status playlist-app.service playlist-tunnel.service
```

`playlist-app.service` runs `bun server/index.ts` from the repo root, with
`client/dist` resolved relative to `server/index.ts` (override with
`CLIENT_DIST`).
