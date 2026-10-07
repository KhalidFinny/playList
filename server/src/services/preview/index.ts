import { resolveAudioStream, type AudioStream } from "./innertube";

// Signed googlevideo URLs live ~6h. Re-resolve a minute before expiry so a
// stream that is already playing never gets handed a dead URL.
const EXPIRY_MARGIN_MS = 60 * 1000;

const cache = new Map<string, AudioStream>();

export async function getAudioStream(videoId: string): Promise<AudioStream> {
  const cached = cache.get(videoId);
  if (cached && cached.expiresAt - Date.now() > EXPIRY_MARGIN_MS) {
    return cached;
  }

  const stream = await resolveAudioStream(videoId);
  cache.set(videoId, stream);
  return stream;
}

export type { AudioStream };
