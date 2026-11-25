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

let holdLimit: ReturnType<typeof setTimeout> | undefined;

type WipeState = {
  phase: Phase;
  /** Runs once the circle fully covers the screen. */
  onCovered: (() => void) | null;
  /** The pathname the wipe started from, so the destination can be detected. */
  fromPath: string | null;
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
  start: (onCovered, fromPath) => {
    // A second click mid-wipe should still navigate, never be swallowed.
    if (get().phase !== "idle") {
      onCovered();
      return;
    }
    set({ phase: "covering", onCovered, fromPath });
  },
  covered: () => {
    // The same callback fires for the reveal fade, so only the cover counts.
    if (get().phase !== "covering") return;
    get().onCovered?.();
    set({ phase: "holding", onCovered: null });

    clearTimeout(holdLimit);
    holdLimit = setTimeout(() => {
      if (get().phase === "holding") set({ phase: "idle", fromPath: null });
    }, HOLD_LIMIT_MS);
  },
  arrived: () => {
    // Only the hold phase ends here; a late call during covering is ignored.
    if (get().phase !== "holding") return;
    clearTimeout(holdLimit);
    set({ phase: "idle", fromPath: null });
  },
  finished: () => set({ phase: "idle", fromPath: null }),
}));
