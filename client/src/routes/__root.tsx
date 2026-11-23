import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { MotionConfig, motion } from "framer-motion";

import { CircleWipe } from "@/shared/components/CircleWipe";
import { NotFound } from "@/shared/components/NotFound";
import { smooth } from "@/shared/motion/springs";

/**
 * Route content.
 *
 * One transition for every route: a short fade with a small rise, on a critically
 * damped spring. The content arrives with momentum and settles rather than
 * appearing, and nothing overshoots, so it reads as weight rather than bounce.
 * Every navigation uses the same move, which is what makes the app feel
 * predictable rather than like a different effect per screen.
 *
 * The landing page's circle wipe is the one deliberate exception, and it is a
 * separate overlay rather than a variation of this fade.
 *
 * Keyed by pathname so a change of screen is a change of element. Only the
 * pathname keys it, so a tab switch inside one page does not animate, and the
 * audio element in a room is not torn down by its own re-render.
 */
function RouteContent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...smooth.base, opacity: { duration: 0.2, ease: "easeOut" } }}
    >
      <Outlet />
    </motion.div>
  );
}

export const Route = createRootRoute({
  // Any path the router cannot match renders this instead of an empty page.
  notFoundComponent: NotFound,
  component: () => (
    // `reducedMotion="user"` is what makes every Framer animation in the app
    // respect the OS setting: movement collapses to a crossfade, and the layout
    // never jumps. Without it only the one component that checked by hand did.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-surface text-on-surface selection:bg-primary selection:text-on-primary">
        <RouteContent />
        <CircleWipe />
      </div>
    </MotionConfig>
  ),
});
