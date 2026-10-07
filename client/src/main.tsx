import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { applyTheme, getTheme, watchSystemTheme } from "./shared/lib/theme";
import "./index.css";

const router = createRouter({ routeTree });

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
