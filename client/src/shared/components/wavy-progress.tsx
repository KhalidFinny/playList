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
 * The **whole bar is one wave**, not a squiggle over a flat line: the unplayed
 * portion squiggles in step with the played portion, and only the colour changes
 * at the playhead. Two independently drawn waves would drift apart, so both
 * layers render the same path and carry the same animation; the unplayed layer is
 * offset by the played width so the wave stays continuous across the boundary.
 *
 * The wave **translates** rather than being redrawn. Because it is periodic,
 * shifting it by exactly one wavelength reproduces it, so the path is built once
 * and a CSS transform slides it on the compositor. Redrawing the path every frame
 * cost 33% of the main thread on a throttled device, since every `d` write
 * invalidates style, layout and paint.
 *
 * Pass `value` for determinate, omit it for indeterminate.
 */
export function WavyProgress({
  value,
  amplitude = 3,
  wavelength = 40,
  thickness = 4,
  speed = 1,
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
          {/* Played. Clipped to the progress extent, so the colour changes at the
              playhead while the wave runs through both layers unbroken. */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: indeterminate ? segmentWidth : played }}
          >
            <svg {...svgProps} className="wave-slide absolute inset-y-0 left-0" style={waveVars}>
              <path
                d={indeterminate ? indeterminateWave : wave}
                className="stroke-current"
                strokeWidth={thickness}
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Unplayed. Same path and same animation, shifted by the played width so
              it continues the wave rather than starting a new one. The static shift
              uses `translate` and the animation uses `transform`, which compose. */}
          {!indeterminate && (
            <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ left: played }}>
              <svg
                {...svgProps}
                className="wave-slide absolute inset-y-0 left-0"
                style={{ ...waveVars, translate: `-${played}px` }}
              >
                <path
                  d={wave}
                  className={trackClassName}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                />
              </svg>
            </div>
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

          {/* Playhead. Marks where played becomes unplayed. */}
          {!indeterminate && clamped > 0 && (
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
                y1={centerY - amplitude - thickness / 2}
                x2={played}
                y2={centerY + amplitude + thickness / 2}
                className="stroke-current"
                strokeWidth={thickness}
                strokeLinecap="round"
              />
            </svg>
          )}
        </>
      )}
    </div>
  );
}
