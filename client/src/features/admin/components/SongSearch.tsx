import { useState, useEffect, useCallback, useRef } from "react";

import { SearchPanel } from "@/features/shared/components/SearchPanel";
import { Snackbar } from "@/shared/components/snackbar";
import type { SongSearchProps } from "../types";

const VIBES = [
  "Chill Vibes",
  "Throwback Hits",
  "Late Night Drive",
  "Workout Energy",
  "Indie Discovery",
  "Coffee Shop",
];

/**
 * The admin search room (FIND TRACKS). Layout lives in `SearchPanel`, which the
 * participant search shares, so the two roles cannot drift apart.
 */
export function SongSearch({
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchResults,
  suggestions,
  onSelectSuggestion,
  handleAddSong,
  submittingId,
}: SongSearchProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const prevSubmittingRef = useRef(submittingId);

  useEffect(() => {
    const prev = prevSubmittingRef.current;
    prevSubmittingRef.current = submittingId;
    if (prev !== null && submittingId === null) {
      setToast("Added to queue");
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [submittingId]);

  const handleQueryChange = useCallback(
    (val: string) => {
      setSearchQuery(val);
      setIsConfirmed(false);
    },
    [setSearchQuery],
  );

  const handleSubmit = useCallback(() => {
    setIsConfirmed(true);
    if (searchQuery.trim().length >= 2) {
      onSelectSuggestion(searchQuery);
    }
  }, [searchQuery, onSelectSuggestion]);

  const handleVibe = useCallback(
    (vibe: string) => {
      setSearchQuery(vibe);
      setIsConfirmed(true);
      onSelectSuggestion(vibe);
    },
    [setSearchQuery, onSelectSuggestion],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      onSelectSuggestion(suggestion);
      setSearchQuery(suggestion);
      setIsConfirmed(true);
    },
    [onSelectSuggestion, setSearchQuery],
  );

  return (
    <>
      <SearchPanel
        title="Add a track"
        value={searchQuery}
        onChange={handleQueryChange}
        onSubmit={handleSubmit}
        isConfirmed={isConfirmed}
        loading={searchLoading}
        suggestions={suggestions}
        onSelectSuggestion={handleSuggestionSelect}
        vibes={VIBES}
        onVibe={handleVibe}
        results={searchResults}
        onSelect={handleAddSong}
        submittingId={submittingId}
      />

      <Snackbar
        message={toast ?? ""}
        type="success"
        isOpen={toast !== null}
        onClose={() => setToast(null)}
      />
    </>
  );
}
