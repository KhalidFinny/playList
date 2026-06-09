import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { SearchBar } from '@/shared/components/SearchBar';
import { ResultCard } from './ResultCard';
import type { SearchResult } from '@/shared/types';

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
}

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
  vibes
}: RequestFlowProps) {
  return (
    <motion.div 
      key="search-flow"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`max-w-4xl mx-auto w-full relative z-20 flex flex-col items-center px-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        query ? 'pt-32' : 'justify-center min-h-screen'
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
            <p className="text-neutral-400 text-sm font-bold tracking-[0.4em] uppercase">Search for your favorite music</p>
        </div>

        <div className="w-full relative">
          <SearchBar 
            value={query}
            onChange={(val) => {
              setQuery(val);
              setIsConfirmed(false);
            }}
            onSubmit={() => setIsConfirmed(true)}
            placeholder="Find a track, artist or album..."
            loading={loading && isConfirmed}
            className="mb-10"
          />

          <AnimatePresence>
            {suggestions.length > 0 && query.length > 1 && !isConfirmed && (
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
                      onClick={() => {
                        setQuery(suggestion);
                        setIsConfirmed(true);
                      }}
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
              {!isConfirmed && !query ? (
                  <motion.section 
                    key="vibes" 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-wrap justify-center gap-3 mb-12"
                  >
                    {vibes.map((v) => (
                        <button 
                          key={v}
                          onClick={() => {
                            setQuery(v);
                            setIsConfirmed(true);
                          }}
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
                  className={`w-full space-y-3 pb-32 max-h-[55vh] overflow-y-auto pr-2 no-scrollbar transition-opacity duration-300 ${loading && results.length > 0 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
                >
                  {loading && results.length === 0 ? (
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
                    results.map((song) => (
                      <ResultCard 
                        key={song.youtubeId}
                        song={song}
                        isSubmitting={submitting === song.youtubeId}
                        onSelect={(s) => {
                          onSelect(s);
                        }}
                      />
                    ))
                  )}
                </motion.section>
              )}
          </AnimatePresence>
      </div>
    </motion.div>
  );
}
