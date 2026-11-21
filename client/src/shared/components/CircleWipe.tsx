import { motion } from "framer-motion";

import { useWipeStore } from "@/shared/lib/routeWipe";

/** Duration of each half. Both use the same curve, so the two read as one move. */
const HALF_S = 0.42;

/**
 * The circle that wipes the screen between the landing page and the room code.
 *
 * Rendered by the root, above every route, so it survives the navigation it is
 * covering. It is decorative and never interactive: `pointer-events-none` means a
 * click during the wipe reaches the page underneath rather than being eaten.
 */
export function CircleWipe() {
  const phase = useWipeStore((state) => state.phase);
  const covered = useWipeStore((state) => state.covered);
  const finished = useWipeStore((state) => state.finished);

  if (phase === "idle") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-200 overflow-hidden" aria-hidden="true">
      <motion.div
        // Sized past the viewport diagonal at scale 1, so a full circle covers
        // every corner regardless of aspect ratio.
        className="absolute left-1/2 top-1/2 size-[200vmax] -translate-x-1/2 -translate-y-1/2 rounded-m3-full bg-surface"
        initial={{ scale: 0 }}
        animate={{ scale: phase === "covering" ? 1 : 0 }}
        transition={{ duration: HALF_S, ease: "easeInOut" }}
        onAnimationComplete={() => (phase === "covering" ? covered() : finished())}
      />
    </div>
  );
}
