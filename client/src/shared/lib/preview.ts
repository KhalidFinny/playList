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

export async function fetchStream(videoId: string): Promise<ResolvedStream> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`/api/preview/${videoId}`);
      if (!res.ok) throw new Error(`stream resolve failed (${res.status})`);
      return (await res.json()) as ResolvedStream;
    } catch (err) {
      lastError = err;
      if (attempt < ATTEMPTS) await new Promise((done) => setTimeout(done, BACKOFF_MS * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("stream resolve failed");
}
