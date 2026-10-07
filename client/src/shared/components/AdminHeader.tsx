import { Link } from "@tanstack/react-router";
import { LogOut, Home } from "lucide-react";

import type { TabItem } from "./Tabs";
import { SecretDoor } from "./SecretDoor";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/shared/lib/utils";

interface AdminHeaderProps {
  user?: {
    username: string;
    role: string;
  };
  connected?: boolean;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  onLogout: () => void;
  showBackToHub?: boolean;
  title?: string;
}

/**
 * M3 top app bar — one compact row.
 *
 * Everything lives on a single 56px line: the mark and title lead, the
 * destinations follow inline after a divider, and the trailing cluster is status,
 * identity and actions. The previous header spent two rows (112px) on this, with
 * five ungrouped items trailing and no separation between "what state am I in"
 * and "what can I do".
 *
 * The bar is opaque `surface` — M3 app bars are not glass.
 */
export function AdminHeader({
  user,
  connected = true,
  tabs,
  activeTab,
  onTabChange,
  onLogout,
  showBackToHub = false,
  title,
}: AdminHeaderProps) {
  const hasTabs = Boolean(tabs?.length && activeTab && onTabChange);

  return (
    <header className="sticky top-0 z-50 bg-surface">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-6">
        {/* Leading: mark + a single title line */}
        <div className="flex shrink-0 items-center gap-2.5">
          <SecretDoor size="lg" />
          <span className="truncate text-title-medium">{title ?? "Archive Admin"}</span>
        </div>

        {hasTabs && (
          <>
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-outline-variant" />

            <nav
              className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
              role="tablist"
              aria-label="Dashboard sections"
            >
              {tabs!.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onTabChange!(tab.id)}
                    className={cn(
                      "state-layer flex h-9 shrink-0 items-center gap-2 rounded-m3-full px-3 text-title-small transition-colors",
                      isActive ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.trailing}
                  </button>
                );
              })}
            </nav>
          </>
        )}

        {/* Trailing: status, identity, actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="flex shrink-0 items-center px-1" title={connected ? "Live" : "Offline"}>
            <span
              className={cn("size-2.5 rounded-m3-full", connected ? "bg-tertiary" : "bg-error")}
            />
            <span className="sr-only">{connected ? "Live" : "Offline"}</span>
          </span>

          {user && (
            <div className="flex shrink-0 items-center gap-2.5 pl-1">
              <span className="flex size-9 items-center justify-center rounded-m3-full bg-primary-container text-label-large text-on-primary-container">
                {user.username.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-title-small md:inline">{user.username}</span>
            </div>
          )}

          {showBackToHub && (
            <Link
              to="/admin"
              aria-label="Back to hub"
              title="Back to hub"
              className="state-layer flex size-10 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Home size={20} />
            </Link>
          )}

          <ThemeToggle />

          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="state-layer flex size-10 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
