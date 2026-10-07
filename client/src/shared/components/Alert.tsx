import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { transitions } from "@/shared/motion/springs";

export type AlertType = "error" | "success" | "info" | "warning";

interface AlertProps {
  type?: AlertType;
  title?: string;
  message: string;
  onClose?: () => void;
  isVisible?: boolean;
}

/**
 * Inline M3 status message. Uses M3 container roles rather than raw
 * red/green/amber, so it inherits the token layer and the dark scheme.
 *
 * `success` maps to the tertiary role (this palette's tertiary is a plum), which
 * keeps semantic feedback inside the color system.
 */
const alertStyles: Record<AlertType, { container: string; icon: React.ReactNode }> = {
  error: {
    container: "bg-error-container text-on-error-container",
    icon: <XCircle className="size-5 shrink-0" />,
  },
  success: {
    container: "bg-tertiary-container text-on-tertiary-container",
    icon: <CheckCircle className="size-5 shrink-0" />,
  },
  info: {
    container: "bg-surface-container-high text-on-surface",
    icon: <Info className="size-5 shrink-0" />,
  },
  warning: {
    container: "bg-secondary-container text-on-secondary-container",
    icon: <AlertCircle className="size-5 shrink-0" />,
  },
};

export function Alert({ type = "info", title, message, onClose, isVisible = true }: AlertProps) {
  const styles = alertStyles[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={transitions.fast}
          className={cn(
            "flex w-full items-start gap-3 rounded-m3-md px-4 py-3 text-body-medium",
            styles.container,
          )}
        >
          {styles.icon}
          <div className="flex-1">
            {title && <p className="text-title-small">{title}</p>}
            <p>{message}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Dismiss"
              className="state-layer -mr-1 flex size-8 shrink-0 items-center justify-center rounded-m3-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X size={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
