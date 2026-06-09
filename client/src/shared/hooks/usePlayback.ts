import { useState, useCallback } from 'react';
import type { Track } from '../types';

export interface PlaybackState {
  isPlaying: boolean;
  progress: number;
}

export function usePlayback(initialTrack: Track | null = null) {
  const [isPlayingOverride, setIsPlayingOverride] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);

  const isPlaying = isPlayingOverride ?? Boolean(initialTrack);

  const setIsPlaying = useCallback((value: boolean) => {
    setIsPlayingOverride(value);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlayingOverride((prev) => {
      const current = prev ?? Boolean(initialTrack);
      return !current;
    });
  }, [initialTrack]);

  const updateProgress = useCallback((newProgress: number) => {
    setProgress(newProgress);
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    togglePlay,
    updateProgress,
  };
}
