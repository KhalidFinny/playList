import { motion } from "framer-motion";

import { useWipeStore } from "@/shared/lib/routeWipe";

/**
 * Duration of the cover, and its curve.
 *
 * A strong ease-in-out (0.65/0/0.35/1) rather than the shallow default: the circle
 * starts slowly, accelerates through the middle where it covers the most area, and
 * settles as it fills the screen. A constant rate looks mechanical at this size.
 */
const COVER_S = 0.72;
const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

/**
 * The circle that wipes the screen as the landing page is left.
 *
 * It covers and stops there. Rendered by the root, above every route, so it
 * survives the navigation it is hiding; when it finishes it removes itself and the
 * destination's own fade-in takes over. Decorative and never interactive:
 * `pointer-events-none` means a click during the wipe reaches the page underneath.
 */
export function CircleWipe() {
  const phase = useWipeStore((state) => state.phase);
  const covered = useWipeStore((state) => state.covered);

  if (phase === "idle") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-200 overflow-hidden" aria-hidden="true">
      <motion.div
        // Sized past the viewport diagonal at scale 1, so a full circle covers
        // every corner regardless of aspect ratio.
        className="absolute left-1/2 top-1/2 size-[200vmax] -translate-x-1/2 -translate-y-1/2 rounded-m3-full bg-surface"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: COVER_S, ease: EASE }}
        onAnimationComplete={covered}
      />
    </div>
  );
}
