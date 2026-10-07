import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * M3 chip. `small` radius (8px) — chips are compact tokens, which is the one
 * place a tighter radius is correct rather than a pill.
 *
 * `selected` uses the secondary-container role, per M3's filter/input chips.
 */
const chipVariants = cva(
  "state-layer inline-flex h-8 shrink-0 items-center gap-2 rounded-m3-sm border px-3 text-label-large outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-38 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        assist:
          "border-outline-variant bg-transparent text-on-surface-variant hover:text-on-surface",
        filter: "border-outline-variant bg-transparent text-on-surface-variant",
        suggestion: "border-outline-variant bg-transparent text-on-surface-variant",
      },
      selected: {
        true: "border-transparent bg-secondary-container text-on-secondary-container",
        false: "",
      },
    },
    defaultVariants: { variant: "assist", selected: false },
  },
);

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof chipVariants> {}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, variant, selected, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected ?? undefined}
      className={cn(chipVariants({ variant, selected, className }))}
      {...props}
    />
  ),
);
Chip.displayName = "Chip";

export { chipVariants };
