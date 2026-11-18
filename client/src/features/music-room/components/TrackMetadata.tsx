import { ShapeMorph } from "@/shared/shapes/shape-morph";
import { WavyProgress } from "@/shared/components/wavy-progress";
import { cn } from "@/shared/lib/utils";
import type { TrackMetadataProps } from "../types";

/** Seconds as `m:ss`. Shared with the seek row so both read the same clock. */
export function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The seek row: elapsed time, the wavy bar, total time.
 *
 * Its own component because the layouts place it differently: in the liner notes
 * on desktop, under the record on mobile.
 */
export function SeekRow({
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
  className,
}: {
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  onSeek?: (value: number, committed: boolean) => void;
  className?: string;
}) {
  if (duration <= 0) return null;
  const percent = Math.min(1, currentTime / duration);

  return (
    <div className={cn("flex w-full max-w-[420px] items-center gap-3", className)}>
      <span className="shrink-0 text-label-medium tabular-nums text-on-surface-variant">
        {formatTime(currentTime)}
      </span>
      <WavyProgress
        value={percent}
        waving={isPlaying}
        label={`Playback position ${formatTime(currentTime)} of ${formatTime(duration)}`}
        className="min-w-0 flex-1 text-primary"
        onSeek={onSeek}
      />
      <span className="shrink-0 text-label-medium tabular-nums text-on-surface-variant">
        {formatTime(duration)}
      </span>
    </div>
  );
}

/**
 * Now-playing metadata. The track title takes `headline-medium`, which is the M3
 * role for a prominent but not full-screen heading.
 *
 * The "now playing" label carries the M3 Expressive shape morph, which animates
 * only while audio is actually playing — the squiggle is the playing indicator.
 */
export const TrackMetadata = ({ track, isPlaying = false }: TrackMetadataProps) => {
  if (!track) {
    return (
      <header className="flex flex-col gap-2">
        <h1 className="text-headline-medium text-on-surface-variant">Nothing playing</h1>
        <p className="text-body-medium text-on-surface-variant">Waiting for music</p>
      </header>
    );
  }

  return (
    <header className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-label-large uppercase tracking-[0.2em] text-primary">
        <ShapeMorph
          size={20}
          active={isPlaying}
          className={cn("shrink-0", !isPlaying && "text-on-surface-variant")}
        />
        {isPlaying ? "Playing now" : "Paused"}
      </p>
      <h1 className="line-clamp-3 text-headline-medium-emphasized text-on-surface">
        {track.title}
      </h1>
      <p className="text-title-small text-on-surface-variant">{track.author}</p>
    </header>
  );
};
