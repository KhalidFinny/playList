import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * Text field.
 *
 * Deliberately NOT the M3 filled or outlined text field. Those are recognisable
 * as Google's: a floating label that animates into the border, plus either a
 * bottom indicator line or a notched outline. That reads as a default rather than
 * as this product.
 *
 * Ours is simpler and quieter: a static label above a plain surface with a small
 * radius. No floating label, no underline, no notch. Focus and error are carried
 * by the border only, so nothing moves when the field is used.
 */

const fieldVariants = cva(
  "flex w-full items-center gap-2 border bg-surface-container-lowest transition-colors",
  {
    variants: {
      size: {
        sm: "h-10 rounded-m3-xs px-3",
        md: "h-12 rounded-m3-sm px-3.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const inputVariants = cva(
  "h-full w-full min-w-0 bg-transparent text-body-large text-on-surface outline-none disabled:cursor-not-allowed disabled:opacity-38 placeholder:text-on-surface-variant/60",
  {
    variants: {
      align: {
        left: "",
        center: "text-center",
      },
    },
    defaultVariants: { align: "left" },
  },
);

export interface TextFieldProps
  extends
    Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof fieldVariants>,
    VariantProps<typeof inputVariants> {
  label?: string;
  /** Error text. Also switches the field to the error role. */
  error?: string;
  /** Supporting line under the field. Ignored when `error` is set. */
  hint?: string;
  /** Rendered inside the field on the trailing edge. */
  trailing?: React.ReactNode;
  containerClassName?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { className, containerClassName, label, error, hint, trailing, size, id, align, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

    return (
      <div className={cn("flex w-full flex-col gap-1.5", containerClassName)}>
        {label && (
          <label htmlFor={fieldId} className="text-label-large text-on-surface-variant">
            {label}
          </label>
        )}

        <div
          className={cn(
            fieldVariants({ size }),
            error
              ? "border-error"
              : "border-outline-variant focus-within:border-primary focus-within:border-2",
          )}
        >
          <input
            ref={ref}
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(inputVariants({ align }), className)}
            {...props}
          />
          {trailing}
        </div>

        {error ? (
          <p id={`${fieldId}-error`} className="text-body-small text-error">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="text-body-small text-on-surface-variant">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = "TextField";

/**
 * Bare input with the same surface treatment, for callers that supply their own
 * label or render inline (editing a row in a list).
 */
export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">, VariantProps<typeof inputVariants> {
  size?: TextFieldProps["size"];
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, align, size = "md", ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        inputVariants({ align }),
        size === "sm" && "h-10",
        size === "md" && "h-12",
        "rounded-m3-sm border border-outline-variant bg-surface-container-lowest px-3.5",
        "focus:border-2 focus:border-primary",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { fieldVariants, inputVariants };
