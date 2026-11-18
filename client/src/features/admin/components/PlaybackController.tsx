import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useMachine } from "@xstate/react";
import YouTube from "react-youtube";
import { socket } from "@/shared/lib/socket";
import { playbackMachine } from "@/machines/playbackMachine";
import { normalizeGain, resolveLoudness } from "@/shared/lib/loudness";
import { applyGain, watchAudioSettings } from "@/shared/lib/audioGraph";
import { fetchStream } from "@/shared/lib/preview";
import { useAudioStore } from "@/stores/audioStore";
import { setMediaSession, setMediaSessionPlaybackState } from "@/shared/lib/mediaSession";
import { MusicRoomView } from "../../shared/components/MusicRoomView";
import type { PlaybackControllerProps, PlayerRef } from "../types";

export function PlaybackController({
  roomId,
  nowPlaying,
  fullQueue,
  activePlayer,
  hasPreviousTrack,
  onPlayerReady,
  onPlayerEnd,
  onPrevious,
  onGoToSearch,
  togglePlayback,
  onRemoveTrack,
  removingTrackId,
}: PlaybackControllerProps) {
  const [playback, sendPlayback] = useMachine(playbackMachine);
  const isPlaying = playback.matches("playing");
  const currentTime = playback.context.currentTime;
  const duration = playback.context.duration;
  const progress = duration > 0 ? currentTime / duration : 0;
  const playerRefA = useRef<PlayerRef | null>(null);
  const playerRefB = useRef<PlayerRef | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const lastPlaybackSyncRef = useRef({ currentTime: 0, duration: 0, isPlaying: false });
  // One advance per track, so the end watchdog and YouTube's own `onEnd` cannot
  // both transition the room.
  const endedTrackRef = useRef<string | null>(null);

  // Background playback needs a media element: the browser suspends a YouTube
  // iframe when the tab hides or the screen locks, but never an <audio>. So the
  // stream is tried first and the iframe is only the fallback for videos whose
  // stream the Worker cannot resolve.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamFailed, setStreamFailed] = useState(false);
  const [trackLoudness, setTrackLoudness] = useState<number | null>(null);
  // The gain the current track asked for, kept so the normalization toggle can
  // re-apply it without re-measuring.
  const gainRef = useRef(1);
  const normalize = useAudioStore((state) => state.normalize);
  // True while we replace or tear down the element. Its `pause` event must not
  // be mistaken for the host pausing the room, or a track change would tell the
  // server the room stopped.
  const internalPauseRef = useRef(false);
  const streamIdRef = useRef<string | null>(null);

  const audioPlayer = useMemo<PlayerRef>(
    () => ({
      playVideo: () => {
        internalPauseRef.current = false;
        void audioRef.current?.play().catch(() => {});
      },
      pauseVideo: () => {
        internalPauseRef.current = true;
        audioRef.current?.pause();
      },
      mute: () => {
        if (audioRef.current) audioRef.current.muted = true;
      },
      unMute: () => {
        if (audioRef.current) audioRef.current.muted = false;
      },
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
      getDuration: () => {
        const value = audioRef.current?.duration;
        return value && Number.isFinite(value) ? value : 0;
      },
      getPlayerState: () => {
        const audio = audioRef.current;
        if (!audio) return -1;
        if (audio.ended) return 0;
        return audio.paused ? 2 : 1;
      },
      seekTo: (seconds) => {
        const audio = audioRef.current;
        if (!audio) return;
        internalPauseRef.current = true;
        audio.currentTime = seconds;
        internalPauseRef.current = false;
      },
    }),
    [],
  );
  // Keep ref in sync for the interval closure
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (nowPlaying) sendPlayback({ type: "TRACK_LOADED" });
  }, [nowPlaying, sendPlayback]);

  useEffect(() => {
    endedTrackRef.current = null;
  }, [nowPlaying?.id]);

  useEffect(() => {
    const videoId = nowPlaying?.youtubeId;
    streamIdRef.current = videoId ?? null;
    if (!videoId) {
      setStreamUrl(null);
      setStreamFailed(false);
      setTrackLoudness(null);
      return;
    }

    let cancelled = false;
    setStreamUrl(null);
    setStreamFailed(false);
    setTrackLoudness(null);

    fetchStream(videoId)
      .then((data) => {
        if (cancelled) return;
        setStreamUrl(data.url);
        setTrackLoudness(data.loudnessLufs ?? null);
      })
      .catch((err) => {
        // YouTube challenges the Worker's address for some videos. Those still
        // play, through the iframe, just without the background behaviour.
        console.warn("[PLAYER] stream unavailable, using the iframe:", err);
        if (!cancelled) setStreamFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [nowPlaying?.youtubeId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;

    playerRefA.current = audioPlayer;
    playerRefB.current = audioPlayer;
    onPlayerReady("A", audioPlayer);
    onPlayerReady("B", audioPlayer);

    internalPauseRef.current = true;
    audio.src = streamUrl;
    audio.load();
    internalPauseRef.current = false;

    // The room was already playing, so the next track starts on its own. A
    // fresh page load waits for the host's first play, as browsers require.
    if (isPlayingRef.current) audioPlayer.playVideo();

    // Loudness correction, like Meiro's playbackVolume. YouTube's own measurement
    // arrives with the stream, so this is applied immediately; the decode fallback
    // only runs for tracks where the field was absent.
    const videoId = streamIdRef.current;
    if (videoId) {
      void resolveLoudness(videoId, streamUrl, trackLoudness).then((loudness) => {
        // The track may have changed while a slice was being analysed.
        if (streamIdRef.current !== videoId) return;
        gainRef.current = normalizeGain(loudness);
        applyGain(audio, useAudioStore.getState().normalize ? gainRef.current : 1);
      });
    }
  }, [streamUrl, trackLoudness, audioPlayer, onPlayerReady]);

  // The equalizer is per device, so it is applied to this element as the settings
  // change rather than being carried through the room.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    return watchAudioSettings(audio);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) applyGain(audio, normalize ? gainRef.current : 1);
  }, [normalize]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl || streamFailed) return;
    if (isPlaying) audioPlayer.playVideo();
    else if (playback.matches("paused")) audioPlayer.pauseVideo();
  }, [isPlaying, streamUrl, streamFailed, audioPlayer, playback]);

  const emitPlaybackSync = useCallback(
    (ref: PlayerRef, isImmediate = false, forcedPlaying?: boolean) => {
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
      socket.emit("sync_playback", { roomId, currentTime: ct, duration: dur, isPlaying: playing });
    },
    [roomId],
  );

  // Poll timing for local UI every 1s, but broadcast only on coarse drift/state changes.
  useEffect(() => {
    if (!roomId) return;

    const syncInterval = setInterval(() => {
      const ref = activePlayer === "A" ? playerRefA.current : playerRefB.current;
      if (!ref) return;
      try {
        const ct = ref.getCurrentTime();
        const dur = ref.getDuration();
        if (dur > 0) {
          sendPlayback({
            type: "SYNC_TICK",
            currentTime: ct,
            duration: dur,
            isPlaying: isPlayingRef.current,
          });
          emitPlaybackSync(ref);
        }
      } catch {
        // Player not ready yet
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [roomId, activePlayer, emitPlaybackSync, sendPlayback]);

  const handleTogglePlay = useCallback(() => {
    const ref = playerRefA;

    if (isPlaying) {
      sendPlayback({ type: "PAUSE" });
      togglePlayback(false);
      if (ref.current) {
        ref.current.pauseVideo();
        emitPlaybackSync(ref.current, true, false);
      }
    } else {
      sendPlayback({ type: "PLAY" });
      togglePlayback(true);
      if (ref.current) {
        ref.current.playVideo();
        emitPlaybackSync(ref.current, true, true);
      }
    }
  }, [isPlaying, activePlayer, sendPlayback, togglePlayback, emitPlaybackSync]);

  const handleSeek = useCallback(
    (value: number, committed: boolean) => {
      const player = playerRefA.current;
      if (!player) return;

      const duration = player.getDuration();
      if (!Number.isFinite(duration) || duration <= 0) return;

      const target = value * duration;
      // The wave follows the drag; the player follows on release, so a drag
      // does not thrash it with seeks.
      sendPlayback({ type: "SYNC_TICK", currentTime: target, duration, isPlaying });
      if (!committed) return;

      player.seekTo(target, true);
      emitPlaybackSync(player, true, isPlaying);
    },
    [emitPlaybackSync, isPlaying, sendPlayback],
  );

  const handlePlayerPlay = useCallback(
    (ref: React.MutableRefObject<PlayerRef | null>) => {
      sendPlayback({ type: "PLAY" });
      togglePlayback(true);
      if (ref.current) {
        emitPlaybackSync(ref.current, true, true);
      }
    },
    [sendPlayback, togglePlayback, emitPlaybackSync],
  );

  const handlePlayerPause = useCallback(
    (ref: React.MutableRefObject<PlayerRef | null>) => {
      sendPlayback({ type: "PAUSE" });
      togglePlayback(false);
      if (ref.current) {
        emitPlaybackSync(ref.current, true, false);
      }
    },
    [sendPlayback, togglePlayback, emitPlaybackSync],
  );

  const handleTrackEnd = useCallback(() => {
    if (playback.matches("transitioning")) return;
    if (endedTrackRef.current === nowPlaying?.id) return;
    endedTrackRef.current = nowPlaying?.id ?? null;
    sendPlayback({ type: "TRACK_ENDED" });
    onPlayerEnd()
      .then((advanced) => {
        sendPlayback(
          advanced ? { type: "NEXT_RESOLVED" } : { type: "NEXT_FAILED", error: "No next track" },
        );
      })
      .catch((error: unknown) => {
        sendPlayback({
          type: "NEXT_FAILED",
          error: error instanceof Error ? error.message : "Failed to skip track",
        });
      });
  }, [onPlayerEnd, playback, sendPlayback, nowPlaying?.id]);

  // A hidden tab throttles the iframe and can swallow `onEnd`, which leaves the
  // room silent on the last frame. Poll the player state so the queue advances
  // anyway; `endedTrackRef` keeps this from racing YouTube's own event.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPlayingRef.current || playback.matches("transitioning")) return;
      const player = (activePlayer === "A" ? playerRefA : playerRefB).current;
      if (!player) return;

      const state = player.getPlayerState();
      if (state === 0) {
        handleTrackEnd();
        return;
      }
      const duration = player.getDuration();
      if (state === 1 && duration > 0 && player.getCurrentTime() >= duration - 0.75) {
        handleTrackEnd();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activePlayer, handleTrackEnd, playback, nowPlaying?.id]);

  // The lock-screen player. This is what keeps the host's audio alive when the
  // screen turns off: the OS keeps a page with an active media session, and its
  // pause button routes back through the same handler as the disc.
  useEffect(() => {
    setMediaSession(nowPlaying ?? null, {
      onPlay: () => {
        if (!isPlayingRef.current) handleTogglePlay();
      },
      onPause: () => {
        if (isPlayingRef.current) handleTogglePlay();
      },
      onNext: handleTrackEnd,
    });
  }, [nowPlaying, handleTogglePlay, handleTrackEnd]);

  useEffect(() => {
    setMediaSessionPlaybackState(isPlaying);
  }, [isPlaying]);

  // Safari and Chrome can refuse to start the freshly mounted iframe while the
  // tab is hidden. Resume when the tab is visible again if the room is playing.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !isPlayingRef.current) return;
      const player = (activePlayer === "A" ? playerRefA : playerRefB).current;
      if (player && player.getPlayerState() !== 1) player.playVideo();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [activePlayer]);

  return (
    <section className="w-full h-full">
      {/* The stream player. A media element is the only kind the browser keeps
          running when the tab is hidden or the screen locks, which is what the
          host needs. Both refs point at it, because the dashboard still tracks
          an A/B "active player". */}
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
        onEnded={handleTrackEnd}
        onPlay={() => {
          internalPauseRef.current = false;
          if (streamIdRef.current) handlePlayerPlay({ current: audioPlayer });
        }}
        onPause={() => {
          // Only a real pause is reported; a source swap pauses the element too.
          if (internalPauseRef.current) return;
          if (streamIdRef.current) handlePlayerPause({ current: audioPlayer });
        }}
        onError={() => {
          // The URL resolved but the media server refused it. The iframe still
          // plays this video, so switch to it rather than leave the room silent.
          if (!streamIdRef.current) return;
          internalPauseRef.current = true;
          console.warn("[PLAYER] stream refused by the media server, using the iframe");
          setStreamFailed(true);
        }}
      />

      {/* Fallback for videos whose stream the Worker cannot resolve. It always
          plays, but the browser may suspend it in a hidden tab. */}
      {streamFailed && nowPlaying ? (
        <div
          className="absolute pointer-events-none"
          style={{ left: "-9999px", width: "640px", height: "390px" }}
        >
          <YouTube
            videoId={nowPlaying.youtubeId}
            opts={{ playerVars: { autoplay: 1, controls: 0, origin: window.location.origin } }}
            onReady={(e) => {
              const player = e.target as unknown as PlayerRef;
              playerRefA.current = player;
              playerRefB.current = player;
              onPlayerReady("A", player);
              onPlayerReady("B", player);
              if (isPlayingRef.current) player.playVideo();
            }}
            onEnd={handleTrackEnd}
            onPlay={() => handlePlayerPlay(playerRefA)}
            onPause={() => handlePlayerPause(playerRefA)}
          />
        </div>
      ) : null}

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
        hasPreviousTrack={hasPreviousTrack}
        onPrevious={() => {
          if (!hasPreviousTrack || playback.matches("previousLoading")) return;
          sendPlayback({ type: "PREVIOUS_REQUESTED" });
          onPrevious()
            .then((moved) => {
              sendPlayback(
                moved
                  ? { type: "PREVIOUS_RESOLVED" }
                  : { type: "PREVIOUS_FAILED", error: "No previous track" },
              );
            })
            .catch((error: unknown) => {
              sendPlayback({
                type: "PREVIOUS_FAILED",
                error: error instanceof Error ? error.message : "Failed to load previous track",
              });
            });
        }}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onGoToSearch={onGoToSearch}
        onRemoveTrack={onRemoveTrack}
        removingTrackId={removingTrackId}
      />

      {/* Removed restrictive spinner overlay to allow interaction with dashboard tabs */}
    </section>
  );
}
