import { RoomHub } from "./hub";
import { getAudioStream } from "./lib/youtube";

export { RoomHub };

export interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  ADMIN_INVITE_CODE?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

/**
 * The same security headers `client/public/_headers` puts on static assets.
 *
 * `_headers` only applies to asset responses, so anything this Worker generates
 * has to carry them itself or `/api` would be the one hole. A WebSocket upgrade
 * cannot be rebuilt as a `Response`, so it passes through untouched.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com; " +
    "media-src 'self' blob:; font-src 'self' data:; " +
    "connect-src 'self' https://playlist.fiinnyy.my.id wss://playlist.fiinnyy.my.id; " +
    "frame-src https://www.youtube.com; worker-src 'self'; manifest-src 'self'; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function harden(response: Response): Response {
  if (response.status === 101 || response.webSocket) return response;

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // 11-character ids only, so this never becomes an open proxy.
    const stream = /^\/api\/preview\/([A-Za-z0-9_-]{11})\/stream$/.exec(url.pathname);
    if (stream) return harden(await proxyStream(stream[1], req, ctx));

    // Preview resolution is stateless: it needs no room, so it is answered here
    // rather than in the hub. That also means it runs the code that was just
    // deployed, instead of whatever version the long-lived hub object started on.
    const preview = /^\/api\/preview\/([A-Za-z0-9_-]{11})$/.exec(url.pathname);
    if (preview) return harden(await resolvePreview(preview[1], ctx, url.searchParams.has("fresh")));

    // A room id has to be known before the socket is accepted, and this app
    // joins by passkey, so every socket lands on the same hub object.
    if (url.pathname.startsWith("/socket.io") || url.pathname.startsWith("/api/")) {
      const hub = await env.ROOM.get(env.ROOM.idFromName("hub")).fetch(req);
      return harden(hub);
    }

    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

/** The same-origin stream URL, with the track's own loudness for volume matching. */
async function resolvePreview(
  videoId: string,
  ctx: ExecutionContext,
  fresh = false,
): Promise<Response> {
  try {
    const { mimeType, loudnessLufs } = await getAudioStream(videoId, ctx, fresh);
    return json({ url: `/api/preview/${videoId}/stream`, mimeType, loudnessLufs });
  } catch (err) {
    console.error(`[preview] ${videoId}:`, err);
    return json({ error: "Failed to get audio stream" }, 502);
  }
}

/**
 * The signed googlevideo URL is bound to the resolver's IP and sends no CORS
 * header, so the browser cannot play it directly. Streaming it through the
 * Worker fixes both, and keeps Range support so `<audio>` can seek.
 */
async function proxyStream(videoId: string, req: Request, ctx: ExecutionContext): Promise<Response> {
  let upstream: Awaited<ReturnType<typeof getAudioStream>>;
  try {
    upstream = await getAudioStream(videoId, ctx);
  } catch (err) {
    console.error(`[stream] ${videoId}:`, err);
    return json({ error: "Failed to get audio stream" }, 502);
  }

  const range = req.headers.get("Range");
  const response = await fetch(upstream.url, { headers: range ? { Range: range } : {} });

  if (!response.ok && response.status !== 206) {
    return json({ error: `Upstream refused the stream (${response.status})` }, 502);
  }

  const headers = new Headers({
    "Content-Type": upstream.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  for (const key of ["Content-Range", "Content-Length"]) {
    const value = response.headers.get(key);
    if (value) headers.set(key, value);
  }

  return new Response(response.body, { status: response.status, headers });
}