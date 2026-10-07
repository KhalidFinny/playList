import { Link } from "@tanstack/react-router";

import { cn } from "@/shared/lib/utils";

export interface NavDestination {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Route to navigate to. Omit for a non-routing action. */
  to?: string;
  onClick?: () => void;
}

interface NavigationRailProps {
  destinations: NavDestination[];
  activeId: string;
  /** Leading element above the destinations, usually the brand mark. */
  header?: React.ReactNode;
  /** Trailing element pinned to the bottom. */
  footer?: React.ReactNode;
  /** M3 expanded rail shows labels beside the icons. */
  expanded?: boolean;
  className?: string;
}

/**
 * M3 navigation rail, for medium and expanded window widths.
 *
 * The active indicator is a `full`-radius pill in the secondary-container role,
 * which is what M3 specifies for a selected destination — not an inverted block.
 */
export function NavigationRail({
  destinations,
  activeId,
  header,
  footer,
  expanded = false,
  className,
}: NavigationRailProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col items-center gap-3 bg-surface py-3",
        expanded ? "w-64 items-stretch px-3" : "w-20",
        className,
      )}
    >
      {header && (
        <div className={cn("mb-3 flex justify-center", expanded && "justify-start")}>{header}</div>
      )}

      <ul className={cn("flex flex-1 flex-col gap-3", expanded ? "items-stretch" : "items-center")}>
        {destinations.map((d) => {
          const isActive = d.id === activeId;
          const content = (
            <>
              <span
                className={cn(
                  "relative flex h-8 w-16 shrink-0 items-center justify-center rounded-m3-full transition-colors",
                  isActive
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant",
                )}
              >
                {d.icon}
              </span>
              {expanded && (
                <span
                  className={cn(
                    "text-label-large",
                    isActive ? "text-on-surface" : "text-on-surface-variant",
                  )}
                >
                  {d.label}
                </span>
              )}
            </>
          );

          const shared = cn(
            "state-layer flex items-center gap-3 rounded-m3-full outline-none transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            expanded ? "h-14 px-3" : "h-14 w-16 flex-col justify-center gap-1",
          );

          return (
            <li key={d.id} className={cn(expanded && "w-full")}>
              {d.to ? (
                <Link
                  to={d.to}
                  aria-current={isActive ? "page" : undefined}
                  title={d.label}
                  className={shared}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={d.onClick}
                  aria-current={isActive ? "page" : undefined}
                  title={d.label}
                  className={cn(shared, "w-full")}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {footer && (
        <div className={cn("flex justify-center", expanded && "justify-start")}>{footer}</div>
      )}
    </nav>
  );
}

interface NavigationBarProps {
  destinations: NavDestination[];
  activeId: string;
  className?: string;
}

/**
 * M3 navigation bar, for compact widths. Occupies the space
 * `.mobile-content-area` reserves at the bottom of the viewport.
 */
export function NavigationBar({ destinations, activeId, className }: NavigationBarProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex h-20 items-stretch justify-around",
        "bg-surface-container elevation-3",
        className,
      )}
    >
      {destinations.map((d) => {
        const isActive = d.id === activeId;
        const content = (
          <>
            <span
              className={cn(
                "relative flex h-8 w-16 items-center justify-center rounded-m3-full transition-colors",
                isActive
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant",
              )}
            >
              {d.icon}
            </span>
            <span
              className={cn(
                "text-label-medium",
                isActive ? "text-on-surface" : "text-on-surface-variant",
              )}
            >
              {d.label}
            </span>
          </>
        );

        const shared =
          "state-layer flex flex-1 flex-col items-center justify-center gap-1 py-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

        return d.to ? (
          <Link
            key={d.id}
            to={d.to}
            aria-current={isActive ? "page" : undefined}
            className={shared}
          >
            {content}
          </Link>
        ) : (
          <button
            key={d.id}
            type="button"
            onClick={d.onClick}
            aria-current={isActive ? "page" : undefined}
            className={shared}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}

/** Sliding active indicator shared by both navigations. */
