export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/**
 * `?theme=light|dark` forces a theme and takes precedence over both the stored
 * choice and the OS preference. Used for screenshots and manual checks.
 *
 * It has to live here rather than only in the entry point: the toggle also reads
 * the theme, and if the two disagreed the toggle's mount effect would immediately
 * overwrite the forced value.
 */
function forcedTheme(): Theme | null {
  const value = new URLSearchParams(window.location.search).get("theme");
  return value === "light" || value === "dark" ? value : null;
}

/**
 * The theme actually in effect.
 *
 * Precedence: an explicit `?theme=`, then a stored choice, then the OS
 * preference. The same order runs in the inline script in `index.html` so the
 * first paint already matches; keep the two in sync.
 */
export function getTheme(): Theme {
  const forced = forcedTheme();
  if (forced) return forced;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies a theme to the document root. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

/** Applies and remembers a theme. */
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Flips the current theme and remembers the result. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Subscribes to OS theme changes, for as long as no explicit choice is stored. */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (forcedTheme() || localStorage.getItem(STORAGE_KEY)) return;
    const theme = getTheme();
    applyTheme(theme);
    onChange(theme);
  };
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}
