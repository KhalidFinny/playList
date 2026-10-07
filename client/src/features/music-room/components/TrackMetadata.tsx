import { ShapeMorph } from "@/shared/shapes/shape-morph";
import { WavyProgress } from "@/shared/components/wavy-progress";
import { cn } from "@/shared/lib/utils";
import type { TrackMetadataProps } from "../types";

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Now-playing metadata. The track title takes `headline-medium`, which is the M3
 * role for a prominent but not full-screen heading.
 *
 * The "now playing" label carries the M3 Expressive shape morph, which animates
 * only while audio is actually playing — the squiggle is the playing indicator.
 */
export const TrackMetadata = ({
  track,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
}: TrackMetadataProps) => {
  if (!track) {
    return (
      <header className="flex flex-col gap-2">
        <h1 className="text-headline-medium text-on-surface-variant">Nothing playing</h1>
        <p className="text-body-medium text-on-surface-variant">Waiting for music</p>
      </header>
    );
  }

  const percent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

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

      <div className="mt-3 flex items-center gap-3">
        <span className="text-label-large tabular-nums text-on-surface-variant">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {duration > 0 && (
        <WavyProgress
          value={percent / 100}
          label={`Playback position ${formatTime(currentTime)} of ${formatTime(duration)}`}
          className="mt-1 max-w-[200px] text-primary"
        />
      )}
    </header>
  );
};
