import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { transitions } from "@/shared/motion/springs";

export interface TabItem {
  id: string;
  label: string;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Optional trailing content, e.g. a count badge. */
  trailing?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * M3 primary tabs.
 *
 * The active indicator is a 3px full-width bar in the primary role, animated
 * with a shared `layoutId` so it slides between tabs. There is no `activeColor`
 * prop — color comes from the token layer.
 */
export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <nav
      className={cn(
        "flex items-stretch gap-1 overflow-x-auto border-b border-outline-variant",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "state-layer relative flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-t-m3-xs px-4 text-title-small transition-colors",
              isActive ? "text-primary" : "text-on-surface-variant",
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.trailing}
            {isActive && (
              <motion.div
                layoutId="m3-tab-indicator"
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-primary"
                transition={transitions.fast}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
