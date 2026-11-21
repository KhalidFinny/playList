import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { CircleWipe } from "@/shared/components/CircleWipe";

/**
 * Route content.
 *
 * One transition for every route: a short fade. Nothing moves, nothing scales,
 * and every navigation looks the same, which is what makes moving around the app
 * feel predictable rather than like a different effect per screen.
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Outlet />
    </motion.div>
  );
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-primary selection:text-on-primary">
      <RouteContent />
      <CircleWipe />
    </div>
  ),
});
