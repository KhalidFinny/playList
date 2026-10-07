import { useEffect, useState } from "react";

export interface TopTrack {
  youtubeId: string;
  title: string;
  author: string;
  /** How many times the track was requested and accepted this week. */
  requests: number;
}

/**
 * The week's most-played tracks, for the chart under the search bar.
 *
 * Fetched over HTTP rather than Socket.IO: the chart is public, identical for
 * every caller, and unrelated to room state, so it does not belong on the socket.
 * A failure is swallowed to an empty list — the chart is a convenience, and the
 * search itself must not break because it is unavailable.
 */
export function useTopTracks() {
  const [tracks, setTracks] = useState<TopTrack[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/top-tracks", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { tracks?: TopTrack[] }) => setTracks(data.tracks ?? []))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[TOP-TRACKS] Unavailable:", err instanceof Error ? err.message : err);
        setTracks([]);
      });

    return () => controller.abort();
  }, []);

  return tracks;
}
