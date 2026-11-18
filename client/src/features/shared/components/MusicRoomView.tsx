import { motion } from "framer-motion";
import { SkipBack, SkipForward } from "lucide-react";
import { Turntable } from "./Turntable";
import { MiniVinyl } from "./MiniVinyl";
import { SeekRow, TrackMetadata } from "@/features/music-room/components/TrackMetadata";
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
  onSeek?: (value: number, committed: boolean) => void;
  role: "admin" | "participant";
  hasPreviousTrack?: boolean;
  onSkip?: () => void;
  onPrevious?: () => void;
  onTogglePlay?: () => void;
  onGoToSearch?: () => void;
  /** Admin only: remove a queued track. */
  onRemoveTrack?: (trackId: string) => void;
  removingTrackId?: string | null;
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
  onSeek,
  role,
  hasPreviousTrack = false,
  onSkip,
  onPrevious,
  onTogglePlay,
  onGoToSearch,
  onRemoveTrack,
  removingTrackId = null,
}: MusicRoomViewProps) {
  const isAdmin = role === "admin";
  const hasNextTrack = queue.length > 0;
  // Queued tracks carry no stored thumbnail, so this falls back to the one
  // derived from the video id.
  const trackArtwork = nowPlaying ? trackThumbnail(nowPlaying) : undefined;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto px-4 pb-8 pt-4 lg:mx-auto lg:max-w-[1160px] lg:flex-row lg:items-center lg:justify-center lg:gap-12 lg:overflow-hidden lg:px-6 lg:pb-6 lg:pt-0">
      {/*
        On mobile this wrapper is not a box at all (`contents`), so the metadata
        and the queue become siblings of the disc and can be ordered around it:
        player first, queue underneath. On desktop it is the liner-notes column
        again, with the queue under the metadata.
      */}
      <div className="contents lg:flex lg:h-full lg:min-h-0 lg:w-[400px] lg:shrink-0 lg:flex-col lg:justify-center lg:gap-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitions.base}
          className="order-1 flex shrink-0 items-start gap-5 lg:order-none"
        >
          <div className="hidden size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-m3-lg bg-surface-container-high sm:flex">
            {trackArtwork ? (
              <img src={trackArtwork} alt="" className="size-full object-cover" />
            ) : (
              <Shape name="cookie12" size={48} className="text-on-surface-variant" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <TrackMetadata track={nowPlaying} isPlaying={isPlaying} />

            {/* Desktop keeps the transport row in the liner notes. */}
            <SeekRow
              className="mt-3 hidden lg:flex"
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={isAdmin ? onSeek : undefined}
            />
          </div>
        </motion.div>

        <div className="order-3 lg:order-none">
          <StationSequence
            queue={queue}
            roomId={roomId}
            onAddToQueue={onGoToSearch}
            onRemove={isAdmin ? onRemoveTrack : undefined}
            removingId={removingTrackId}
          />
        </div>
      </div>

      {/* Disc. Height-capped as well as width-capped: it is square, so a
          width-only cap overflows the frame on short viewports. */}
      <section className="order-2 flex w-full shrink-0 flex-col items-center justify-center gap-3 lg:order-none lg:min-w-0 lg:flex-1 lg:flex-row lg:gap-6">
        <div className="flex w-full items-center justify-center gap-3 lg:contents">
          {isAdmin && (
            <TransportButton kind="previous" enabled={hasPreviousTrack} onClick={onPrevious} />
          )}

          <div className="w-full max-w-[240px] lg:w-full lg:max-w-[min(560px,calc(100vh-15rem))]">
            <div className="lg:hidden">
              <MiniVinyl isPlaying={isPlaying} onToggle={isAdmin ? onTogglePlay : undefined} />
            </div>
            <div className="hidden lg:block">
              <Turntable
                isPlaying={isPlaying}
                progress={progress}
                onToggle={isAdmin ? onTogglePlay : undefined}
              />
            </div>
          </div>

          {isAdmin && <TransportButton kind="next" enabled={hasNextTrack} onClick={onSkip} />}
        </div>

        {/* Mobile puts the seek row under the record, centred and full width. */}
        <SeekRow
          className="mt-2 mb-4 flex lg:hidden"
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={isAdmin ? onSeek : undefined}
        />
      </section>
    </div>
  );
}
