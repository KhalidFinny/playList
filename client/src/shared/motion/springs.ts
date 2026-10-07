import type { Transition } from "framer-motion";

/**
 * M3 Expressive motion springs.
 *
 * Values are from androidx.compose.material3.tokens.ExpressiveMotionTokens.
 * `damping` is a damping RATIO (1 = critically damped, no overshoot); `stiffness`
 * is in the Compose scale. Framer Motion consumes both directly.
 *
 * Spatial springs move things (position, size, rotation, radius) and overshoot.
 * Effects springs animate color and opacity and must not overshoot.
 *
 * These mirror the CSS tokens in `client/src/styles/motion.css` — change both
 * together.
 */

export interface Spring {
  stiffness: number;
  damping: number;
}

const expressive = {
  fastSpatial: { stiffness: 800, damping: 0.6 },
  defaultSpatial: { stiffness: 380, damping: 0.8 },
  slowSpatial: { stiffness: 200, damping: 0.8 },
  fastEffects: { stiffness: 3800, damping: 1 },
  defaultEffects: { stiffness: 1600, damping: 1 },
  slowEffects: { stiffness: 800, damping: 1 },
} as const satisfies Record<string, Spring>;

const standard = {
  fastSpatial: { stiffness: 1400, damping: 0.9 },
  defaultSpatial: { stiffness: 700, damping: 0.9 },
  slowSpatial: { stiffness: 300, damping: 0.9 },
  fastEffects: { stiffness: 3800, damping: 1 },
  defaultEffects: { stiffness: 1600, damping: 1 },
  slowEffects: { stiffness: 800, damping: 1 },
} as const satisfies Record<string, Spring>;

export const springs = { expressive, standard } as const;

/** The scheme most motion should use. */
export const motion = springs.expressive;

export type MotionScheme = keyof typeof springs;

/**
 * Non-overshooting transitions for entry, exit and state changes.
 *
 * The expressive spatial springs overshoot by design (damping < 1). That is
 * right for gesture-driven motion, which can be interrupted and retargeted. It is
 * wrong for an entry animation: nothing is being dragged, so the overshoot reads
 * as a bounce with no purpose.
 *
 * These use the expressive EFFECTS curves, whose control points are all <= 1 and
 * are therefore bounded by 1: no overshoot at any duration. This also follows
 * M3's own web guidance, which says to use springs only where motion can be
 * interrupted and curves everywhere else.
 *
 * Use `springs` for physical, interruptible motion (the turntable tonearm).
 * Use `transitions` for anything that enters, exits or changes state.
 */
export const transitions: Record<"fast" | "base" | "slow", Transition> = {
  /** Inline reveals, list rows, small state changes. */
  fast: { duration: 0.15, ease: [0.31, 0.94, 0.34, 1] },
  /** The default for panels, cards and section changes. */
  base: { duration: 0.2, ease: [0.34, 0.8, 0.34, 1] },
  /** Full-surface and full-screen changes. */
  slow: { duration: 0.3, ease: [0.34, 0.88, 0.34, 1] },
};
