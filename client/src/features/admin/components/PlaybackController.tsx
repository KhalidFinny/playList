import { useRef, useEffect, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import YouTube from 'react-youtube';
import { socket } from '@/shared/lib/socket';
import { playbackMachine } from '@/machines/playbackMachine';
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
  onPrevious,
  onGoToSearch,
  togglePlayback,
}: PlaybackControllerProps) {
  const [playback, sendPlayback] = useMachine(playbackMachine);
  const isPlaying = playback.matches('playing');
  const currentTime = playback.context.currentTime;
  const duration = playback.context.duration;
  const progress = duration > 0 ? currentTime / duration : 0;
  const playerRefA = useRef<PlayerRef | null>(null);
  const playerRefB = useRef<PlayerRef | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const lastPlaybackSyncRef = useRef({ currentTime: 0, duration: 0, isPlaying: false });

  // Keep ref in sync for the interval closure
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (nowPlaying) sendPlayback({ type: 'TRACK_LOADED' });
  }, [nowPlaying, sendPlayback]);

  const emitPlaybackSync = useCallback((ref: PlayerRef, isImmediate = false, forcedPlaying?: boolean) => {
    const ct = ref.getCurrentTime();
    const dur = ref.getDuration();
    if (dur <= 0) return;

    const playing = forcedPlaying ?? isPlayingRef.current;
    const last = lastPlaybackSyncRef.current;
    const shouldSync =
      isImmediate ||
      last.isPlaying !== playing ||
      Math.abs(last.currentTime - ct) >= 3 ||
      Math.abs(last.duration - dur) >= 1;

    if (!shouldSync) return;

    lastPlaybackSyncRef.current = { currentTime: ct, duration: dur, isPlaying: playing };
    socket.emit('sync_playback', { roomId, currentTime: ct, duration: dur, isPlaying: playing });
  }, [roomId]);

  // Poll timing for local UI every 1s, but broadcast only on coarse drift/state changes.
  useEffect(() => {
    if (!roomId) return;

    const syncInterval = setInterval(() => {
      const ref = activePlayer === 'A' ? playerRefA.current : playerRefB.current;
      if (!ref) return;
      try {
        const ct = ref.getCurrentTime();
        const dur = ref.getDuration();
        if (dur > 0) {
          sendPlayback({ type: 'SYNC_TICK', currentTime: ct, duration: dur, isPlaying: isPlayingRef.current });
          emitPlaybackSync(ref);
        }
      } catch {
        // Player not ready yet
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [roomId, activePlayer, emitPlaybackSync, sendPlayback]);

  const handleTogglePlay = useCallback(() => {
    const ref = activePlayer === 'A' ? playerRefA : playerRefB;

    if (isPlaying) {
      sendPlayback({ type: 'PAUSE' });
      togglePlayback(false);
      if (ref.current) {
        ref.current.pauseVideo();
        emitPlaybackSync(ref.current, true, false);
      }
    } else {
      sendPlayback({ type: 'PLAY' });
      togglePlayback(true);
      if (ref.current) {
        ref.current.playVideo();
        emitPlaybackSync(ref.current, true, true);
      }
    }
  }, [isPlaying, activePlayer, sendPlayback, togglePlayback, emitPlaybackSync]);

  const handlePlayerPlay = useCallback((ref: React.MutableRefObject<PlayerRef | null>) => {
    sendPlayback({ type: 'PLAY' });
    togglePlayback(true);
    if (ref.current) {
      emitPlaybackSync(ref.current, true, true);
    }
  }, [sendPlayback, togglePlayback, emitPlaybackSync]);

  const handlePlayerPause = useCallback((ref: React.MutableRefObject<PlayerRef | null>) => {
    sendPlayback({ type: 'PAUSE' });
    togglePlayback(false);
    if (ref.current) {
      emitPlaybackSync(ref.current, true, false);
    }
  }, [sendPlayback, togglePlayback, emitPlaybackSync]);

  const handleTrackEnd = useCallback(() => {
    if (playback.matches('transitioning')) return;
    sendPlayback({ type: 'TRACK_ENDED' });
    onPlayerEnd();
    sendPlayback({ type: 'NEXT_RESOLVED' });
  }, [onPlayerEnd, playback, sendPlayback]);

  return (
    <section className="w-full h-full">
      {/* THE HIDDEN ACTUAL PLAYERS — off-screen with real dimensions so YouTube initializes */}
      <div className="absolute pointer-events-none" style={{ left: '-9999px', width: '640px', height: '390px' }}>
        <div key="A" className={activePlayer === 'A' ? 'block' : 'hidden'}>
          {nowPlaying && activePlayer === 'A' ? (
            <YouTube
              videoId={nowPlaying.youtubeId}
              opts={{ playerVars: { autoplay: 1, controls: 0, origin: window.location.origin } }}
              onReady={(e) => {
                playerRefA.current = e.target as unknown as PlayerRef;
                onPlayerReady('A')(e);
              }}
              onEnd={handleTrackEnd}
              onPlay={() => handlePlayerPlay(playerRefA)}
              onPause={() => handlePlayerPause(playerRefA)}
            />
          ) : null}
        </div>
        <div key="B" className={activePlayer === 'B' ? 'block' : 'hidden'}>
          {nowPlaying && activePlayer === 'B' ? (
            <YouTube
              videoId={nowPlaying.youtubeId}
              opts={{ playerVars: { autoplay: 1, controls: 0, origin: window.location.origin } }}
              onReady={(e) => {
                playerRefB.current = e.target as unknown as PlayerRef;
                onPlayerReady('B')(e);
              }}
              onEnd={handleTrackEnd}
              onPlay={() => handlePlayerPlay(playerRefB)}
              onPause={() => handlePlayerPause(playerRefB)}
            />
          ) : null}
        </div>
        {upNext ? (
          <YouTube
            videoId={upNext.youtubeId}
            opts={{ playerVars: { autoplay: 0, origin: window.location.origin } }}
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
        onSkip={handleTrackEnd}
        onPrevious={onPrevious}
        onTogglePlay={handleTogglePlay}
        onGoToSearch={onGoToSearch}
      />

      {/* Removed restrictive spinner overlay to allow interaction with dashboard tabs */}
    </section>
  );
}
