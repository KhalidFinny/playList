import { useRef, useState, useEffect, useCallback } from 'react';
import YouTube from 'react-youtube';
import { socket } from '@/shared/lib/socket';
import { usePlayback } from '@/shared/hooks/usePlayback';
import { MusicRoomView } from '../../shared/components/MusicRoomView';
import type { PlaybackControllerProps } from '../types';

interface PlayerRef {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

export function PlaybackController({
  roomId,
  nowPlaying,
  upNext,
  fullQueue,
  activePlayer,
  onPlayerReady,
  onPlayerEnd,
  togglePlayback,
}: PlaybackControllerProps) {
  const { isPlaying, setIsPlaying, progress, setProgress } = usePlayback(nowPlaying);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRefA = useRef<PlayerRef | null>(null);
  const playerRefB = useRef<PlayerRef | null>(null);
  const isPlayingRef = useRef(isPlaying);

  // Keep ref in sync for the interval closure
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Poll timing from the active player every 1s and sync to participants
  useEffect(() => {
    if (!roomId) return;

    const syncInterval = setInterval(() => {
      const ref = activePlayer === 'A' ? playerRefA.current : playerRefB.current;
      if (!ref) return;
      try {
        const ct = ref.getCurrentTime();
        const dur = ref.getDuration();
        if (dur > 0) {
          setCurrentTime(ct);
          setDuration(dur);
          setProgress(ct / dur);
          
          // Sync to participants with the REAL isPlaying state from YouTube
          const actualPlaying = ref.getPlayerState() === 1;
          socket.emit('sync_playback', { roomId, currentTime: ct, duration: dur, isPlaying: actualPlaying });
          // If the player state doesn't match our local isPlaying, sync it
          if (actualPlaying !== isPlayingRef.current) {
            setIsPlaying(actualPlaying);
            togglePlayback(actualPlaying);
          }
        }
      } catch {
        // Player not ready yet
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [roomId, activePlayer, setIsPlaying, togglePlayback, setProgress]);

  const handleTogglePlay = useCallback(() => {
    const ref = activePlayer === 'A' ? playerRefA : playerRefB;

    if (isPlaying) {
      setIsPlaying(false);
      togglePlayback(false);
      if (ref.current) {
        ref.current.pauseVideo();
        socket.emit('sync_playback', { roomId, currentTime: ref.current.getCurrentTime(), duration: ref.current.getDuration(), isPlaying: false });
      }
    } else {
      setIsPlaying(true);
      togglePlayback(true);
      if (ref.current) {
        ref.current.playVideo();
        socket.emit('sync_playback', { roomId, currentTime: ref.current.getCurrentTime(), duration: ref.current.getDuration(), isPlaying: true });
      }
    }
  }, [isPlaying, activePlayer, roomId, setIsPlaying, togglePlayback]);

  const handlePlayerPlay = useCallback((ref: React.MutableRefObject<PlayerRef | null>) => {
    setIsPlaying(true);
    togglePlayback(true);
    if (ref.current) {
      socket.emit('sync_playback', { roomId, currentTime: ref.current.getCurrentTime(), duration: ref.current.getDuration(), isPlaying: true });
    }
  }, [roomId, setIsPlaying, togglePlayback]);

  const handlePlayerPause = useCallback((ref: React.MutableRefObject<PlayerRef | null>) => {
    setIsPlaying(false);
    togglePlayback(false);
    if (ref.current) {
      socket.emit('sync_playback', { roomId, currentTime: ref.current.getCurrentTime(), duration: ref.current.getDuration(), isPlaying: false });
    }
  }, [roomId, setIsPlaying, togglePlayback]);

  return (
    <section className="w-full h-full">
      {/* THE HIDDEN ACTUAL PLAYERS — off-screen with real dimensions so YouTube initializes */}
      <div className="absolute pointer-events-none" style={{ left: '-9999px', width: '640px', height: '390px' }}>
        <div key="A" className={activePlayer === 'A' ? 'block' : 'hidden'}>
          {nowPlaying && activePlayer === 'A' ? (
            <YouTube
              videoId={nowPlaying.youtubeId}
              opts={{ playerVars: { autoplay: 1, controls: 0 } }}
              onReady={(e) => {
                playerRefA.current = e.target as unknown as PlayerRef;
                onPlayerReady('A')(e);
              }}
              onEnd={onPlayerEnd}
              onPlay={() => handlePlayerPlay(playerRefA)}
              onPause={() => handlePlayerPause(playerRefA)}
            />
          ) : null}
        </div>
        <div key="B" className={activePlayer === 'B' ? 'block' : 'hidden'}>
          {nowPlaying && activePlayer === 'B' ? (
            <YouTube
              videoId={nowPlaying.youtubeId}
              opts={{ playerVars: { autoplay: 1, controls: 0 } }}
              onReady={(e) => {
                playerRefB.current = e.target as unknown as PlayerRef;
                onPlayerReady('B')(e);
              }}
              onEnd={onPlayerEnd}
              onPlay={() => handlePlayerPlay(playerRefB)}
              onPause={() => handlePlayerPause(playerRefB)}
            />
          ) : null}
        </div>
        {upNext ? (
          <YouTube
            videoId={upNext.youtubeId}
            opts={{ playerVars: { autoplay: 0 } }}
            onReady={onPlayerReady(activePlayer === 'A' ? 'B' : 'A')}
          />
        ) : null}
      </div>

      <MusicRoomView
        roomId={roomId}
        nowPlaying={nowPlaying}
        queue={fullQueue ?? []}
        isPlaying={isPlaying}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        role="admin"
        onSkip={onPlayerEnd}
        onTogglePlay={handleTogglePlay}
      />

      {/* Removed restrictive spinner overlay to allow interaction with dashboard tabs */}
    </section>
  );
}
