import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * M3 card. Radius is `medium` (12px) — cards are the middle of the shape scale,
 * deliberately not pilled.
 *
 * Layering is tonal: `filled` uses a container role rather than a border+shadow.
 */
const cardVariants = cva("text-on-surface", {
  variants: {
    variant: {
      elevated: "bg-surface-container-low elevation-1",
      filled: "bg-surface-container-highest",
      outlined: "bg-surface border border-outline-variant",
    },
    interactive: {
      true: "state-layer cursor-pointer transition-transform active:scale-[0.99]",
      false: "",
    },
  },
  defaultVariants: {
    variant: "filled",
    interactive: false,
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-m3-md", cardVariants({ variant, interactive, className }))}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-title-medium", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-body-medium text-on-surface-variant", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
