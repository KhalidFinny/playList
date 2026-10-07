import { motion, useReducedMotion, useTime, useTransform } from "framer-motion";
import { SHAPE_POINTS, SHAPE_SAMPLES, LOADING_MORPH, type ShapeName } from "./shape-data";

export interface ShapeMorphProps {
  /** Shapes to cycle through. Defaults to the music morph. */
  shapes?: readonly ShapeName[];
  /** Rendered box in px. */
  size?: number;
  /** Seconds for one full cycle through the shape list. */
  duration?: number;
  /**
   * When false the shape holds still. Used for state indicators that should only
   * animate while something is actually happening (e.g. audio playing) — a
   * permanently morphing shape next to a paused player reads as a bug.
   */
  active?: boolean;
  className?: string;
}

/** Linear interpolation between two shapes, point by point. */
function lerpPath(from: ShapeName, to: ShapeName, t: number): string {
  const a = SHAPE_POINTS[from];
  const b = SHAPE_POINTS[to];
  let d = "";
  for (let i = 0; i < SHAPE_SAMPLES; i++) {
    const x = a[i][0] + (b[i][0] - a[i][0]) * t;
    const y = a[i][1] + (b[i][1] - a[i][1]) * t;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d + "Z";
}

function StaticShape({
  shape,
  size,
  className,
}: {
  shape: ShapeName;
  size: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <path d={lerpPath(shape, shape, 0)} fill="currentColor" />
    </svg>
  );
}

/**
 * The morph itself. Split from `ShapeMorph` so the animation clock
 * (`useTime`, a requestAnimationFrame loop) only runs while the shape is active —
 * hooks cannot be called conditionally, so the inactive case must render a
 * different component.
 */
function MorphingShape({
  shapes,
  size,
  duration,
  className,
}: Required<Pick<ShapeMorphProps, "shapes" | "size" | "duration">> & { className?: string }) {
  const time = useTime();
  const d = useTransform(time, (now) => {
    if (shapes.length < 2) return lerpPath(shapes[0], shapes[0], 0);
    const progress = (((now / 1000 / duration) % 1) + 1) % 1;
    const scaled = progress * shapes.length;
    const index = Math.floor(scaled);
    const from = shapes[index % shapes.length];
    const to = shapes[(index + 1) % shapes.length];
    return lerpPath(from, to, scaled - index);
  });

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <motion.path d={d} fill="currentColor" />
    </svg>
  );
}

/**
 * The M3 Expressive shape morph: one shape continuously becoming the next. M3
 * ships this on Android only — "Web: Unavailable" — so it is hand-built from the
 * normalised shape library in `shape-data`.
 *
 * PlayList morphs cookie12 -> burst -> flower (vinyl -> beat -> bloom) instead of
 * Google's cookie9 -> pentagon -> softBurst, to stay on the music theme.
 *
 * Drives the loading indicator, and the "now playing" indicator in the music room.
 */
export function ShapeMorph({
  shapes = LOADING_MORPH,
  size = 40,
  duration = 2.4,
  active = true,
  className,
}: ShapeMorphProps) {
  const reduceMotion = useReducedMotion();

  // Inactive or reduced-motion: hold a single shape, and do not start the clock.
  if (!active || reduceMotion) {
    return <StaticShape shape={shapes[0]} size={size} className={className} />;
  }

  return <MorphingShape shapes={shapes} size={size} duration={duration} className={className} />;
}
