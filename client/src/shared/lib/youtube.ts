/**
 * YouTube artwork for a video id.
 *
 * The server stores no thumbnail for a queued song: `QueueSong` has no such field,
 * so `Track.thumbnail` is always undefined and every artwork slot in the app fell
 * back to a placeholder shape. The URL is derivable from the video id, so it is
 * built here instead of being carried through the queue, Redis and the database.
 *
 * `mqdefault` is 320x180 (16:9) and is the smallest size that stays sharp in a
 * 48px square crop on a 2x display.
 */
export function youTubeThumbnail(youtubeId: string, quality: "mq" | "hq" = "mq"): string {
  return `https://i.ytimg.com/vi/${youtubeId}/${quality}default.jpg`;
}

/**
 * The thumbnail to render for a track, preferring a stored one.
 *
 * Search results carry a real thumbnail, so those win; queued tracks have none and
 * fall back to the derived URL. Returns undefined when there is no track or no id
 * to derive from, so callers can still show their placeholder.
 */
export function trackThumbnail(
  track: { youtubeId?: string; thumbnail?: string | null } | null | undefined,
): string | undefined {
  if (!track) return undefined;
  return track.thumbnail || (track.youtubeId ? youTubeThumbnail(track.youtubeId) : undefined);
}
