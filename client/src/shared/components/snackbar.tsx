import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { transitions } from "@/shared/motion/springs";

export type SnackbarType = "info" | "success" | "error";

interface SnackbarProps {
  message: string;
  type?: SnackbarType;
  isOpen: boolean;
  /** Omit to render without a dismiss button (for auto-clearing messages). */
  onClose?: () => void;
  /** Optional single action. */
  actionLabel?: string;
  onAction?: () => void;
}

const icons: Record<SnackbarType, React.ReactNode> = {
  info: <Info className="size-5 shrink-0" />,
  success: <CheckCircle className="size-5 shrink-0" />,
  error: <XCircle className="size-5 shrink-0" />,
};

/**
 * M3 snackbar. `inverse-surface` roles so it reads as a floating layer, at the
 * `extra-small` radius M3 specifies for menus and snackbars.
 */
export function Snackbar({
  message,
  type = "info",
  isOpen,
  onClose,
  actionLabel,
  onAction,
}: SnackbarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={transitions.base}
          className={cn(
            "fixed bottom-6 left-1/2 z-100 flex -translate-x-1/2 items-center gap-3",
            "min-w-80 max-w-[calc(100vw-2rem)] rounded-m3-xs bg-inverse-surface px-4 py-3",
            "text-body-medium text-inverse-on-surface elevation-3",
          )}
        >
          {icons[type]}
          <span className="flex-1">{message}</span>
          {actionLabel && (
            <button
              onClick={onAction}
              className="state-layer -mr-2 rounded-m3-xs px-3 py-2 text-label-large text-inverse-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse-primary"
            >
              {actionLabel}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Dismiss"
              className="state-layer -mr-1 flex size-8 shrink-0 items-center justify-center rounded-m3-full text-inverse-on-surface/70 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse-primary"
            >
              <X size={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
