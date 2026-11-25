import { useEffect } from "react";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { MotionConfig, motion } from "framer-motion";

import { CircleWipe } from "@/shared/components/CircleWipe";
import { useWipeStore } from "@/shared/lib/routeWipe";
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

  // The wipe holds until the next route is actually on screen.
  //
  // The pathname alone is the wrong signal. The router writes the new location
  // into state in the same batch that marks itself pending, so `pathname` changes
  // the instant navigation starts, while the old route is still the one being
  // rendered. Releasing on that let the overlay fade away over the page it was
  // meant to hide — the landing came back for a moment on a cold load, when the
  // route chunks are slow enough to leave a gap. `isLoading` stays true until the
  // new matches are ready, and the two frames after it let them paint.
  const fromPath = useWipeStore((state) => state.fromPath);
  const arrived = useWipeStore((state) => state.arrived);
  const isLoading = useRouterState({ select: (state) => state.isLoading });

  useEffect(() => {
    if (fromPath === null || isLoading || pathname === fromPath) return;

    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(arrived);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pathname, fromPath, isLoading, arrived]);

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
