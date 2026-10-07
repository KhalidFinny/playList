import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * M3 badge — a small count or status dot, not a chip. Use `Chip` for anything
 * with a label.
 */
const badgeVariants = cva("inline-flex items-center justify-center rounded-m3-full", {
  variants: {
    variant: {
      dot: "size-1.5 bg-error",
      count: "h-4 min-w-4 bg-error px-1 text-label-small text-on-error",
      status: "size-2.5",
    },
  },
  defaultVariants: { variant: "count" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
