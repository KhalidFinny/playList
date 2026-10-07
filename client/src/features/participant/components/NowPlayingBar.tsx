import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Shape } from "@/shared/shapes/shape";
import { ShapeMorph } from "@/shared/shapes/shape-morph";
import { transitions } from "@/shared/motion/springs";
import { cn } from "@/shared/lib/utils";
import { trackThumbnail } from "@/shared/lib/youtube";
import type { Track } from "@/shared/types";

interface NowPlayingBarProps {
  nowPlaying: Track | null;
  roomId: string;
  isVisible: boolean;
  /** Drives the live indicator's morph; it holds still when paused. */
  isPlaying?: boolean;
}

/**
 * M3 mini-player. Sits on `surface-container-high` with a functional elevation
 * shadow, not a translucent blur — blur over moving album art destroys the label
 * contrast behind it.
 *
 * The live indicator is the M3 Expressive shape morph, animating only while audio
 * is playing.
 */
export function NowPlayingBar({
  nowPlaying,
  roomId,
  isVisible,
  isPlaying = false,
}: NowPlayingBarProps) {
  // Queued tracks carry no stored thumbnail; this falls back to the derived one.
  const artwork = trackThumbnail(nowPlaying);

  return (
    <AnimatePresence>
      {isVisible && nowPlaying && (
        <motion.div
          initial={{ y: 96 }}
          animate={{ y: 0 }}
          exit={{ y: 96 }}
          transition={transitions.base}
          className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 bg-surface-container-high p-4 elevation-3 md:px-8"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-m3-sm bg-inverse-surface">
              {artwork ? (
                <img src={artwork} alt="" className="size-full object-cover" />
              ) : (
                <Shape name="cookie12" size={36} className="text-inverse-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-label-medium text-primary">
                <ShapeMorph
                  size={16}
                  active={isPlaying}
                  className={cn("shrink-0", !isPlaying && "text-on-surface-variant")}
                />
                {isPlaying ? "Live broadcast" : "Paused"}
              </p>
              <h3 className="mt-0.5 truncate text-title-small">{nowPlaying.title}</h3>
              <p className="truncate text-body-small text-on-surface-variant">
                {nowPlaying.author}
              </p>
            </div>
          </div>

          <Link
            to="/r/$roomId"
            params={{ roomId }}
            className="state-layer flex h-10 shrink-0 items-center gap-2 rounded-m3-full bg-primary px-5 text-label-large text-on-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Play size={18} fill="currentColor" />
            Open room
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
