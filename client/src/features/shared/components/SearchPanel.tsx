import { Search, TrendingUp } from "lucide-react";

import { Chip } from "@/shared/components/chip";
import { SearchBar } from "@/shared/components/SearchBar";
import { Shape } from "@/shared/shapes/shape";
import { ResultCard } from "@/features/participant/components/ResultCard";
import { useTopTracks } from "@/features/shared/hooks/useTopTracks";
import type { SearchResult } from "@/shared/types";

interface SearchPanelProps {
  /** Single-line page heading. */
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** True once a search has actually been submitted; results only show then. */
  isConfirmed: boolean;
  loading?: boolean;
  suggestions: string[];
  onSelectSuggestion: (suggestion: string) => void;
  vibes: string[];
  onVibe: (vibe: string) => void;
  results: SearchResult[];
  onSelect: (song: SearchResult) => void;
  submittingId?: string | null;
  cooldownSeconds?: number;
}

/**
 * The search room, shared by participants and admins.
 *
 * One component so the two roles cannot drift apart. Layout is the "command"
 * variant: left-anchored under a single-line heading, and **suggestions render
 * inline as list rows** rather than in an overlay — the overlay covered the
 * results exactly while you were typing, which is when you want to see them.
 */
export function SearchPanel({
  title,
  value,
  onChange,
  onSubmit,
  isConfirmed,
  loading = false,
  suggestions,
  onSelectSuggestion,
  vibes,
  onVibe,
  results,
  onSelect,
  submittingId = null,
  cooldownSeconds = 0,
}: SearchPanelProps) {
  const topTracks = useTopTracks();
  const showSuggestions = !isConfirmed && value.length > 1 && suggestions.length > 0;
  const showVibes = !isConfirmed && !value;
  const showChart = !isConfirmed && !value && topTracks.length > 0;
  const showResults = isConfirmed;
  const isStale = loading && results.length > 0;

  return (
    <div className="relative z-20 mx-auto w-full max-w-[820px] px-4">
      <h1 className="text-headline-small">{title}</h1>

      <div className="mt-4">
        <SearchBar
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Find a track, artist or album…"
          loading={loading && isConfirmed}
        />
      </div>

      {showVibes && (
        <div className="mt-4 flex flex-wrap gap-2">
          {vibes.map((vibe) => (
            <Chip key={vibe} onClick={() => onVibe(vibe)}>
              {vibe}
            </Chip>
          ))}
        </div>
      )}

      {showChart && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-title-medium">
            <TrendingUp size={18} className="text-primary" />
            Top 10 this week
          </h2>

          <ol className="mt-2">
            {topTracks.map((track, index) => (
              <li key={track.youtubeId}>
                <button
                  type="button"
                  onClick={() => onVibe(track.title)}
                  className="flex w-full items-baseline gap-3 rounded-m3-md px-3 py-2 text-left outline-none hover:bg-surface-container focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="w-5 shrink-0 text-label-medium tabular-nums text-on-surface-variant">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-title-small">{track.title}</span>
                    <span className="mt-0.5 block truncate text-body-small text-on-surface-variant">
                      {track.author}
                    </span>
                  </span>
                  <span className="shrink-0 text-label-medium tabular-nums text-on-surface-variant">
                    {track.requests}×
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {showSuggestions && (
        <div className="mt-4 border-b border-outline-variant pb-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSelectSuggestion(suggestion)}
              className="flex w-full items-center gap-3 rounded-m3-md px-3 py-2 text-left outline-none hover:bg-surface-container focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <Search size={16} className="shrink-0 text-on-surface-variant" />
              <span className="truncate text-body-large">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {showResults && (
        <div
          className={`mt-4 flex flex-col gap-1 transition-opacity duration-200 ${
            isStale ? "pointer-events-none opacity-40" : "opacity-100"
          }`}
        >
          {loading && results.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex h-[4.5rem] animate-pulse items-center gap-3 p-3">
                <div className="size-12 shrink-0 rounded-m3-sm bg-surface-container-highest" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded-m3-full bg-surface-container-highest" />
                  <div className="h-2.5 w-1/4 rounded-m3-full bg-surface-container-highest" />
                </div>
              </div>
            ))
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Shape name="cookie12" size={48} className="text-on-surface-variant" />
              <p className="text-title-medium text-on-surface-variant">No tracks found</p>
            </div>
          ) : (
            results.map((song) => (
              <ResultCard
                key={song.youtubeId}
                song={song}
                isSubmitting={submittingId === song.youtubeId}
                cooldownSeconds={cooldownSeconds}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
