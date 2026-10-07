import { Search, Loader2, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

/**
 * M3 search bar: `full` radius on `surface-container-high`, 56px tall, with the
 * leading search affordance and a trailing clear action.
 *
 * M3 search bars are a fixed size — the previous implementation scaled the input
 * text up to 48px, which is a display type role applied to an input.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  loading = false,
  className,
  onClear,
  autoFocus = false,
  onSubmit,
}: SearchBarProps) {
  return (
    <div className={cn("group relative flex w-full items-center", className)}>
      <span className="pointer-events-none absolute left-4 flex items-center text-on-surface-variant">
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
      </span>

      <input
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-14 w-full rounded-m3-full bg-surface-container-high pl-12 pr-12",
          "text-body-large text-on-surface outline-none transition-colors",
          "placeholder:text-on-surface-variant",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />

      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="state-layer absolute right-3 flex size-10 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
