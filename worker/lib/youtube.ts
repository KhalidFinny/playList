const PLAYER_ENDPOINT = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const SEARCH_ENDPOINT = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";

// The desktop client is the one whose search results come back as plain
// `videoRenderer` entries with a video id, title, length and thumbnail.
const WEB_VERSION = "2.20260623.01.00";

export type AudioStream = {
  url: string;
  mimeType: string;
  /** The track's own integrated loudness in LUFS, as YouTube measured it. */
  loudnessLufs: number | null;
};

export type SearchTrack = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
};

// The VISIONOS (Apple Vision Pro) player is the one that still lists audio with
// plain signed URLs, so no signature or JS challenge has to be solved. It wants
// an anonymous visitor id first or it answers with a bot check. Same client as
// Meiro's AudioStream and as the Bun server's resolver.
const VISITOR_ENDPOINT = "https://music.youtube.com/youtubei/v1/visitor_id?prettyPrint=false";
const VISIONOS_VERSION = "1.02";
const VISIONOS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

type PlayerClient = {
  name: string;
  id: string;
  version: string;
  userAgent: string;
  extra?: Record<string, string | number>;
};

// Every client below answers with audio formats that carry a plain URL, so none
// of them needs a signature or challenge solved. They are tried in order because
// YouTube challenges a datacenter address per client, not per video.
const CLIENTS: PlayerClient[] = [
  {
    name: "VISIONOS",
    id: "101",
    version: "1.02",
    userAgent: VISIONOS_USER_AGENT,
    extra: {
      deviceMake: "Apple",
      deviceModel: "RealityDevice17,1",
      osName: "visionOS",
      osVersion: "26.5.23O471",
    },
  },
  {
    name: "TV_EMBEDDED",
    id: "85",
    version: "2.0",
    userAgent: VISIONOS_USER_AGENT,
    extra: { thirdParty: { embedUrl: "https://www.youtube.com/" } as unknown as string },
  },
  {
    name: "IOS",
    id: "5",
    version: "19.45.4",
    userAgent: "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)",
    extra: {
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.1.0.22B83",
    },
  },
  {
    name: "ANDROID_VR",
    id: "28",
    version: "1.60.19",
    userAgent: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; GB) gzip",
    extra: {
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      androidSdkVersion: 32,
      osName: "Android",
      osVersion: "12",
    },
  },
];

/**
 * A guest cookie jar from YouTube's own homepage.
 *
 * The player answers `LOGIN_REQUIRED: Sign in to confirm you're not a bot` when
 * it does not like the request, and it decides that per address. Cloudflare's
 * egress addresses are shared by a great deal of scraping, so the refusal comes
 * and goes with no change on our side. A request carrying the cookies YouTube
 * itself hands out to a first-time visitor is treated as a browser rather than a
 * script, which is what stops the refusals.
 *
 * Cached rather than fetched per request: one page load per worker, and the
 * cookies it sets are long lived.
 */
const COOKIE_KEY = "https://preview.internal/yt-cookies";
const COOKIE_TTL_SECONDS = 1800;

async function ensureCookies(ctx?: ExecutionContext, fresh = false): Promise<string> {
  const cache = caches.default;
  if (!fresh) {
    const hit = await cache.match(new Request(COOKIE_KEY));
    if (hit) return await hit.text();
  }

  try {
    const response = await fetch("https://www.youtube.com/", {
      headers: { "User-Agent": VISIONOS_USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    });
    const jar = new Map<string, string>();
    for (const raw of response.headers.getSetCookie()) {
      const [pair = ""] = raw.split(";");
      const at = pair.indexOf("=");
      if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const stored = new Response(cookie, {
      headers: { "Cache-Control": `public, max-age=${COOKIE_TTL_SECONDS}` },
    });
    if (ctx) ctx.waitUntil(cache.put(new Request(COOKIE_KEY), stored));
    else await cache.put(new Request(COOKIE_KEY), stored);
    return cookie;
  } catch (err) {
    // No cookies is the old behaviour, not a failure: the request still works
    // whenever YouTube is willing to answer it.
    console.log(`[youtube] cookie jar unavailable: ${err instanceof Error ? err.message : err}`);
    return "";
  }
}

/**
 * The visitor id the player expects, shared through the cache.
 *
 * A module-level string only reaches the isolate that fetched it, and every new
 * isolate asking YouTube for one is more traffic from an address that is already
 * being watched. The cache is shared by all of them.
 */
const VISITOR_KEY = "https://preview.internal/yt-visitor";
const VISITOR_TTL_SECONDS = 1800;

async function ensureVisitor(ctx?: ExecutionContext, fresh = false): Promise<string> {
  const cache = caches.default;
  if (!fresh) {
    const hit = await cache.match(new Request(VISITOR_KEY));
    if (hit) {
      const cached = await hit.text();
      if (cached) return cached;
    }
  }

  const cookie = await ensureCookies(ctx);
  const response = await fetch(VISITOR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Youtube-Client-Name": "67",
      "X-Youtube-Client-Version": "1.20250219.01.00",
      Origin: "https://music.youtube.com",
      Referer: "https://music.youtube.com/",
      "User-Agent": VISIONOS_USER_AGENT,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      context: {
        client: { clientName: "WEB_REMIX", clientVersion: "1.20250219.01.00", hl: "en", gl: "US" },
      },
    }),
  });

  if (!response.ok) throw new Error(`YouTube visitor request failed (${response.status})`);
  const data = (await response.json()) as { responseContext?: { visitorData?: string } };
  const visitor = data.responseContext?.visitorData ?? "";
  if (visitor) {
    const stored = new Response(visitor, {
      headers: { "Cache-Control": `public, max-age=${VISITOR_TTL_SECONDS}` },
    });
    if (ctx) ctx.waitUntil(cache.put(new Request(VISITOR_KEY), stored));
    else await cache.put(new Request(VISITOR_KEY), stored);
  }
  return visitor;
}

// Resolving costs a YouTube player call, and an `<audio>` element makes several
// range requests per track, so an uncached resolver spends one call per range
// request. Measured on the deployed Worker: 21 of 30 rapid resolves were refused
// with a bot check, and every stream request waited ~270ms for its first byte.
//
// The cache is the Cache API rather than a module-level map: each request can land
// on a different isolate, so a per-isolate map almost never hits. Five minutes is
// well inside the signed URL's six-hour life, and a miss is only one call.
const RESOLVE_TTL_SECONDS = 300;
const cacheKey = (videoId: string) => new Request(`https://preview.internal/${videoId}`);

/** The stream for a video, resolving it only on a cache miss. */
export async function getAudioStream(
  videoId: string,
  ctx?: ExecutionContext,
  fresh = false,
): Promise<AudioStream> {
  const cache = caches.default;
  const key = cacheKey(videoId);

  // `fresh` is the recovery path: a cached URL that the media server has started
  // refusing must not be handed back, or a stalled player can never recover.
  const hit = fresh ? null : await cache.match(key);
  if (hit) return (await hit.json()) as AudioStream;

  const stream = await resolveAudio(videoId, ctx);
  const stored = new Response(JSON.stringify(stream), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${RESOLVE_TTL_SECONDS}`,
    },
  });

  // Not awaited on the hot path: the caller needs the stream, not the cache write.
  if (ctx) ctx.waitUntil(cache.put(key, stored));
  else await cache.put(key, stored);

  return stream;
}

export async function resolveAudio(videoId: string, ctx?: ExecutionContext): Promise<AudioStream> {
  const cookie = await ensureCookies(ctx);
  const visitor = await ensureVisitor(ctx);
  let lastError = new Error("No playable audio format found");

  for (const client of CLIENTS) {
    try {
      return await resolveWith(client, videoId, visitor, cookie);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[youtube] ${client.name} refused ${videoId}: ${lastError.message}`);
    }
  }

  // A stale visitor or cookie jar is the usual cause of a refusal, so one retry
  // with both replaced costs two requests and rescues the common case.
  const freshCookie = await ensureCookies(ctx, true);
  const fresh = await ensureVisitor(ctx, true);
  for (const client of CLIENTS) {
    try {
      return await resolveWith(client, videoId, fresh, freshCookie);
    } catch {
      // Every client has now been tried; fall through to the last error.
    }
  }

  throw lastError;
}

async function resolveWith(
  client: PlayerClient,
  videoId: string,
  visitor: string,
  cookie: string,
): Promise<AudioStream> {
  const response = await fetch(PLAYER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Youtube-Client-Name": client.id,
      "X-Youtube-Client-Version": client.version,
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
      "User-Agent": client.userAgent,
      ...(visitor ? { "X-Goog-Visitor-Id": visitor } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: client.name,
          clientVersion: client.version,
          hl: "en",
          gl: "US",
          visitorData: visitor,
          ...client.extra,
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (!response.ok) throw new Error(`player request failed (${response.status})`);

  const data = (await response.json()) as {
    playabilityStatus?: { status?: string; reason?: string };
    streamingData?: {
      adaptiveFormats?: {
        url?: string;
        mimeType: string;
        bitrate?: number;
        isDrc?: boolean;
        audioTrack?: { audioIsDefault?: boolean };
        trackAbsoluteLoudnessLkfs?: number;
      }[];
    };
    responseContext?: { visitorData?: string };
    playerConfig?: { audioConfig?: { perceptualLoudnessDb?: number } };
  };

  const status = data.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(`${status}${data.playabilityStatus?.reason ? `: ${data.playabilityStatus.reason}` : ""}`);
  }

  const best = (data.streamingData?.adaptiveFormats ?? [])
    .filter(
      (f) => f.url && f.mimeType.startsWith("audio/") && !f.isDrc && (f.audioTrack?.audioIsDefault ?? true),
    )
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

  if (!best?.url) throw new Error("no audio format with a direct URL");

  const measured = best.trackAbsoluteLoudnessLkfs ?? data.playerConfig?.audioConfig?.perceptualLoudnessDb;
  return {
    url: best.url,
    mimeType: best.mimeType,
    loudnessLufs: typeof measured === "number" && Number.isFinite(measured) ? measured : null,
  };
}

type Json = Record<string, unknown>;

function collectVideos(node: unknown, out: SearchTrack[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideos(item, out);
    return;
  }

  const obj = node as Json;
  const renderer = obj.videoRenderer as
    | {
        videoId?: string;
        title?: { runs?: { text?: string }[] };
        ownerText?: { runs?: { text?: string }[] };
        lengthText?: { simpleText?: string };
        thumbnail?: { thumbnails?: { url?: string }[] };
      }
    | undefined;

  if (renderer?.videoId && renderer.title?.runs?.[0]?.text) {
    const thumbs = renderer.thumbnail?.thumbnails ?? [];
    out.push({
      id: renderer.videoId,
      youtubeId: renderer.videoId,
      title: renderer.title.runs[0].text,
      author: renderer.ownerText?.runs?.[0]?.text ?? "",
      duration: renderer.lengthText?.simpleText ?? "",
      thumbnail: thumbs[thumbs.length - 1]?.url ?? "",
    });
  }

  for (const value of Object.values(obj)) collectVideos(value, out);
}

export async function searchYouTube(query: string): Promise<SearchTrack[]> {
  const response = await fetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Youtube-Client-Name": "1",
      "X-Youtube-Client-Version": WEB_VERSION,
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
      "User-Agent": VISIONOS_USER_AGENT,
    },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: WEB_VERSION, hl: "en", gl: "US" } },
      query,
    }),
  });

  if (!response.ok) throw new Error(`YouTube search failed (${response.status})`);

  const found: SearchTrack[] = [];
  collectVideos(await response.json(), found);

  const seen = new Set<string>();
  return found.filter((track) => {
    if (seen.has(track.youtubeId)) return false;
    seen.add(track.youtubeId);
    return true;
  }).slice(0, 15);
}

export async function searchSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const text = await response.text();
  const json = JSON.parse(text.replace(/^[^(]*\(|\)[^)]*$/g, "")) as [string, unknown[]];
  return (json[1] ?? [])
    .map((item) => (Array.isArray(item) ? String(item[0]) : String(item)))
    .slice(0, 8);
}