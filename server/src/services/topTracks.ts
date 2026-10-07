import { sql } from "../db/client";
import { TtlLruCache } from "../lib/ttlCache";
import { registerPrunable } from "../lib/prune";

/** A charted song, aggregated across every station. */
export type TopTrack = {
  youtubeId: string;
  title: string;
  author: string;
  /** How many times the track was requested and accepted this week. */
  requests: number;
};

/** The window a track must have been requested in to chart. */
const WINDOW = "7 days";

/** How many tracks the chart returns. */
export const TOP_TRACKS_LIMIT = 10;

/**
 * The chart is identical for every caller and moves slowly, so it is cached. One
 * key: there is exactly one chart.
 */
const CACHE_TTL_MS = 60_000;
const cache = new TtlLruCache<TopTrack[]>(CACHE_TTL_MS, 1);
registerPrunable(cache);

/**
 * The ten most-requested tracks of the last seven days, across all stations.
 *
 * The metric is **accepted requests**, not completed plays. Plays are driven
 * entirely by requests in this app, and only a handful of tracks ever reach
 * `done`, so a play-based chart would sit empty while a request-based one reflects
 * what people actually wanted this week. `pending` is excluded — those are
 * unmoderated, so counting them would let a spam run chart a track.
 *
 * Grouping is by `youtube_id` so the same video requested with slightly different
 * titles charts once; title and author come from the most recent row.
 *
 * Backed by `songs_charted_idx` (status, created_at).
 */
export async function getTopTracks(): Promise<TopTrack[]> {
  const cached = cache.get("top");
  if (cached) return cached;

  const rows = await sql<{ youtube_id: string; title: string; author: string; requests: number }[]>`
    SELECT
      youtube_id,
      (array_agg(title ORDER BY created_at DESC))[1] AS title,
      (array_agg(author ORDER BY created_at DESC))[1] AS author,
      COUNT(*)::int AS requests
    FROM songs
    WHERE status IN ('approved', 'playing', 'done')
      AND created_at >= NOW() - ${WINDOW}::interval
    GROUP BY youtube_id
    ORDER BY requests DESC, MAX(created_at) DESC
    LIMIT ${TOP_TRACKS_LIMIT}
  `;

  const tracks: TopTrack[] = rows.map((row) => ({
    youtubeId: row.youtube_id,
    title: row.title,
    author: row.author ?? "",
    requests: row.requests,
  }));

  cache.set("top", tracks);
  return tracks;
}
