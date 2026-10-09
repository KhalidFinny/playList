import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { transitions } from "@/shared/motion/springs";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional supporting line under the title. */
  description?: string;
  maxWidth?: string;
}

/**
 * M3 basic dialog.
 *
 * Container is `surface-container-high` at `extra-large` radius (28px) — dialogs
 * sit at the top of the shape scale. The backdrop is a flat M3 scrim, not a blur:
 * blur on a scrim reduces text contrast behind it and the project's UI rules
 * reserve translucency for cases that actually need it.
 *
 * Opens with the expressive spatial spring, which overshoots slightly.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-md",
}: ModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.fast}
            onClick={onClose}
            className="absolute inset-0 bg-scrim/32"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={transitions.base}
            className={cn(
              "relative w-full overflow-hidden rounded-m3-xl bg-surface-container-high text-on-surface",
              maxWidth,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-headline-small">{title}</h2>
                {description && (
                  <p className="text-body-medium text-on-surface-variant">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="state-layer -mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
