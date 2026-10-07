import { Music, Plus, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/button";
import type { SearchResult } from "@/shared/types";

interface ResultCardProps {
  song: SearchResult;
  onSelect: (song: SearchResult) => void;
  isSubmitting: boolean;
  cooldownSeconds?: number;
}

/**
 * A search result row, shared by the participant and admin search rooms.
 *
 * A flat row rather than a card: a list of these is scanned, not browsed, so the
 * artwork thumbnail and the type carry it and the container would only add noise.
 * Hover tints the row. The trailing action is a `filled` icon button; cooldown
 * state uses the secondary-container role rather than a shifted orange.
 */
export function ResultCard({ song, onSelect, isSubmitting, cooldownSeconds = 0 }: ResultCardProps) {
  const isOnCooldown = cooldownSeconds > 0;
  const disabled = isSubmitting || isOnCooldown;

  return (
    <div className="group flex items-center gap-3 rounded-m3-md px-3 py-2.5 transition-colors hover:bg-surface-container">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-m3-sm bg-surface-container-highest">
        {song.thumbnail ? (
          <img src={song.thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <Music size={18} className="text-on-surface-variant" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate text-title-small">{song.title}</h4>
        <p className="mt-0.5 truncate text-body-small text-on-surface-variant">
          {song.author}
          {song.duration ? ` · ${song.duration}` : ""}
        </p>
      </div>

      <Button
        onClick={() => onSelect(song)}
        disabled={disabled}
        variant={isOnCooldown ? "tonal" : "filled"}
        size="icon"
        aria-label={isOnCooldown ? `Wait ${cooldownSeconds}s` : `Add ${song.title}`}
      >
        {isSubmitting ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isOnCooldown ? (
          <span className="text-label-large tabular-nums">{cooldownSeconds}</span>
        ) : (
          <Plus size={20} />
        )}
      </Button>
    </div>
  );
}
