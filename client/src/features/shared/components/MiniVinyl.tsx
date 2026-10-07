import { useId } from "react";
import { Pause, Play } from "lucide-react";
import { SHAPE_PATHS } from "@/shared/shapes/shape-data";
import { cn } from "@/shared/lib/utils";

interface MiniVinylProps {
  isPlaying: boolean;
  thumbnail?: string | null;
  onToggle?: () => void;
}

/**
 * Compact vinyl for narrow widths.
 *
 * The disc silhouette is the M3 Expressive `cookie12` shape — the library's
 * 12-sided scalloped cookie reads as a record edge, which is why it is the shape
 * bound to the vinyl role. The thumbnail is clipped to the same path.
 *
 * Carries no progress bar: `TrackMetadata` always renders alongside it and owns
 * the playback position, so the indicator lives in one place.
 *
 * The disc is the transport control only when `onToggle` is passed. Participants
 * have no controls, so it renders as a plain disc rather than a button that does
 * nothing.
 */
export function MiniVinyl({ isPlaying, thumbnail, onToggle }: MiniVinylProps) {
  const clipId = useId().replace(/:/g, "");
  const interactive = Boolean(onToggle);

  const disc = (
    <>
      <div
        className={cn("disc-spin absolute inset-0", !isPlaying && "anim-paused")}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" className="size-full">
          <defs>
            <clipPath id={clipId}>
              <path d={SHAPE_PATHS.cookie12} />
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <rect width="100" height="100" className="fill-inverse-surface" />

            {thumbnail && (
              <image
                href={thumbnail}
                x="24"
                y="24"
                width="52"
                height="52"
                preserveAspectRatio="xMidYMid slice"
              />
            )}

            {/* Grooves */}
            <g fill="none" strokeWidth="0.4" className="stroke-inverse-on-surface/10">
              {Array.from({ length: 20 }).map((_, i) => (
                <circle key={i} cx="50" cy="50" r={10 + i * 2.1} />
              ))}
            </g>

            {isPlaying && (
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                strokeWidth="1.5"
                className="stroke-primary"
              />
            )}
          </g>

          {/* Spindle */}
          <circle cx="50" cy="50" r="4" className="fill-primary" />
        </svg>
      </div>

      {interactive && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
            isPlaying
              ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              : "opacity-100",
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-m3-full bg-surface-container-lowest/90 elevation-3">
            {isPlaying ? (
              <Pause size={22} className="text-on-surface" />
            ) : (
              <Play size={22} className="ml-0.5 text-on-surface" fill="currentColor" />
            )}
          </span>
        </span>
      )}
    </>
  );

  return (
    <div className="relative mx-auto flex w-full max-w-[240px] flex-col items-center gap-4">
      {interactive ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="group relative size-44 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:size-52"
        >
          {disc}
        </button>
      ) : (
        <div aria-hidden="true" className="relative size-44 sm:size-52">
          {disc}
        </div>
      )}
    </div>
  );
}
