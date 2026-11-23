import { create } from "zustand";

type Phase = "idle" | "covering";

type WipeState = {
  phase: Phase;
  /** Runs once the circle fully covers the screen. */
  onCovered: (() => void) | null;
  start: (onCovered: () => void) => void;
  covered: () => void;
};

/**
 * The circle wipe out of the landing page.
 *
 * It only covers. The circle grows from the middle until the screen is one flat
 * colour, the navigation happens underneath it, and then it is removed in the same
 * frame, so the next page's own fade-in is what the visitor sees. Contracting the
 * circle over the destination made the wipe the star of the next page too, which
 * is why it read as two animations instead of one departure.
 *
 * A store rather than component state because the two ends live in different
 * places: the landing starts it, and the root renders it above every route.
 */
export const useWipeStore = create<WipeState>((set, get) => ({
  phase: "idle",
  onCovered: null,
  start: (onCovered) => {
    // A second click mid-wipe should still navigate, never be swallowed.
    if (get().phase !== "idle") {
      onCovered();
      return;
    }
    set({ phase: "covering", onCovered });
  },
  covered: () => {
    get().onCovered?.();
    set({ phase: "idle", onCovered: null });
  },
}));
