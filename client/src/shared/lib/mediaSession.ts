import type { Track } from "@/shared/types";
import { trackThumbnail } from "./youtube";

type Handlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

/**
 * The lock-screen / notification player.
 *
 * A page whose only output is an `<audio>` element keeps playing when the screen
 * locks, but without a media session the OS shows no controls and, on some
 * Android builds, tears the page down once the notification is dismissed. Setting
 * the metadata and the action handlers is what keeps the session alive and gives
 * the listener a pause button on the lock screen.
 *
 * Every call is guarded: Safari on iOS exposes `navigator.mediaSession` but not
 * every action, and setting an unsupported action throws.
 */
export function setMediaSession(track: Track | null, handlers: Handlers): void {
  if (!("mediaSession" in navigator)) return;

  if (!track) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    return;
  }

  const artwork = trackThumbnail(track);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || track.author,
    artwork: artwork ? [{ src: artwork, sizes: "320x180", type: "image/jpeg" }] : [],
  });

  const actions: Array<[MediaSessionAction, (() => void) | undefined]> = [
    ["play", handlers.onPlay],
    ["pause", handlers.onPause],
    ["nexttrack", handlers.onNext],
    ["previoustrack", handlers.onPrevious],
  ];

  for (const [action, handler] of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, handler ? () => handler() : null);
    } catch {
      // The action does not exist on this platform.
    }
  }
}

export function setMediaSessionPlaybackState(isPlaying: boolean): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
}
