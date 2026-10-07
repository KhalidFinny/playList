import { motion, useReducedMotion, useTime, useTransform } from "framer-motion";

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
  /** Track (inactive) stroke. Defaults to the `accent-warm` role. */
  trackClassName?: string;
  className?: string;
  /** Accessible name. The component carries the `progressbar` role. */
  label?: string;
}

const SAMPLE_STEP = 2;
/** Fraction of the track the indeterminate wave segment occupies. */
const INDETERMINATE_SEGMENT = 0.35;

/**
 * Distance over which the line becomes a squiggle, in px.
 *
 * Conversion happens at the **leading edge**, where the wave is currently
 * sweeping: the line right at the playhead is still straight and it grows into
 * the squiggle just behind it. That is what makes the change read as the wave
 * progressively taking the line over, rather than as a squiggle that was always
 * there. About a wavelength wide.
 */
const SQUIGGLE_RAMP = 60;

/**
 * M3's amplitude ramp: the wave flattens at the very start and very end so a
 * near-empty or near-complete indicator does not render a jagged stub. Values
 * are M3's `waveAmplitudeRampProgressMin` (0.1) and `...Max` (0.9).
 */
function amplitudeRamp(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.1) return progress / 0.1;
  if (progress > 0.9) return (1 - progress) / 0.1;
  return 1;
}

/** Smoothstep, so the wave enters and leaves the line without a kink. */
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Samples a wave across `[from, to]` in px, in the element's own space.
 *
 * `amplitudeAt` returns the amplitude at a given x, which is what lets the line
 * grow into the squiggle instead of switching to it.
 */
function wavePath(
  from: number,
  to: number,
  centerY: number,
  amplitudeAt: (x: number) => number,
  wavelength: number,
  phase: number,
): string {
  if (to <= from) {
    return `M${from} ${centerY} H${to}`;
  }
  const y = (x: number) =>
    centerY + amplitudeAt(x) * Math.sin((2 * Math.PI * x) / wavelength + phase);

  let d = "";
  for (let x = from; x < to; x += SAMPLE_STEP) {
    d += (d === "" ? "M" : "L") + x.toFixed(2) + " " + y(x).toFixed(2);
  }
  return d + "L" + to.toFixed(2) + " " + y(to).toFixed(2);
}

/**
 * M3 Expressive wavy progress indicator.
 *
 * A sine wave travels along the active track — the squiggle Google uses for
 * downloading and for playback position. M3 ships this on Android only, so it is
 * hand-built here.
 *
 * Follows the spec's numbers: amplitude 3, wavelength 40, and a wave speed of one
 * wavelength per second. The active indicator is the `primary` role and the track
 * is `accent-warm`, a warm mid-tone; a stop dot terminates the track, which M3
 * requires because that track colour sits below 3:1 against the surface.
 *
 * The wave is generated at the element's real pixel width, so it is never
 * stretched. Pass `value` for determinate, omit it for indeterminate.
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
  const reduceMotion = useReducedMotion();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const time = useTime();

  const indeterminate = value === undefined;
  const centerY = thickness / 2 + amplitude;
  const height = thickness + amplitude * 2;

  // Phase advances one wavelength per `speed` seconds.
  const phase = useTransform(time, (now) => {
    if (reduceMotion) return 0;
    return (2 * Math.PI * (now / 1000)) / speed;
  });

  // Indeterminate: a wavy segment sweeps the full width, looping.
  const sweep = useTransform(time, (now) => {
    if (reduceMotion) return 0.5;
    const cycle = (now / 1000 / 2) % 1;
    return cycle;
  });

  const activePath = useTransform([phase, sweep], (values: number[]) => {
    const p = values[0];
    const s = values[1];
    if (width <= 0) return "";

    if (indeterminate) {
      const segment = width * INDETERMINATE_SEGMENT;
      const start = -segment + s * (width + segment);
      const from = Math.max(0, start);
      const to = Math.min(width, start + segment);
      // Indeterminate has no "already played" region to grow out of, so the
      // amplitude is flat here and only the determinate path ramps.
      return wavePath(from, to, centerY, () => amplitude, wavelength, p);
    }

    const clamped = Math.min(1, Math.max(0, value ?? 0));
    const played = width * clamped;
    const peak = amplitude * amplitudeRamp(clamped);
    // Full squiggle behind the sweep, straightening to flat right at the playhead.
    // The ramp is capped by the played length so a very early position is not
    // entirely transition and still shows some formed wave.
    const ramp = Math.min(SQUIGGLE_RAMP, played * 0.75);
    return wavePath(
      0,
      played,
      centerY,
      (x) => (ramp > 0 ? peak * smoothstep((played - x) / ramp) : peak),
      wavelength,
      p,
    );
  });

  const clampedValue = Math.min(1, Math.max(0, value ?? 0));

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 1}
      aria-valuenow={indeterminate ? undefined : Math.min(1, Math.max(0, value ?? 0))}
      className={cn("relative w-full", className)}
      style={{ height }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          fill="none"
          className="overflow-visible"
          aria-hidden="true"
        >
          {/* Inactive track, plus the stop dot M3 requires at its end. */}
          <path
            d={`M0 ${centerY} H${width}`}
            className={trackClassName}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
          <circle cx={width} cy={centerY} r={thickness / 2} className="fill-current" />

          <motion.path
            d={activePath}
            className="stroke-current"
            strokeWidth={thickness}
            strokeLinecap="round"
          />

          {/* Playhead. The wave is fully formed by the time it reaches here, so
              this marks the boundary between the squiggle and the untouched
              line — without it the squiggle just stops, which is what made the
              conversion read as abrupt. */}
          {!indeterminate && clampedValue > 0 && (
            <line
              x1={width * clampedValue}
              y1={centerY - amplitude - thickness / 2}
              x2={width * clampedValue}
              y2={centerY + amplitude + thickness / 2}
              className="stroke-current"
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          )}
        </svg>
      )}
    </div>
  );
}
