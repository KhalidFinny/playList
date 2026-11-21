import { create } from "zustand";

type Phase = "idle" | "covering" | "revealing";

type WipeState = {
  phase: Phase;
  /** Runs at the moment the circle fully covers the screen. */
  onCovered: (() => void) | null;
  start: (onCovered: () => void) => void;
  covered: () => void;
  finished: () => void;
};

/**
 * The circle wipe between the landing page and the room-code page.
 *
 * A store rather than component state because the two ends live in different
 * places: the landing page starts it, and the root renders it, above every route.
 *
 * The circle covers the screen, the navigation happens while it is covered, then
 * it contracts to reveal the new page. Swapping while covered is what keeps the
 * two pages from ever being visible at once, which a plain fade cannot do when
 * the outgoing page is dark and the incoming one is light.
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
    set({ phase: "revealing", onCovered: null });
  },
  finished: () => set({ phase: "idle" }),
}));
