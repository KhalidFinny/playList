// Resolves a direct YouTube audio URL with a single HTTP call.
//
// The ANDROID_VR (Oculus) innertube client is served plain signed URLs with no
// signatureCipher to decode, so this needs no yt-dlp binary, no subprocess, and
// no cookie jar — just fetch. Replaces `yt-dlp --get-url`.

const PLAYER_ENDPOINT = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const ANDROID_VR_CLIENT = {
  clientName: "ANDROID_VR",
  clientVersion: "1.60.19",
  deviceMake: "Oculus",
  deviceModel: "Quest 3",
  androidSdkVersion: 32,
  osName: "Android",
  osVersion: "12",
  hl: "en",
  gl: "US",
} as const;

const USER_AGENT =
  "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; GB) gzip";

export type AudioStream = {
  url: string;
  mimeType: string;
  expiresAt: number;
};

type AdaptiveFormat = {
  itag: number;
  mimeType: string;
  bitrate?: number;
  url?: string;
  signatureCipher?: string;
};

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
};

export async function resolveAudioStream(videoId: string): Promise<AudioStream> {
  const response = await fetch(PLAYER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Youtube-Client-Name": "28",
      "X-Youtube-Client-Version": ANDROID_VR_CLIENT.clientVersion,
      Origin: "https://www.youtube.com",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      context: { client: ANDROID_VR_CLIENT },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`YouTube player request failed (${response.status})`);
  }

  const data = (await response.json()) as PlayerResponse;

  const status = data.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(`Video is not playable (${status})`);
  }

  const formats = data.streamingData?.adaptiveFormats ?? [];
  const best = formats
    .filter((format) => format.url && !format.signatureCipher && format.mimeType.startsWith("audio/"))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

  if (!best?.url) {
    throw new Error("No playable audio format found");
  }

  const expire = Number(new URL(best.url).searchParams.get("expire"));
  return {
    url: best.url,
    mimeType: best.mimeType,
    expiresAt: Number.isFinite(expire) && expire > 0 ? expire * 1000 : Date.now() + 60 * 60 * 1000,
  };
}
