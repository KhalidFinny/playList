import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { springsFm } from "@/shared/motion/springs";

/**
 * Route content.
 *
 * Keyed by pathname so a change of screen is a change of element: the panel
 * fades and lifts in from just below, which is the M3 "content enters" pattern
 * rather than a slide across the whole surface. Only the pathname keys it, so a
 * tab switch inside one page (which does not touch the URL) does not animate,
 * and the audio element in a room is not torn down by its own re-render.
 *
 * The lift is a spatial spring and the fade is a short tween: a spring on opacity
 * looks like a flicker, and a tween on position reads mechanical. No exit
 * animation, because waiting for the old screen to leave delays the new one for
 * no benefit.
 */
function RouteContent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springsFm.defaultSpatial, opacity: { duration: 0.22, ease: "easeOut" } }}
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
