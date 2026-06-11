import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { SearchBar } from '@/shared/components/SearchBar';
import { ResultCard } from '@/features/participant/components/ResultCard';
import type { SongSearchProps } from '../types';

// Quick vibe categories for admin
const VIBES = [
  'Chill Vibes',
  'Throwback Hits',
  'Late Night Drive',
  'Workout Energy',
  'Indie Discovery',
  'Coffee Shop',
];

export function SongSearch({
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchResults,
  suggestions,
  onSelectSuggestion,
  handleAddSong,
  submittingId
}: SongSearchProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const prevSubmittingRef = useRef(submittingId);

  // Detect when add completes: submittingId goes from non-null → null
  useEffect(() => {
    const prev = prevSubmittingRef.current;
    prevSubmittingRef.current = submittingId;
    if (prev !== null && submittingId === null) {
      setToast('Added to queue');
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [submittingId]);

  const handleQueryChange = useCallback((val: string) => {
    setSearchQuery(val);
    setIsConfirmed(false);
  }, [setSearchQuery]);

  const handleSubmit = useCallback(() => {
    setIsConfirmed(true);
    // Trigger the actual search on Enter, same as clicking a suggestion
    if (searchQuery.trim().length >= 2) {
      onSelectSuggestion(searchQuery);
    }
  }, [searchQuery, onSelectSuggestion]);

  const handleVibe = useCallback((vibe: string) => {
    setSearchQuery(vibe);
    setIsConfirmed(true);
    // Trigger the actual search for this vibe
    onSelectSuggestion(vibe);
  }, [setSearchQuery, onSelectSuggestion]);

  // Custom select suggestion that also confirms search
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    onSelectSuggestion(suggestion);
    // onSelectSuggestion already sets searchQuery, we just need to mark as confirmed
    // Actually, the participant flow sets the query AND searches on suggestion click
    // but onSelectSuggestion in admin only triggers search, doesn't set query.
    // Let's set the query too:
    setSearchQuery(suggestion);
    setIsConfirmed(true);
  }, [onSelectSuggestion, setSearchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`max-w-4xl mx-auto w-full relative z-20 flex flex-col items-center px-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        searchQuery ? 'pt-32' : 'justify-center min-h-[calc(100vh-14rem)]'
      }`}
    >
      <motion.div 
        layout 
        transition={{ 
          layout: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.4 }
        }}
        className="w-full flex flex-col items-center"
      >
        <div className="mb-12 text-center">
            <h1 className="text-6xl md:text-7xl font-bebas tracking-tighter text-neutral-800 mb-2 uppercase leading-none">
                Search your vibe
            </h1>
            <p className="text-neutral-400 text-sm font-bold tracking-[0.4em] uppercase">Add tracks straight to the queue</p>
        </div>

        <div className="w-full relative">
          <SearchBar 
            value={searchQuery}
            onChange={handleQueryChange}
            onSubmit={handleSubmit}
            placeholder="Find a track, artist or album..."
            loading={searchLoading && isConfirmed}
            className="mb-10"
          />

          <AnimatePresence>
            {suggestions.length > 0 && searchQuery.length > 1 && !isConfirmed && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl mt-2 py-4 z-100 overflow-hidden shadow-2xl shadow-black/10"
              >
                <div className="max-h-[320px] overflow-y-auto no-scrollbar">
                  {suggestions.map((suggestion: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="w-full text-left px-8 py-4 hover:bg-black/5 transition-colors flex items-center gap-4 group"
                    >
                      <Search size={18} className="text-black/20 group-hover:text-orange-500" />
                      <span className="text-black/60 font-bold group-hover:text-black">{suggestion}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="w-full">
          <AnimatePresence mode="wait">
              {!isConfirmed && !searchQuery ? (
                  <motion.section 
                    key="vibes" 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-wrap justify-center gap-3 mb-12"
                  >
                    {VIBES.map((v) => (
                        <button 
                          key={v}
                          onClick={() => handleVibe(v)}
                          className="px-6 py-2 bg-white border border-black/10 rounded-full text-sm font-bold text-black/40 uppercase tracking-widest hover:border-black hover:text-black transition-all"
                        >
                            {v}
                        </button>
                    ))}
                  </motion.section>
              ) : (
                <motion.section 
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`w-full space-y-3 pb-32 max-h-[55vh] overflow-y-auto pr-2 no-scrollbar transition-opacity duration-300 ${searchLoading && searchResults.length > 0 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
                >
                  {searchLoading && searchResults.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="bg-white border border-black/10 rounded-2xl p-4 h-20 animate-pulse flex items-center gap-4">
                        <div className="w-12 h-12 bg-black/5 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-black/5 rounded w-1/3" />
                          <div className="h-2 bg-black/5 rounded w-1/4" />
                        </div>
                      </div>
                    ))
                  ) : (
                    searchResults.map((song) => (
                      <ResultCard 
                        key={song.youtubeId}
                        song={song}
                        isSubmitting={submittingId === song.youtubeId}
                        onSelect={handleAddSong}
                      />
                    ))
                  )}
                </motion.section>
              )}
          </AnimatePresence>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed bottom-28 lg:bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-sm font-bold tracking-wide">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
