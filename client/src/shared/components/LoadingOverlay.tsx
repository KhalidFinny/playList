import { motion, AnimatePresence } from "framer-motion";

import { Logo } from "@/shared/components/Logo";
import { WavyCircularProgress } from "@/shared/components/wavy-circular-progress";
import { transitions } from "@/shared/motion/springs";

interface LoadingOverlayProps {
  isLoading: boolean;
}

const RING_SIZE = 116;
const LOGO_SIZE = 76;

/**
 * Splash: the brand mark with the wavy ring circling it. Nothing else.
 *
 * Rendered on `surface` in both modes. The mark is transparent artwork, so it
 * takes whatever surface it sits on.
 */
export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitions.slow}
          className="fixed inset-0 z-100 flex items-center justify-center bg-surface"
        >
          <div className="relative flex items-center justify-center">
            <WavyCircularProgress
              size={RING_SIZE}
              label="Loading"
              className="absolute text-primary"
            />
            {/* The mark's ink is not centred in its own viewBox (bbox x 89..1754 of
                1990, so its centre is at 46.3%), which leaves the ring visibly
                tighter on one side. Corrected here, not in `Logo`, so the mark in
                every header keeps its existing alignment. */}
            <Logo size={LOGO_SIZE} className="translate-x-[3.7%]" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
