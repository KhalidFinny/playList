import { useNavigate } from "@tanstack/react-router";

import { Logo } from "./Logo";
import { cn } from "@/shared/lib/utils";

const SIZES = { md: 24, lg: 40, xl: 48 } as const;

/**
 * The hidden admin entry. Double-click the mark to enter.
 *
 * Renders the shared `Logo`.
 *
 * Deliberately low-contrast at rest so it reads as texture rather than an
 * affordance, and comes up to full opacity on hover or focus. The resting opacity
 * is 60% rather than 40%: on the dark surface 40% was faint enough to look like a
 * rendering fault instead of a deliberate mark.
 */
export function SecretDoor({ size = "md" }: { size?: keyof typeof SIZES }) {
  const navigate = useNavigate();

  const handleSecretEntry = () => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <button
      type="button"
      onDoubleClick={handleSecretEntry}
      aria-label="PlayList"
      className={cn(
        "flex shrink-0 cursor-default select-none items-center justify-center rounded-m3-full",
        "opacity-60 outline-none transition-opacity hover:opacity-100",
        "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      <Logo size={SIZES[size]} className="transition-transform active:scale-90" />
    </button>
  );
}
