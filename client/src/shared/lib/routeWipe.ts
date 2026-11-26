import { create } from "zustand";

type Phase = "idle" | "covering" | "holding";

/**
 * How long the overlay may stay covered if the route never arrives.
 *
 * A navigation that fails, or a chunk that 404s after a deploy, would otherwise
 * leave the screen covered for good, which is far worse than the flash this
 * replaced. After this the overlay releases and the app shows whatever it has.
 */
const HOLD_LIMIT_MS = 6000;

/**
 * The wipe's own timings, in seconds and milliseconds.
 *
 * They live here rather than in the component because the navigation has to be
 * timed against them: it starts partway through the cover so the destination is
 * painted by the time the circle fills the screen.
 */
export const COVER_S = 1;
export const REVEAL_S = 0.34;
/** Matches the reveal fade, so `hiding` covers it exactly. */
const REVEAL_MS = REVEAL_S * 1000;

/**
 * When the destination navigation starts, as a fraction of the cover.
 *
 * Late enough that the landing still fills the corners for most of the growth,
 * early enough that the room-code page has mounted and painted before the
 * circle completes.
 */
export const NAVIGATE_AT_MS = COVER_S * 1000 * 0.45;

let holdLimit: ReturnType<typeof setTimeout> | undefined;

type WipeState = {
  phase: Phase;
  /** Runs once the circle fully covers the screen. */
  onCovered: (() => void) | null;
  /** The pathname the wipe started from, so the destination can be detected. */
  fromPath: string | null;
  /**
   * True from the moment a wipe covers until it has finished revealing.
   *
   * The route content checks this and skips its entrance fade. Otherwise the
   * destination mounts at opacity zero and fades in over 200ms, so the circle
   * opens onto the page's background instead of its content — which reads as a
   * blank white screen during the wipe.
   */
  hiding: boolean;
  /**
   * The router landed while the circle was still growing.
   *
   * Navigation starts before the cover finishes, so the destination can arrive
   * first. Recording it means the cover releases as soon as it completes instead
   * of waiting for a second call that will never come — which left the overlay
   * stuck opaque.
   */
  arrivedEarly: boolean;
  start: (onCovered: () => void, fromPath: string) => void;
  covered: () => void;
  /** Called by the root once the router is on a different path. */
  arrived: () => void;
  finished: () => void;
};

/**
 * The circle wipe out of the landing page.
 *
 * Three phases, and the third one is the whole point: `covering` grows the circle,
 * `holding` keeps it opaque while the next route loads, and only then is it faded
 * out.
 *
 * Removing the overlay the moment the circle finished covering was wrong. Route
 * chunks take time to arrive, so the landing stayed visible underneath a screen
 * that had already been dismissed, and the visitor saw the landing page come back
 * for a moment before the new one appeared. The overlay has to outlive the load,
 * not just the animation.
 *
 * A store rather than component state because the two ends live in different
 * places: the landing starts it, and the root renders it above every route and
 * knows when the router has moved.
 */
export const useWipeStore = create<WipeState>((set, get) => ({
  phase: "idle",
  onCovered: null,
  fromPath: null,
  hiding: false,
  arrivedEarly: false,
  start: (onCovered, fromPath) => {
    // A second click mid-wipe should still navigate, never be swallowed.
    if (get().phase !== "idle") {
      onCovered();
      return;
    }
    set({ phase: "covering", onCovered, fromPath, hiding: true, arrivedEarly: false });
  },
  covered: () => {
    // The same callback fires for the reveal fade, so only the cover counts.
    if (get().phase !== "covering") return;
    get().onCovered?.();
    set({ phase: "holding", onCovered: null });

    // The route is already here, so there is nothing to hold for.
    if (get().arrivedEarly) {
      get().arrived();
      return;
    }

    clearTimeout(holdLimit);
    holdLimit = setTimeout(() => {
      if (get().phase === "holding")
        set({ phase: "idle", fromPath: null, hiding: false, arrivedEarly: false });
    }, HOLD_LIMIT_MS);
  },
  arrived: () => {
    // Navigation starts under the growing circle, so arrival can precede the
    // cover. Remember it rather than dropping it.
    if (get().phase === "covering") {
      set({ arrivedEarly: true });
      return;
    }
    if (get().phase !== "holding") return;
    clearTimeout(holdLimit);
    set({ phase: "idle", fromPath: null, arrivedEarly: false });
    // Released only after the reveal fade, so the fade-in the route would have
    // done is not restarted underneath a circle that is still shrinking.
    holdLimit = setTimeout(() => set({ hiding: false }), REVEAL_MS);
  },
  finished: () => set({ phase: "idle", fromPath: null, hiding: false, arrivedEarly: false }),
}));
