import { useElementWidth } from "@/shared/hooks/useElementWidth";
import { cn } from "@/shared/lib/utils";

export interface CircularProgressProps {
  /** Progress from 0 to 1. */
  value: number;
  /** Stroke thickness in px, held constant regardless of the ring's size. */
  thickness?: number;
  className?: string;
}

/** Arc radius as a fraction of the box. Matches the disc's own 90%-of-figure
 *  edge, so the line hugs the record the way it did before the wavy ring. */
const RADIUS_RATIO = 0.45;

/**
 * M3's plain circular progress indicator: one smooth arc, no track.
 *
 * The arc's dash offset is a CSS transition, not a JS animation — the value
 * changes about once a second from `playback_sync`, and letting the compositor
 * interpolate it keeps the main thread clear. See `styles/animation.css` for why
 * that matters here.
 *
 * The viewBox is the element's **real pixel size**, which is what
 * `WavyCircularProgress` does and what makes the dash maths safe: a dash length
 * expressed in user units equals the same number of pixels, so
 * `strokeDasharray` = one circumference is genuinely one dash.
 *
 * Do **not** reach for `vector-effect: non-scaling-stroke` to keep the stroke
 * thin. Under that effect the dash pattern is resolved in the outer (screen)
 * coordinate system while the path length is not, so a dasharray of one
 * circumference repeats around the ring and paints several disconnected arcs.
 */
export function CircularProgress({ value, thickness = 5, className }: CircularProgressProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const box = width;
  const clamped = Math.min(1, Math.max(0, value));

  const center = box / 2;
  const radius = Math.max(0, box * RADIUS_RATIO);
  const circumference = 2 * Math.PI * radius;

  return (
    <div ref={ref} className={cn("relative aspect-square w-full", className)}>
      {box > 0 && (
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          fill="none"
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            className="stroke-current transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
      )}
    </div>
  );
}
