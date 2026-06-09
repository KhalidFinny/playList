import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const musicFacts = [
  "The world's longest concert lasted 453 hours.",
  "Monaco's army is smaller than its military orchestra.",
  "Leo Fender, the inventor of the Stratocaster, couldn't play guitar.",
  'Plants grow faster when listening to music.',
  "The Beatles used the word 'love' 613 times in their songs.",
  'Music triggers the same brain chemicals as chocolate.',
  "Warner Bros. used to pay $2 million a year for the rights to 'Happy Birthday'.",
  'The most expensive musical instrument sold for $15.9 million.',
  'Beethoven used to dip his head in cold water before composing.',
  "Anish Kapoor's 'Leviathan' is the world's largest musical instrument.",
];

interface LoadingOverlayProps {
  isLoading: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
  const fact = musicFacts[0];

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-[#050505] text-white"
        >
          {/* Mini Spinning Vinyl */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="relative w-24 h-24 mb-12"
          >
            {/* Vinyl Body */}
            <div className="absolute inset-0 bg-[#151515] rounded-full border-2 border-white/5 shadow-2xl shadow-orange-500/20" />

            {/* Grooves */}
            <div className="absolute inset-2 border border-white/5 rounded-full" />
            <div className="absolute inset-4 border border-white/5 rounded-full" />
            <div className="absolute inset-6 border border-white/5 rounded-full" />

            {/* Label */}
            <div className="absolute inset-[30%] bg-orange-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-[#050505] rounded-full" />
            </div>

            {/* Shine */}
            <div className="absolute inset-0 rounded-full bg-linear-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
          </motion.div>

          {/* Loading Text & Fact */}
          <div className="text-center max-w-md px-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <h2 className="text-4xl font-bebas tracking-widest text-orange-500 mb-2">
                LOADING SIGNAL
              </h2>
              <div className="w-12 h-1 bg-orange-500 mx-auto shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="space-y-2"
            >
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/20">
                DID YOU KNOW?
              </p>
              <p className="text-lg font-syne text-white/80 leading-relaxed italic">"{fact}"</p>
            </motion.div>
          </div>

          {/* Progress Bar (Fake) */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 h-px bg-white/10 overflow-hidden">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{ duration: 2, ease: 'easeInOut' }}
              className="w-full h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
