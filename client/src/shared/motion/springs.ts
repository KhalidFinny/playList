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

/**
 * The same tokens as real physics, for Framer Motion.
 *
 * A spring is defined by mass, stiffness and damping ratio; Framer takes mass
 * and damping *coefficient*, so the ratio is doubled against the critical
 * damping. This is what makes an oversized move feel like material and not a
 * curve: the velocity carries through an interruption instead of restarting.
 */
const physics = (token: Spring, mass = 1): Transition => ({
  type: "spring",
  mass,
  stiffness: token.stiffness,
  damping: 2 * token.damping * Math.sqrt(token.stiffness),
  restDelta: 0.001,
});

export const springsFm = {
  fastSpatial: physics(motion.fastSpatial),
  defaultSpatial: physics(motion.defaultSpatial),
  slowSpatial: physics(motion.slowSpatial),
  fastEffects: physics(motion.fastEffects),
  defaultEffects: physics(motion.defaultEffects),
  slowEffects: physics(motion.slowEffects),
} as const;

/**
 * Critically damped springs, for UI that enters or changes state.
 *
 * The expressive spatial tokens above overshoot by design (damping 0.6 to 0.8),
 * which is right for something you are dragging and can interrupt, and wrong for
 * a panel appearing: nothing is being pushed, so the overshoot reads as a bounce
 * with no cause. These use damping 1, where the value approaches its target as
 * fast as it can without ever passing it. That is the "weighted but calm" feel:
 * it moves with momentum instead of arriving on a curve, and it never wobbles.
 *
 * Prefer these for anything that moves. Keep `transitions` for pure opacity,
 * where a spring is invisible and a tween is cheaper.
 */
const damped = (stiffness: number): Transition => ({
  type: "spring",
  mass: 1,
  stiffness,
  damping: 2 * Math.sqrt(stiffness),
  restDelta: 0.001,
});

export const smooth = {
  /** Small moves: a row, a chip, a menu. Settles in about 0.2s. */
  quick: damped(620),
  /** The default for panels, dialogs, and page content. About 0.3s. */
  base: damped(420),
  /** Large surfaces and full-screen changes. About 0.45s. */
  slow: damped(260),
} as const;
