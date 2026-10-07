import { useMemo } from "react";

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
 */
function wavyArcPath(
  center: number,
  radius: number,
  amplitude: number,
  waves: number,
  from: number,
  to: number,
): string {
  const at = (theta: number) => {
    const r = radius + amplitude * Math.sin(waves * theta);
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

/** A pie wedge covering `[0, angle]`, used to clip the wave to the progress arc. */
function wedgePath(center: number, radius: number, angle: number): string {
  if (angle <= 0) return "";
  if (angle >= Math.PI * 2) {
    return `M${center - radius} ${center} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`;
  }
  const x0 = center + radius * Math.cos(0);
  const y0 = center + radius * Math.sin(0);
  const x1 = center + radius * Math.cos(angle);
  const y1 = center + radius * Math.sin(angle);
  const largeArc = angle > Math.PI ? 1 : 0;
  return `M${center} ${center} L${x0.toFixed(2)} ${y0.toFixed(2)} A${radius} ${radius} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/**
 * M3 Expressive circular wavy progress indicator.
 *
 * There is **no track**: the squiggle is the only stroke, so it floats against
 * the surface instead of sitting on a circle.
 *
 * Both variants animate with a CSS transform, never a per-frame path rewrite.
 * Redrawing the path every frame cost the music room a measurable slice of the
 * main thread, because each `d` write invalidates style, layout and paint.
 *
 * - **Determinate**: the full-circle wave is drawn once and a static wedge clips
 *   it to the progress extent, so the wave travels *inside* a fixed arc.
 * - **Indeterminate**: a constant arc of squiggle rotating around the ring. It
 *   deliberately does not grow and shrink the way M3's indeterminate indicator
 *   does: that reads as a pulse.
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

  const clamped = Math.min(1, Math.max(0, value ?? 0));
  const ramped = amp * amplitudeRamp(clamped);

  // Indeterminate: one arc, rotated by CSS.
  const rotatingArc = useMemo(
    () => (box > 0 ? wavyArcPath(center, radius, amp, waves, 0, arcSpan * 2 * Math.PI) : ""),
    [box, center, radius, amp, waves, arcSpan],
  );

  // Determinate: the whole circle of wave, plus a wedge for the played extent.
  const fullWave = useMemo(
    () => (box > 0 && ramped > 0 ? wavyArcPath(center, radius, ramped, waves, 0, Math.PI * 2) : ""),
    [box, center, radius, ramped, waves],
  );
  const wedge = useMemo(
    () => (box > 0 ? wedgePath(center, radius + amp + thickness, clamped * 2 * Math.PI) : ""),
    [box, center, radius, amp, thickness, clamped],
  );

  const clipId = `wave-clip-${Math.round(box)}-${Math.round(clamped * 1000)}`;

  return (
    <div
      ref={ref}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      aria-valuemin={label && !indeterminate ? 0 : undefined}
      aria-valuemax={label && !indeterminate ? 1 : undefined}
      aria-valuenow={label && !indeterminate ? clamped : undefined}
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
          aria-hidden="true"
        >
          {indeterminate ? (
            <path
              d={rotatingArc}
              className="ring-spin stroke-current"
              style={
                {
                  "--ring-period": `${period}s`,
                  "--ring-waves": "1",
                } as React.CSSProperties
              }
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          ) : (
            <>
              <defs>
                <clipPath id={clipId}>
                  <path d={wedge} />
                </clipPath>
              </defs>
              {/* One wavelength of travel is a rotation of 360/waves degrees, and
                  the full-circle wave is periodic at exactly that angle, so the
                  loop is seamless. */}
              <g clipPath={`url(#${clipId})`}>
                <path
                  d={fullWave}
                  className={cn("stroke-current", animated && "ring-spin")}
                  style={
                    animated
                      ? ({
                          "--ring-period": `${wavePeriod}s`,
                          "--ring-waves": String(waves),
                        } as React.CSSProperties)
                      : undefined
                  }
                  strokeWidth={thickness}
                  strokeLinecap="round"
                />
              </g>
            </>
          )}
        </svg>
      )}
    </div>
  );
}
