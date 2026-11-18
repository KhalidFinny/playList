import { useMemo, useRef, useState } from "react";

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
  /**
   * Makes the bar seekable. Called with the target position from 0 to 1 while
   * dragging (for a live preview) and once on release, which is when playback
   * should actually move.
   */
  onSeek?: (value: number, committed: boolean) => void;
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
  onSeek,
}: WavyProgressProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  // The drag position wins over the playback value until it is released.
  const [scrub, setScrub] = useState<number | null>(null);
  const dragging = useRef(false);

  const indeterminate = value === undefined;
  const centerY = thickness / 2 + amplitude;
  const height = thickness + amplitude * 2;

  const clamped = Math.min(1, Math.max(0, scrub ?? value ?? 0));
  const played = width * clamped;

  const positionFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };

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
  // weight as the wave flattens. The easing is the token's own spring, sampled
  // as a linear() curve, so the wave grows with the material's overshoot rather
  // than along a bezier.
  const amplitudeVars = {
    transform: `translateY(${centerY}px) scaleY(${waving ? 1 : 0}) translateY(${-centerY}px)`,
    transition:
      "transform var(--md-sys-motion-spring-fast-spatial-duration) var(--md-sys-motion-spring-fast-spatial-easing)",
  } as React.CSSProperties;

  const svgProps = {
    width: width + wavelength,
    height,
    viewBox: `0 0 ${width + wavelength} ${height}`,
    fill: "none" as const,
    "aria-hidden": true,
  };

  const seekable = Boolean(onSeek);

  return (
    <div
      ref={ref}
      role={seekable ? "slider" : "progressbar"}
      tabIndex={seekable ? 0 : undefined}
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 1}
      aria-valuenow={indeterminate ? undefined : Number(clamped.toFixed(3))}
      onPointerDown={
        seekable
          ? (event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              const next = positionFromEvent(event);
              setScrub(next);
              onSeek?.(next, false);
            }
          : undefined
      }
      onPointerMove={
        seekable
          ? (event) => {
              if (!dragging.current) return;
              const next = positionFromEvent(event);
              setScrub(next);
              onSeek?.(next, false);
            }
          : undefined
      }
      onPointerUp={
        seekable
          ? (event) => {
              if (!dragging.current) return;
              dragging.current = false;
              const next = positionFromEvent(event);
              onSeek?.(next, true);
              setScrub(null);
            }
          : undefined
      }
      onPointerCancel={
        seekable
          ? () => {
              dragging.current = false;
              setScrub(null);
            }
          : undefined
      }
      onKeyDown={
        seekable
          ? (event) => {
              const step = event.shiftKey ? 0.1 : 0.02;
              if (event.key === "ArrowRight") onSeek?.(Math.min(1, clamped + step), true);
              else if (event.key === "ArrowLeft") onSeek?.(Math.max(0, clamped - step), true);
              else if (event.key === "Home") onSeek?.(0, true);
              else if (event.key === "End") onSeek?.(1, true);
              else return;
              event.preventDefault();
            }
          : undefined
      }
      className={cn(
        "relative w-full",
        seekable &&
          "cursor-pointer touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        className,
      )}
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

          {/* The playhead handle only exists on a seekable bar, and it grows on
              press so the target position is unambiguous while dragging. */}
          {seekable && !indeterminate && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-m3-full bg-current transition-[width,height] duration-0",
                scrub !== null || dragging.current ? "size-4" : "size-3",
              )}
              style={{ left: played }}
            />
          )}
        </>
      )}
    </div>
  );
}
