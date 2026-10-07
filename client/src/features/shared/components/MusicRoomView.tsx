import { motion } from "framer-motion";
import { SkipBack, SkipForward } from "lucide-react";
import { Turntable } from "./Turntable";
import { MiniVinyl } from "./MiniVinyl";
import { TrackMetadata } from "@/features/music-room/components/TrackMetadata";
import { StationSequence } from "@/features/music-room/components/StationSequence";
import { Shape } from "@/shared/shapes/shape";
import { transitions } from "@/shared/motion/springs";
import { trackThumbnail } from "@/shared/lib/youtube";
import { cn } from "@/shared/lib/utils";
import type { Track } from "@/shared/types";

interface MusicRoomViewProps {
  roomId: string;
  nowPlaying: Track | null;
  queue: Track[];
  isPlaying: boolean;
  progress: number;
  currentTime?: number;
  duration?: number;
  role: "admin" | "participant";
  hasPreviousTrack?: boolean;
  onSkip?: () => void;
  onPrevious?: () => void;
  onTogglePlay?: () => void;
  onGoToSearch?: () => void;
}

/**
 * One transport button. Admin-only: participants have no controls at all.
 *
 * When the action is unavailable the button keeps its space and becomes inert
 * rather than disappearing, so the disc does not shift sideways between tracks.
 */
function TransportButton({
  kind,
  enabled,
  onClick,
}: {
  kind: "previous" | "next";
  enabled: boolean;
  onClick?: () => void;
}) {
  const isPrevious = kind === "previous";

  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-label={isPrevious ? "Previous track" : "Next track"}
      className={cn(
        "state-layer flex size-12 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "lg:size-14",
        !enabled && "pointer-events-none opacity-38",
      )}
    >
      {isPrevious ? <SkipBack size={26} /> : <SkipForward size={26} />}
    </button>
  );
}

/**
 * The listening room — liner-notes layout.
 *
 * Liner notes on the **left** (artwork, now-playing metadata, queue) and the disc
 * on the **right**. Previously the disc led; the information column now leads,
 * which reads like a record sleeve with the disc beside it.
 *
 * Transport lives **on the vinyl**: play/pause is the disc's centre label and
 * prev/next flank it. Participants get no transport at all, so their disc carries
 * no centre control.
 */
export function MusicRoomView({
  roomId,
  nowPlaying,
  queue,
  isPlaying,
  progress,
  currentTime = 0,
  duration = 0,
  role,
  hasPreviousTrack = false,
  onSkip,
  onPrevious,
  onTogglePlay,
  onGoToSearch,
}: MusicRoomViewProps) {
  const isAdmin = role === "admin";
  const hasNextTrack = queue.length > 0;
  // Queued tracks carry no stored thumbnail, so this falls back to the one
  // derived from the video id.
  const trackArtwork = nowPlaying ? trackThumbnail(nowPlaying) : undefined;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto px-4 pb-8 lg:flex-row lg:items-center lg:gap-10 lg:overflow-hidden lg:px-6 lg:pb-6">
      {/* Liner notes */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transitions.base}
        className="flex w-full shrink-0 flex-col gap-6 lg:w-[400px] lg:justify-center"
      >
        <div className="flex items-start gap-5">
          <div className="hidden size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-m3-lg bg-surface-container-high sm:flex">
            {trackArtwork ? (
              <img src={trackArtwork} alt="" className="size-full object-cover" />
            ) : (
              <Shape name="cookie12" size={48} className="text-on-surface-variant" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <TrackMetadata
              track={nowPlaying}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
            />
          </div>
        </div>

        <StationSequence queue={queue} roomId={roomId} onAddToQueue={onGoToSearch} />
      </motion.aside>

      {/* Disc. Height-capped as well as width-capped: it is square, so a
          width-only cap overflows the frame on short viewports. */}
      <section className="flex w-full shrink-0 items-center justify-center gap-3 lg:min-w-0 lg:flex-1 lg:gap-6">
        {isAdmin && (
          <TransportButton kind="previous" enabled={hasPreviousTrack} onClick={onPrevious} />
        )}

        <div className="w-full max-w-[240px] lg:max-w-[min(560px,calc(100vh-15rem))]">
          <div className="lg:hidden">
            <MiniVinyl
              isPlaying={isPlaying}
              thumbnail={trackArtwork}
              onToggle={isAdmin ? onTogglePlay : undefined}
            />
          </div>
          <div className="hidden lg:block">
            <Turntable
              isPlaying={isPlaying}
              progress={progress}
              thumbnail={trackArtwork}
              onToggle={isAdmin ? onTogglePlay : undefined}
            />
          </div>
        </div>

        {isAdmin && <TransportButton kind="next" enabled={hasNextTrack} onClick={onSkip} />}
      </section>
    </div>
  );
}
