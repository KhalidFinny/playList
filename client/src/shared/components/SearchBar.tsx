import { Search, Loader2, X } from "lucide-react";
import { Input } from "./input";

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

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  loading = false,
  className = "",
  onClear,
  autoFocus = false,
  onSubmit,
}: SearchBarProps) {
  return (
    <div className={`relative group w-full ${className}`}>
      <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-orange-500 transition-colors z-10">
        {loading ? (
          <div className="animate-spin">
            <Loader2 size={22} />
          </div>
        ) : (
          <Search size={22} />
        )}
      </div>

      <Input
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
        className="w-full bg-[#f8f8f7] border-neutral-100 rounded-xl sm:rounded-2xl h-14 sm:h-18 pl-12 sm:pl-16 pr-12 sm:pr-16 text-xl sm:text-5xl font-poppins font-bold text-neutral-600 outline-none focus:bg-white transition-all placeholder:text-neutral-300 shadow-none"
      />

      {value && !loading && (
        <button
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-black/20 hover:text-black transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
