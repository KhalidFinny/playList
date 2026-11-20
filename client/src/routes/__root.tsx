import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { transitions } from "@/shared/motion/springs";

/**
 * Route content.
 *
 * Keyed by pathname so a change of screen is a change of element: the panel
 * fades and lifts in from just below, which is the M3 "content enters" pattern
 * rather than a slide across the whole surface. Only the pathname keys it, so a
 * tab switch inside one page (which does not touch the URL) does not animate,
 * and the audio element in a room is not torn down by its own re-render.
 *
 * No exit animation: waiting for the old screen to leave delays the new one for
 * no benefit, and the outgoing screen is stale by definition.
 */
function RouteContent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.base}
    >
      <Outlet />
    </motion.div>
  );
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-primary selection:text-on-primary">
      <RouteContent />
    </div>
  ),
});
