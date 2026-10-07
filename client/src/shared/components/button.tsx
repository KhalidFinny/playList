import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * M3 common button.
 *
 * Shape: `full` radius at every size — buttons are the one role M3 pills.
 * State: an inset-shadow state layer (`state-layer`) so hover/press keep the
 * label's contrast relationship instead of shifting the background.
 *
 * Sizes follow the M3 Expressive scale: xs 32, sm 40, md 56, lg 96, xl 136.
 * `md` is the M3 default; use `sm` in dense surfaces (tables, list rows).
 */
const buttonVariants = cva(
  "state-layer inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-m3-full font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:bg-on-surface/12 disabled:text-on-surface/38 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        filled: "bg-primary text-on-primary",
        tonal: "bg-secondary-container text-on-secondary-container",
        elevated: "bg-surface-container-low text-primary elevation-1",
        outlined: "border border-outline bg-transparent text-primary",
        text: "bg-transparent text-primary",
        danger: "bg-error text-on-error",
        success: "bg-tertiary text-on-tertiary",
      },
      size: {
        xs: "h-8 px-4 text-label-large [&_svg]:size-5",
        sm: "h-10 px-6 text-label-large [&_svg]:size-5",
        md: "h-14 px-6 text-title-medium [&_svg]:size-6",
        lg: "h-24 px-8 text-title-large [&_svg]:size-8",
        xl: "h-34 px-12 text-headline-small [&_svg]:size-10",
        icon: "size-10 rounded-m3-full p-0 [&_svg]:size-6",
        "icon-sm": "size-8 rounded-m3-full p-0 [&_svg]:size-5",
        "icon-lg": "size-14 rounded-m3-full p-0 [&_svg]:size-8",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "sm",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
