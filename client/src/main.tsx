import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { applyTheme, getTheme, watchSystemTheme } from "./shared/lib/theme";
import "./index.css";

/**
 * `defaultPreload: "intent"` is what makes a navigation feel instant.
 *
 * Every route is its own chunk, so without preloading a click has to fetch that
 * chunk before the new screen can render, and the router keeps the current page
 * on screen while it waits. That is the pause that read as "it shows me the old
 * page first". With intent preloading the chunk is already in memory by the time
 * the click lands, because hovering or touching a link started the fetch.
 */
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadDelay: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/**
 * Sync the theme before render.
 *
 * The inline script in `index.html` already applied the stored/system theme to
 * avoid a flash; `getTheme()` also honours a `?theme=` override, which the inline
 * script cannot see. Both the toggle and this call go through `getTheme()`, so
 * they always agree.
 */
applyTheme(getTheme());
watchSystemTheme(applyTheme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// Installs the shell cache. Skipped in dev: a worker would serve stale modules
// between edits.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
