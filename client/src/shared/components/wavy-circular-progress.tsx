import { useMemo } from "react";
import { motion, useReducedMotion, useTime, useTransform } from "framer-motion";

import { useElementWidth } from "@/shared/hooks/useElementWidth";
import { cn } from "@/shared/lib/utils";

export interface WavyCircularProgressProps {
  /**
   * Progress from 0 to 1. Omit for the indeterminate variant, which is what a
   * splash needs (no known duration).
   */
  value?: number;
  /**
   * Outer box in px. Omit to fill the container, which is how the turntable wraps
   * a disc of unknown size.
   */
  size?: number;
  /** Stroke thickness in px. M3's default is 4. */
  thickness?: number;
  /** Wave amplitude in px. M3's default is 3. */
  amplitude?: number;
  /** Distance between two adjacent peaks, in px. M3's default is 40. */
  wavelength?: number;
  /**
   * Amplitude as a fraction of `size`. Overrides `amplitude`. Use this on large
   * rings, where a fixed 3px wave disappears.
   */
  amplitudeRatio?: number;
  /** Wave cycles around the ring. Overrides `wavelength`. */
  waves?: number;
  /** Seconds for one full revolution (indeterminate only). */
  period?: number;
  /**
   * Fraction of the circle the rotating arc covers, 0 to 1 (indeterminate only).
   * A constant span is what makes this read as a squiggle *circling* rather than
   * pulsing.
   */
  arcSpan?: number;
  /**
   * Travel the wave along the arc. The arc's extent still tracks `value`; only the
   * squiggle's phase moves, so the indicator reads as alive rather than frozen.
   * Used by the turntable, where the ring sits still but the wave should ripple.
   */
  animated?: boolean;
  /** Seconds for the wave to travel one wavelength (`animated` only). */
  wavePeriod?: number;
  className?: string;
  /**
   * Accessible name. Without one the indicator is treated as decorative: no
   * `progressbar` role, hidden from assistive tech. Used where the same position
   * is already announced elsewhere (the turntable, next to TrackMetadata).
   */
  label?: string;
}

/** Angular sampling step, in radians. Small enough that the arc reads as smooth. */
const SAMPLE_STEP = 0.04;

/**
 * M3's amplitude ramp: flatten the wave at the very start and end so a
 * near-empty or near-complete ring does not render a jagged stub.
 * Values are M3's `waveAmplitudeRampProgressMin` (0.1) and `...Max` (0.9).
 */
function amplitudeRamp(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.1) return progress / 0.1;
  if (progress > 0.9) return (1 - progress) / 0.1;
  return 1;
}

/**
 * A wavy arc: the centreline is a circle of radius `radius`, modulated radially
 * by a sine wave so the stroke itself squiggles around the ring.
 *
 * A fixed `phase` means the squiggle shape is rigid — rotating the arc rotates
 * the squiggle with it, which is what reads as "circling".
 */
function wavyArcPath(
  center: number,
  radius: number,
  amplitude: number,
  waves: number,
  phase: number,
  from: number,
  to: number,
): string {
  const at = (theta: number) => {
    const r = radius + amplitude * Math.sin(waves * theta + phase);
    return [center + r * Math.cos(theta), center + r * Math.sin(theta)] as const;
  };

  if (to <= from || amplitude === 0) {
    const [sx, sy] = at(from);
    return `M${sx.toFixed(2)} ${sy.toFixed(2)}`;
  }

  let d = "";
  for (let theta = from; theta < to; theta += SAMPLE_STEP) {
    const [x, y] = at(theta);
    d += (d === "" ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  const [ex, ey] = at(to);
  return d + "L" + ex.toFixed(2) + " " + ey.toFixed(2);
}

/**
 * The rotating arc for the indeterminate variant.
 *
 * Split into its own component so `useTime` (a requestAnimationFrame clock) only
 * runs when the indicator is actually indeterminate. Hooks cannot be called
 * conditionally, so the determinate path must render a different component.
 */
function RotatingArc({
  center,
  radius,
  amplitude,
  waves,
  period,
  arcSpan,
  thickness,
}: {
  center: number;
  radius: number;
  amplitude: number;
  waves: number;
  period: number;
  arcSpan: number;
  thickness: number;
}) {
  const reduceMotion = useReducedMotion();
  const time = useTime();

  // One revolution per `period`, constant speed, no easing or reset jump.
  // Wrapped at 2π: `waves` is an integer, so the squiggle phase is identical
  // every turn and this keeps the trig arguments small instead of drifting.
  const rotation = useTransform(time, (now) => {
    if (reduceMotion) return 0;
    return (((now / 1000) * (2 * Math.PI)) / period) % (2 * Math.PI);
  });

  const d = useTransform(rotation, (r) =>
    wavyArcPath(center, radius, amplitude, waves, 0, r, r + arcSpan * 2 * Math.PI),
  );

  return (
    <motion.path d={d} className="stroke-current" strokeWidth={thickness} strokeLinecap="round" />
  );
}

/**
 * The determinate arc with the wave travelling along it.
 *
 * Split out for the same reason as `RotatingArc`: the `useTime` clock should only
 * run when the wave is actually animating. The arc's *extent* still comes from
 * `value`; only the wave's phase moves, so the progress reading stays honest while
 * the squiggle ripples.
 */
function TravelingArc({
  center,
  radius,
  amplitude,
  waves,
  value,
  wavePeriod,
  thickness,
}: {
  center: number;
  radius: number;
  amplitude: number;
  waves: number;
  value: number;
  wavePeriod: number;
  thickness: number;
}) {
  const reduceMotion = useReducedMotion();
  const time = useTime();

  // Wrapped at 2π: `waves` is an integer, so the shape at phase 2π is identical to
  // phase 0 and the loop has no visible seam.
  const phase = useTransform(time, (now) => {
    if (reduceMotion) return 0;
    return (((now / 1000) * 2 * Math.PI) / wavePeriod) % (2 * Math.PI);
  });

  const d = useTransform(phase, (p) =>
    wavyArcPath(center, radius, amplitude, waves, p, 0, 2 * Math.PI * value),
  );

  return (
    <motion.path d={d} className="stroke-current" strokeWidth={thickness} strokeLinecap="round" />
  );
}

/**
 * M3 Expressive circular wavy progress indicator: a sine wave wrapped around a
 * ring. M3 ships this on Android only, so it is hand-built here.
 *
 * There is **no track**: the squiggle is the only stroke, so it floats against
 * the surface instead of sitting on a circle. A visible circle behind it read as
 * a plain ring with a wobbly arc on top.
 *
 * Indeterminate (omit `value`) is a **constant** arc of squiggle rotating around
 * the ring. It deliberately does not grow and shrink the way M3's indeterminate
 * circular indicator does: that reads as a pulse.
 *
 * Determinate renders a plain path with no animation clock unless `animated` is
 * set, so a large static ring costs nothing per frame and only a ring that asks to
 * ripple pays for the clock.
 *
 * Pass the colour with `text-*` on the wrapper.
 */
export function WavyCircularProgress({
  value,
  size,
  thickness = 4,
  amplitude,
  wavelength,
  amplitudeRatio,
  waves: waveCount,
  period = 2.4,
  arcSpan = 0.75,
  animated = false,
  wavePeriod = 1.6,
  className,
  label,
}: WavyCircularProgressProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const box = size ?? width;
  const indeterminate = value === undefined;

  const center = box / 2;
  const amp =
    box > 0 ? (amplitudeRatio !== undefined ? amplitudeRatio * box : (amplitude ?? 3)) : 0;
  const radius = Math.max(0, box / 2 - amp - thickness / 2);
  const waves =
    box > 0 && waveCount !== undefined
      ? Math.max(1, Math.round(waveCount))
      : Math.max(1, Math.round((2 * Math.PI * radius) / (wavelength ?? 40)));

  const geometry = { center, radius, amplitude: amp, waves } as const;

  const clamped = Math.min(1, Math.max(0, value ?? 0));
  const rampedAmplitude = amp * amplitudeRamp(clamped);

  const determinatePath = useMemo(() => {
    if (box <= 0) return "";
    return wavyArcPath(center, radius, rampedAmplitude, waves, 0, 0, 2 * Math.PI * clamped);
  }, [box, center, radius, rampedAmplitude, waves, clamped]);

  return (
    <div
      ref={ref}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      aria-valuemin={label && !indeterminate ? 0 : undefined}
      aria-valuemax={label && !indeterminate ? 1 : undefined}
      aria-valuenow={label && !indeterminate ? Math.min(1, Math.max(0, value ?? 0)) : undefined}
      className={cn(size ? "relative" : "relative aspect-square w-full", className)}
      style={size ? { width: size, height: size } : undefined}
    >
      {box > 0 && (
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          fill="none"
          className="-rotate-90"
        >
          {indeterminate ? (
            <RotatingArc {...geometry} period={period} arcSpan={arcSpan} thickness={thickness} />
          ) : animated ? (
            <TravelingArc
              {...geometry}
              amplitude={rampedAmplitude}
              value={clamped}
              wavePeriod={wavePeriod}
              thickness={thickness}
            />
          ) : (
            <path
              d={determinatePath}
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
