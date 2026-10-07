import logoUrl from "@/assets/logo.svg";
import { cn } from "@/shared/lib/utils";

interface LogoProps {
  /** Rendered box in px. The mark is square. */
  size?: number;
  className?: string;
}

/**
 * The PlayList brand mark.
 *
 * One component for every logo placement, so the artwork lives in exactly one
 * place.
 *
 * The artwork is drawn on its own background and is **transparent**: no plate,
 * in either mode. Its plum gradients (#39283F, #64303B) measure ~1.4:1 against
 * the dark surface, so on dark the mark reads mainly through its white outlines
 * and the orange arrow. That is intentional — a light plate behind it was tried
 * and rejected as a visible box around the logo.
 *
 * The SVG carries its own fills, so `text-*` has no effect on it.
 *
 * Decorative: the surrounding text already names the app, so it is hidden from
 * assistive tech.
 */
export function Logo({ size = 64, className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
    />
  );
}
