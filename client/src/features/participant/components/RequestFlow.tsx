import { SearchPanel } from "@/features/shared/components/SearchPanel";
import type { SearchResult } from "@/shared/types";

interface RequestFlowProps {
  query: string;
  setQuery: (q: string) => void;
  isConfirmed: boolean;
  setIsConfirmed: (c: boolean) => void;
  suggestions: string[];
  results: SearchResult[];
  loading: boolean;
  submitting: string | null;
  onSelect: (song: SearchResult) => void;
  vibes: string[];
  cooldownSeconds?: number;
}

/**
 * The participant search room. Layout lives in `SearchPanel`, which the admin
 * search shares, so the two roles cannot drift apart.
 */
export function RequestFlow({
  query,
  setQuery,
  isConfirmed,
  setIsConfirmed,
  suggestions,
  results,
  loading,
  submitting,
  onSelect,
  vibes,
  cooldownSeconds = 0,
}: RequestFlowProps) {
  return (
    <div className="pb-24">
      <SearchPanel
        title="Add a track"
        value={query}
        onChange={(val) => {
          setQuery(val);
          setIsConfirmed(false);
        }}
        onSubmit={() => setIsConfirmed(true)}
        isConfirmed={isConfirmed}
        loading={loading}
        suggestions={suggestions}
        onSelectSuggestion={(suggestion) => {
          setQuery(suggestion);
          setIsConfirmed(true);
        }}
        vibes={vibes}
        onVibe={(vibe) => {
          setQuery(vibe);
          setIsConfirmed(true);
        }}
        results={results}
        onSelect={onSelect}
        submittingId={submitting}
        cooldownSeconds={cooldownSeconds}
      />
    </div>
  );
}
