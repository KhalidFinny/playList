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

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // 11-character ids only, so this never becomes an open proxy.
    const stream = /^\/api\/preview\/([A-Za-z0-9_-]{11})\/stream$/.exec(url.pathname);
    if (stream) return proxyStream(stream[1], req, ctx);

    // Preview resolution is stateless: it needs no room, so it is answered here
    // rather than in the hub. That also means it runs the code that was just
    // deployed, instead of whatever version the long-lived hub object started on.
    const preview = /^\/api\/preview\/([A-Za-z0-9_-]{11})$/.exec(url.pathname);
    if (preview) return resolvePreview(preview[1], ctx);

    // A room id has to be known before the socket is accepted, and this app
    // joins by passkey, so every socket lands on the same hub object.
    if (url.pathname.startsWith("/socket.io") || url.pathname.startsWith("/api/")) {
      return env.ROOM.get(env.ROOM.idFromName("hub")).fetch(req);
    }

    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

/** The same-origin stream URL, with the track's own loudness for volume matching. */
async function resolvePreview(videoId: string, ctx: ExecutionContext): Promise<Response> {
  try {
    const { mimeType, loudnessLufs } = await getAudioStream(videoId, ctx);
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