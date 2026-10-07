import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import {
  applyTheme,
  getTheme,
  toggleTheme,
  watchSystemTheme,
  type Theme,
} from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";

/**
 * Light/dark switch.
 *
 * Icon button, so it costs no horizontal space in a header. The icon shows the
 * theme currently in effect rather than the one a click would switch to, which
 * keeps it readable as a state indicator.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = getTheme();
    setTheme(current);
    applyTheme(current);
    return watchSystemTheme(setTheme);
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "state-layer flex size-10 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      {isDark ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
