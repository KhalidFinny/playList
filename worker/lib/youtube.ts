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

let visitorData = "";

async function ensureVisitor(fresh = false): Promise<string> {
  if (!fresh && visitorData) return visitorData;

  const response = await fetch(VISITOR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Youtube-Client-Name": "67",
      "X-Youtube-Client-Version": "1.20250219.01.00",
      Origin: "https://music.youtube.com",
      Referer: "https://music.youtube.com/",
      "User-Agent": VISIONOS_USER_AGENT,
    },
    body: JSON.stringify({
      context: {
        client: { clientName: "WEB_REMIX", clientVersion: "1.20250219.01.00", hl: "en", gl: "US" },
      },
    }),
  });

  if (!response.ok) throw new Error(`YouTube visitor request failed (${response.status})`);
  const data = (await response.json()) as { responseContext?: { visitorData?: string } };
  visitorData = data.responseContext?.visitorData ?? "";
  return visitorData;
}

export async function resolveAudio(videoId: string): Promise<AudioStream> {
  const visitor = await ensureVisitor();
  let lastError = new Error("No playable audio format found");

  for (const client of CLIENTS) {
    try {
      return await resolveWith(client, videoId, visitor);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[youtube] ${client.name} refused ${videoId}: ${lastError.message}`);
    }
  }

  // A stale visitor is the usual cause of a refusal, so one retry with a new
  // one costs a request and rescues the common case.
  visitorData = "";
  const fresh = await ensureVisitor(true);
  for (const client of CLIENTS) {
    try {
      return await resolveWith(client, videoId, fresh);
    } catch {
      // Every client has now been tried; fall through to the last error.
    }
  }

  throw lastError;
}

async function resolveWith(client: PlayerClient, videoId: string, visitor: string): Promise<AudioStream> {
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

  if (data.responseContext?.visitorData) visitorData = data.responseContext.visitorData;

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