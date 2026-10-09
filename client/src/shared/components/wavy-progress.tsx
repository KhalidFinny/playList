import { useMemo } from "react";

import { useElementWidth } from "@/shared/hooks/useElementWidth";
import { cn } from "@/shared/lib/utils";

export interface WavyProgressProps {
  /**
   * Progress from 0 to 1. Omit for the indeterminate variant, which is what the
   * wavy indicator is for when there is no known duration (loading, buffering).
   */
  value?: number;
  /**
   * Wave amplitude in px, measured from the resting centre to a peak. M3's
   * default is 3.
   */
  amplitude?: number;
  /** Distance between two adjacent peaks, in px. M3's default is 40. */
  wavelength?: number;
  /** Stroke thickness in px. M3's default is 4; 8 is the thick variant. */
  thickness?: number;
  /** Seconds for the wave to travel one wavelength. M3 ties speed to wavelength. */
  speed?: number;
  /**
   * Whether the wave is live. When false the amplitude settles to zero, so a
   * paused player goes flat instead of holding a frozen squiggle. This is the
   * Expressive behaviour: the wave *grows* out of the track rather than being
   * present the whole time.
   */
  waving?: boolean;
  /** Unplayed stroke. Defaults to the `accent-warm` role. */
  trackClassName?: string;
  className?: string;
  /** Accessible name. The component carries the `progressbar` role. */
  label?: string;
}

/** Sampling step, in px. Small enough that the wave reads as smooth. */
const SAMPLE_STEP = 2;

/** Fraction of the track the indeterminate wave segment occupies. */
const INDETERMINATE_SEGMENT = 0.35;

/** A sine wave sampled across `[from, to]`, in the element's own pixel space. */
function wavePath(
  from: number,
  to: number,
  centerY: number,
  amplitude: number,
  wavelength: number,
): string {
  if (to <= from) return `M${from} ${centerY} H${to}`;

  const y = (x: number) => centerY + amplitude * Math.sin((2 * Math.PI * x) / wavelength);

  let d = "";
  for (let x = from; x < to; x += SAMPLE_STEP) {
    d += (d === "" ? "M" : "L") + x.toFixed(2) + " " + y(x).toFixed(2);
  }
  return d + "L" + to.toFixed(2) + " " + y(to).toFixed(2);
}

/**
 * M3 Expressive wavy progress indicator.
 *
 * The **active indicator waves; the track does not.** That is M3's own
 * arrangement and it is the quieter one: a single moving line against a still
 * one, instead of two squiggles competing. Only the colour changes at the
 * playhead, which is where the wave stops and the flat track begins.
 *
 * The amplitude is **animated**, so the wave grows out of the track when it
 * starts and settles flat when it stops (`waving`). Scaling the whole path on the
 * Y axis about the centre line is what makes this a CSS transition on the
 * compositor — animating the path's `d` would mean a per-frame DOM write, which
 * measured 33% of the main thread on a throttled device.
 *
 * The wave **translates** rather than being redrawn, for the same reason: a sine
 * is periodic, so shifting it by exactly one wavelength reproduces it.
 *
 * Pass `value` for determinate, omit it for indeterminate.
 */
export function WavyProgress({
  value,
  amplitude = 3,
  wavelength = 40,
  thickness = 4,
  speed = 1,
  waving = true,
  trackClassName = "stroke-accent-warm",
  className,
  label,
}: WavyProgressProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();

  const indeterminate = value === undefined;
  const centerY = thickness / 2 + amplitude;
  const height = thickness + amplitude * 2;

  const clamped = Math.min(1, Math.max(0, value ?? 0));
  const played = width * clamped;

  // Built over one extra wavelength so the right edge is never empty mid-slide.
  const wave = useMemo(() => {
    if (width <= 0) return "";
    return wavePath(0, width + wavelength, centerY, amplitude, wavelength);
  }, [width, wavelength, centerY, amplitude]);

  const segmentWidth = width * INDETERMINATE_SEGMENT;
  const indeterminateWave = useMemo(() => {
    if (width <= 0) return "";
    return wavePath(0, segmentWidth + wavelength, centerY, amplitude, wavelength);
  }, [width, segmentWidth, wavelength, centerY, amplitude]);

  const waveVars = {
    "--wave-wavelength": `${wavelength}px`,
    "--wave-duration": `${speed}s`,
  } as React.CSSProperties;

  // Scale about the resting centre line, so only the amplitude changes. The
  // stroke is exempted from the scale (`non-scaling-stroke`) so it keeps its
  // weight as the wave flattens.
  const amplitudeVars = {
    transform: `translateY(${centerY}px) scaleY(${waving ? 1 : 0}) translateY(${-centerY}px)`,
    transition:
      "transform var(--md-sys-motion-duration-expressive-default-spatial) var(--md-sys-motion-easing-expressive-default-spatial)",
  } as React.CSSProperties;

  const svgProps = {
    width: width + wavelength,
    height,
    viewBox: `0 0 ${width + wavelength} ${height}`,
    fill: "none" as const,
    "aria-hidden": true,
  };

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 1}
      aria-valuenow={indeterminate ? undefined : clamped}
      className={cn("relative w-full", className)}
      style={{ height }}
    >
      {width > 0 && (
        <>
          {/* Active indicator. Clipped to the progress extent, so the colour
              changes at the playhead while the wave runs on unbroken. */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: indeterminate ? segmentWidth : played }}
          >
            <svg {...svgProps} className="wave-slide absolute inset-y-0 left-0" style={waveVars}>
              <g style={indeterminate ? undefined : amplitudeVars}>
                <path
                  d={indeterminate ? indeterminateWave : wave}
                  className="stroke-current"
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            </svg>
          </div>

          {/* Track. Flat, as M3 draws it — the wave is the only moving thing. */}
          {!indeterminate && width - played > 0 && (
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              fill="none"
              className="pointer-events-none absolute inset-0 overflow-visible"
              aria-hidden="true"
            >
              <line
                x1={played}
                y1={centerY}
                x2={width}
                y2={centerY}
                className={trackClassName}
                strokeWidth={thickness}
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Stop dot at the end of the track. */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            <circle cx={width} cy={centerY} r={thickness / 2} className="fill-current" />
          </svg>
        </>
      )}
    </div>
  );
}
