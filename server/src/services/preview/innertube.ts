// Resolves a direct YouTube audio URL with one player request.
//
// The VISIONOS (Apple Vision Pro) client is the one that still lists audio
// formats with plain signed URLs, so no signature solving and no JS challenge.
// It needs an anonymous visitor id first, otherwise the player answers with a
// bot check. Same approach as Meiro's `AudioStream`.

const PLAYER_ENDPOINT = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const VISITOR_ENDPOINT = "https://music.youtube.com/youtubei/v1/visitor_id?prettyPrint=false";

const MUSIC_CLIENT = {
  clientName: "WEB_REMIX",
  clientVersion: "1.20250219.01.00",
  hl: "en",
  gl: "US",
} as const;

const VISIONOS_CLIENT = {
  clientName: "VISIONOS",
  clientVersion: "1.02",
  deviceMake: "Apple",
  deviceModel: "RealityDevice17,1",
  osName: "visionOS",
  osVersion: "26.5.23O471",
  hl: "en",
  gl: "US",
} as const;

const VISIONOS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

export type AudioStream = {
  url: string;
  mimeType: string;
  expiresAt: number;
  /**
   * The track's own integrated loudness in LUFS, as YouTube measured it.
   * Negative, around -8 for a loud master and -18 for a quiet one. `null` when
   * the player response carries no measurement, in which case the client falls
   * back to decoding a slice of the stream.
   */
  loudnessLufs: number | null;
};

type AdaptiveFormat = {
  mimeType: string;
  bitrate?: number;
  url?: string;
  isDrc?: boolean;
  audioTrack?: { audioIsDefault?: boolean };
  trackAbsoluteLoudnessLkfs?: number;
  loudnessDb?: number;
};

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
  responseContext?: { visitorData?: string };
  playerConfig?: { audioConfig?: { perceptualLoudnessDb?: number; loudnessTargetLkfs?: number } };
};

let visitorData = "";

async function ensureVisitor(): Promise<string> {
  if (visitorData) return visitorData;

  const response = await fetch(VISITOR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": "67",
      "X-YouTube-Client-Version": MUSIC_CLIENT.clientVersion,
      Origin: "https://music.youtube.com",
      Referer: "https://music.youtube.com/",
      "User-Agent": VISIONOS_USER_AGENT,
    },
    body: JSON.stringify({ context: { client: MUSIC_CLIENT } }),
  });

  if (!response.ok) throw new Error(`YouTube visitor request failed (${response.status})`);

  const data = (await response.json()) as { responseContext?: { visitorData?: string } };
  visitorData = data.responseContext?.visitorData ?? "";
  return visitorData;
}

export async function resolveAudioStream(videoId: string): Promise<AudioStream> {
  const visitor = await ensureVisitor();

  const response = await fetch(PLAYER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": "101",
      "X-YouTube-Client-Version": VISIONOS_CLIENT.clientVersion,
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
      "User-Agent": VISIONOS_USER_AGENT,
      ...(visitor ? { "X-Goog-Visitor-Id": visitor } : {}),
    },
    body: JSON.stringify({
      context: { client: { ...VISIONOS_CLIENT, visitorData: visitor } },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`YouTube player request failed (${response.status})`);
  }

  const data = (await response.json()) as PlayerResponse;

  if (data.responseContext?.visitorData) visitorData = data.responseContext.visitorData;

  const status = data.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(`Video is not playable (${status}: ${data.playabilityStatus?.reason ?? ""})`);
  }

  const best = (data.streamingData?.adaptiveFormats ?? [])
    .filter(
      (format) =>
        format.mimeType.startsWith("audio/") &&
        format.url &&
        !format.isDrc &&
        (format.audioTrack?.audioIsDefault ?? true),
    )
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

  if (!best?.url) throw new Error("No playable audio format found");

  // The media server occasionally refuses a URL the player just issued; find
  // that out here, where the caller can fall back, rather than mid-playback.
  const probe = await fetch(best.url, {
    headers: { Range: "bytes=0-0", "User-Agent": VISIONOS_USER_AGENT },
  });
  if (!probe.ok && probe.status !== 206) {
    throw new Error(`Audio URL refused by the media server (${probe.status})`);
  }

  const expire = Number(new URL(best.url).searchParams.get("expire"));
  // The per-format value is the track's own measurement; the player-level one is
  // the same number when YouTube only reports it once. Both are LUFS, negative.
  const measured = best.trackAbsoluteLoudnessLkfs ?? data.playerConfig?.audioConfig?.perceptualLoudnessDb;
  return {
    url: best.url,
    mimeType: best.mimeType,
    expiresAt: Number.isFinite(expire) && expire > 0 ? expire * 1000 : Date.now() + 60 * 60 * 1000,
    loudnessLufs: typeof measured === "number" && Number.isFinite(measured) ? measured : null,
  };
}