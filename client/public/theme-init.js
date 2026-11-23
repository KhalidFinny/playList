/*
  Applies the stored (or system) theme before first paint, so a dark-mode user
  never sees a light flash.

  This is a file rather than an inline <script> so the Content-Security-Policy can
  forbid inline scripts outright. Keep it in sync with `shared/lib/theme.ts`.
*/
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
  } catch (e) {
    /* private mode: fall through to light */
  }
})();
