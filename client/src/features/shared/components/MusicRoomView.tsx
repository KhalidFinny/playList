import { motion } from 'framer-motion';
import { Heart, Share2 } from 'lucide-react';
import { Turntable } from './Turntable';
import { MiniVinyl } from './MiniVinyl';
import { TrackMetadata } from '@/features/music-room/components/TrackMetadata';
import { StationSequence } from '@/features/music-room/components/StationSequence';
import type { Track } from '@/shared/types';

interface MusicRoomViewProps {
  roomId: string;
  nowPlaying: Track | null;
  queue: Track[];
  isPlaying: boolean;
  progress: number;
  currentTime?: number;
  duration?: number;
  role: 'admin' | 'participant';
  onSkip?: () => void;
  onPrevious?: () => void;
  onTogglePlay?: () => void;
  onGoToSearch?: () => void;
}

export function MusicRoomView({
  roomId,
  nowPlaying,
  queue,
  isPlaying,
  progress,
  currentTime = 0,
  duration = 0,
  role,
  onSkip,
  onPrevious,
  onTogglePlay,
  onGoToSearch
}: MusicRoomViewProps) {
  const isAdmin = role === 'admin';
  const hasNextTrack = queue.length > 0;

  return (
    <div className="w-full h-full min-h-0 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 px-2 lg:px-6 overflow-hidden">
      
      {/* LEFT SECTION: Metadata — tablet/desktop only (lg+) */}
      <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col justify-center w-[240px] lg:w-[280px] xl:w-[350px] shrink-0 h-full"
      >
          <div className="flex flex-col justify-center space-y-8 h-full">
            <TrackMetadata track={nowPlaying} currentTime={currentTime} duration={duration} />
            
            {!nowPlaying && (
              <div className="space-y-6">
                <div className="h-6 w-48 bg-black/10 rounded animate-pulse" />
                <p className="text-2xl font-bold text-black/45 uppercase tracking-tighter">
                  The queue is empty.
                </p>
              </div>
            )}
          </div>
      </motion.section>

      {/* CENTRAL SECTION */}
      <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="flex-1 w-full lg:w-auto h-auto lg:h-full flex flex-col items-center justify-center min-w-0 max-w-[860px]"
      >
          {/* Mobile: MiniVinyl — compact record, no clipped needle */}
          <div className="lg:hidden w-full flex flex-col items-center gap-4 py-4">
            <MiniVinyl
              isPlaying={isPlaying}
              progress={progress}
              thumbnail={nowPlaying?.thumbnail}
              onToggle={onTogglePlay}
            />
            
            {/* Track info */}
            {nowPlaying && (
              <div className="text-center px-4 w-full">
                <h2 className="text-lg font-bold text-black tracking-tight truncate">{nowPlaying.title}</h2>
                <p className="text-xs font-bold text-black/40 uppercase tracking-widest mt-1">{nowPlaying.author || 'Unknown'}</p>
              </div>
            )}

            {/* Mobile controls */}
            <div className="flex items-center gap-8 mt-2">
              {isAdmin && (
                <button 
                  onClick={hasNextTrack ? onSkip : undefined}
                  disabled={!hasNextTrack}
                  aria-label={hasNextTrack ? 'Skip to next track' : 'No next track available'}
                  title={hasNextTrack ? 'Skip to next track' : 'No next track available'}
                  className={`transition-colors ${hasNextTrack ? 'text-black/30 hover:text-black' : 'text-black/10 cursor-not-allowed'}`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="4" x2="19" y2="20"/>
                  </svg>
                </button>
              )}
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-[0.3em]">
                {isPlaying ? 'Live' : 'Paused'}
              </span>
              {isAdmin && (
                <button 
                  onClick={onTogglePlay}
                  className="text-black/30 hover:text-black transition-colors"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="4" x2="5" y2="20"/>
                  </svg>
                </button>
              )}

              {!isAdmin && (
                <nav className="flex items-center gap-6">
                  <button className="text-black/20 hover:text-orange-500 transition-colors">
                    <Heart size={18} strokeWidth={1.5} />
                  </button>
                  <button className="text-black/20 hover:text-orange-500 transition-colors">
                    <Share2 size={18} strokeWidth={1.5} />
                  </button>
                </nav>
              )}
            </div>
          </div>

          {/* Desktop/Tablet (lg+): Turntable + controls */}
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:w-full">
            <div className="flex items-center justify-center w-full gap-6 lg:gap-8 xl:gap-16">
              <button
                onClick={isAdmin ? onPrevious : undefined}
                className={`text-black/35 transition-colors shrink-0 ${isAdmin ? 'hover:text-black cursor-pointer' : 'opacity-0 pointer-events-none'}`}
              >
                <svg width="28" height="28" className="lg:w-10 lg:h-10 xl:w-12 xl:h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="4" x2="5" y2="20"/>
                </svg>
              </button>

              <figure className="flex items-center justify-center relative w-full max-w-[50vw] lg:max-w-[45vw] xl:max-w-[55vw]">
                  <Turntable 
                      isPlaying={isPlaying} 
                      progress={progress} 
                      thumbnail={nowPlaying?.thumbnail}
                      onToggle={onTogglePlay}
                  />
              </figure>

              <button 
                onClick={isAdmin && hasNextTrack ? onSkip : undefined}
                disabled={isAdmin && !hasNextTrack}
                aria-label={hasNextTrack ? 'Skip to next track' : 'No next track available'}
                title={hasNextTrack ? 'Skip to next track' : 'No next track available'}
                className={`text-black/35 transition-colors shrink-0 ${isAdmin ? (hasNextTrack ? 'hover:text-black cursor-pointer' : 'opacity-25 cursor-not-allowed') : 'opacity-0 pointer-events-none'}`}
              >
                <svg width="28" height="28" className="lg:w-10 lg:h-10 xl:w-12 xl:h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="4" x2="19" y2="20"/>
                </svg>
              </button>
            </div>

            {/* Metadata below turntable — only when left sidebar is hidden (< xl) */}
            <div className="xl:hidden w-full max-w-[500px] mt-4">
              <TrackMetadata track={nowPlaying} currentTime={currentTime} duration={duration} />
            </div>

            <div className="flex items-center gap-8 lg:gap-10 mt-6">
              {isAdmin ? (
                <span className="text-[10px] lg:text-xs font-bold text-black/45 uppercase tracking-[0.3em]">Status // {isPlaying ? 'Live' : 'Idle'}</span>
              ) : (
                <nav className="flex items-center gap-6 lg:gap-10">
                    <button className="text-black/20 hover:text-orange-500 transition-colors">
                        <Heart size={22} strokeWidth={1.5} />
                    </button>
                    <div className="h-5 lg:h-6 w-px bg-black/10" />
                    <span className="text-[10px] lg:text-xs font-bold text-black/20 uppercase tracking-[0.3em]">Status // {isPlaying ? 'Live' : 'Idle'}</span>
                    <div className="h-5 lg:h-6 w-px bg-black/10" />
                    <button className="text-black/20 hover:text-orange-500 transition-colors">
                        <Share2 size={22} strokeWidth={1.5} />
                    </button>
                </nav>
              )}
            </div>
          </div>
      </motion.section>

      {/* RIGHT SECTION: Sequence Queue — lg+ only */}
      <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="hidden lg:flex shrink-0 flex-col justify-center h-full w-[240px] lg:w-[280px] xl:w-[350px]"
      >
          <StationSequence queue={queue} roomId={roomId} onAddToQueue={onGoToSearch} />
      </motion.div>

    </div>
  );
}
