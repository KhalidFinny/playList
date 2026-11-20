/**
 * Resolves a video's same-origin stream URL.
 *
 * The resolver is a YouTube player call behind the scenes, so it can be refused
 * for a moment (bot check, rate limit) and answer on the next try. One refusal
 * used to drop the track onto the iframe fallback, which cannot start without a
 * tap, so the room went silent until the host refreshed and pressed next.
 *
 * Retries are short and bounded: the caller needs to know quickly whether to
 * fall back, not to keep the room waiting.
 */
export type ResolvedStream = {
  url: string;
  loudnessLufs?: number | null;
};

const ATTEMPTS = 3;
const BACKOFF_MS = 700;

/**
 * @param fresh skip the server's resolved-URL cache. Used by the playback
 *   watchdog: a cached URL the media server has started refusing is exactly what
 *   it is trying to get away from.
 */
export async function fetchStream(videoId: string, fresh = false): Promise<ResolvedStream> {
  let lastError: unknown;
  const query = fresh ? "?fresh=1" : "";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`/api/preview/${videoId}${query}`);
      if (!res.ok) throw new Error(`stream resolve failed (${res.status})`);
      return (await res.json()) as ResolvedStream;
    } catch (err) {
      lastError = err;
      if (attempt < ATTEMPTS) await new Promise((done) => setTimeout(done, BACKOFF_MS * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("stream resolve failed");
}
