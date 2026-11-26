import { AnimatePresence, motion } from "framer-motion";

import { COVER_S, REVEAL_S, useWipeStore } from "@/shared/lib/routeWipe";

/**
 * The cover's curve.
 *
 * A strong ease-in-out (0.65/0/0.35/1) rather than the shallow default: the circle
 * starts slowly, accelerates through the middle where it covers the most area, and
 * settles as it fills the screen. A constant rate looks mechanical at this size,
 * and at a second long the opening and closing of the curve are what you feel.
 */
const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

/**
 * The circle that wipes the screen as the landing page is left.
 *
 * It covers, then holds, then fades. The hold is what makes it correct: the
 * navigation takes as long as its route chunks take to arrive, and the overlay has
 * to stay opaque for all of it. Releasing it when the circle finished growing let
 * the landing page show through until the new route rendered.
 *
 * Rendered by the root, above every route, so it survives the navigation it is
 * covering. Decorative and never interactive: `pointer-events-none` means a click
 * during the wipe reaches the page underneath.
 */
export function CircleWipe() {
  const phase = useWipeStore((state) => state.phase);
  const covered = useWipeStore((state) => state.covered);
  const visible = phase !== "idle";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="wipe"
          exit={{ opacity: 0 }}
          transition={{ duration: REVEAL_S, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-200 overflow-hidden"
          aria-hidden="true"
        >
          <motion.div
            // The viewport diagonal (0.551 x vmax radius each way), so the circle
            // reaches the corners exactly when the animation ends. It used to be
            // 200vmax, which covered the screen at a quarter of the scale, so three
            // quarters of the duration ran behind an already-full screen and the
            // wipe read as instant no matter how long the duration was.
            // The fill must be the next page's surface, or the reveal shows a
            // colour change. That leaves the edge invisible in dark mode, where
            // the landing (#050505) and the surface (#141313) are nearly the same
            // black. The halo is one tonal step brighter, so it only reads where
            // there is contrast to show — a soft edge in dark, nothing in light.
            className="absolute left-1/2 top-1/2 size-[111vmax] -translate-x-1/2 -translate-y-1/2 rounded-m3-full bg-surface shadow-[0_0_120px_40px_var(--color-surface-container-high)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: COVER_S, ease: EASE }}
            onAnimationComplete={covered}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
