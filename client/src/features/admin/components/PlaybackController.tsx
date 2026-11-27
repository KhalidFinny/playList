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
  // Which track the audio element is actually loaded with. The element keeps the
  // previous track's end state until the next stream URL arrives, so without this
  // the end-of-track poll can read "ended" for a track that is already gone and
  // advance a second time — skipping a song and draining the queue.
  const loadedTrackIdRef = useRef<string | null>(null);
  // Consecutive failed resolves for the current track, so an unplayable one is
  // skipped instead of stopping the room for good.
  const resolveFailuresRef = useRef(0);
  const lastResolveAtRef = useRef(0);
  const recoveryRef = useRef(false);
  // When the track was first seen sitting at its end with no advance landing.
  const stuckSinceRef = useRef(0);
  // Longer than the room's ack timeout, so a retry never races an advance that is
  // merely slow.
  const RETRY_ADVANCE_MS = 15_000;
  // Last observed playback position, for the stall watchdog.
  const lastProgressRef = useRef({ at: 0, seenAt: Date.now() });

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

  // Keyed on the track, not the video: the same video twice in a row still has to
  // reload the element, or it stays on the first copy's end state.
  useEffect(() => {
    const videoId = nowPlaying?.youtubeId;
    streamIdRef.current = videoId ?? null;
    loadedTrackIdRef.current = null;
    resolveFailuresRef.current = 0;
    lastResolveAtRef.current = 0;
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
  }, [nowPlaying?.id]);

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
    loadedTrackIdRef.current = nowPlaying?.id ?? null;

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
  }, [streamUrl, trackLoudness, audioPlayer, onPlayerReady, nowPlaying?.id]);

  /**
   * Re-resolve the current track and resume where it was.
   *
   * Signed stream URLs expire and the media server starts refusing them, and a
   * long session outlives them. Without this the element dies mid-track and the
   * room goes quiet until someone reloads, which is the failure a host sees as
   * "it stopped after a while".
   */
  const recoverStream = useCallback(async () => {
    const audio = audioRef.current;
    const videoId = streamIdRef.current;
    if (!audio || !videoId || recoveryRef.current) return;

    recoveryRef.current = true;
    const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

    try {
      // `fresh` skips the resolver cache: a cached URL is what just failed.
      const { url } = await fetchStream(videoId, true);
      if (streamIdRef.current !== videoId) return;

      internalPauseRef.current = true;
      audio.src = url;
      audio.load();

      await new Promise<void>((resolve) => {
        const settle = () => {
          audio.removeEventListener("loadedmetadata", settle);
          resolve();
        };
        audio.addEventListener("loadedmetadata", settle);
        setTimeout(settle, 4000);
      });

      internalPauseRef.current = false;
      const end = Number.isFinite(audio.duration) ? audio.duration : 0;
      audio.currentTime = end > 1 ? Math.min(resumeAt, end - 1) : resumeAt;

      if (isPlayingRef.current) void audio.play().catch(() => {});
      setStreamUrl(url);
      setStreamFailed(false);
    } catch (err) {
      // Out of options for the element; the iframe still plays this video.
      console.warn("[PLAYER] recovery failed, using the iframe:", err);
      setStreamFailed(true);
    } finally {
      recoveryRef.current = false;
    }
  }, []);

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

  /** Advances the queue, without the guards that stop a double advance. */
  const advanceTrack = useCallback(() => {
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
  }, [onPlayerEnd, sendPlayback, nowPlaying?.id]);

  const handleTrackEnd = useCallback(() => {
    if (playback.matches("transitioning")) return;
    if (endedTrackRef.current === nowPlaying?.id) return;
    advanceTrack();
  }, [advanceTrack, playback, nowPlaying?.id]);

  // A hidden tab throttles the iframe and can swallow `onEnd`, which leaves the
  // room silent on the last frame. Poll the player state so the queue advances
  // anyway; `endedTrackRef` keeps this from racing YouTube's own event.
  //
  // The poll also retries an advance that was lost. `transitioning` has no
  // timeout in the machine, and `endedTrackRef` blocks a second attempt for the
  // same track, so a dropped ack wedged the room on the last frame until the page
  // was reloaded — the "it stops at the end" the host sees. An advance that has
  // not landed well past the ack timeout is retried, which is safe because the
  // track is verifiably at its end.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPlayingRef.current) return;
      // The element is still holding the previous track: nothing to decide yet.
      if (loadedTrackIdRef.current !== nowPlaying?.id) return;
      const player = (activePlayer === "A" ? playerRefA : playerRefB).current;
      if (!player) return;

      const state = player.getPlayerState();
      const duration = player.getDuration();
      const atEnd =
        state === 0 || (state === 1 && duration > 0 && player.getCurrentTime() >= duration - 0.75);

      if (!atEnd) {
        stuckSinceRef.current = 0;
        return;
      }

      const stuck = playback.matches("transitioning") || playback.matches("error");
      if (!stuck) {
        stuckSinceRef.current = 0;
        handleTrackEnd();
        return;
      }

      // Already advancing: give it longer than any ack can take before retrying.
      if (!stuckSinceRef.current) stuckSinceRef.current = Date.now();
      if (Date.now() - stuckSinceRef.current < RETRY_ADVANCE_MS) return;
      stuckSinceRef.current = 0;
      advanceTrack();
    }, 3000);
    return () => clearInterval(timer);
  }, [activePlayer, advanceTrack, handleTrackEnd, playback, nowPlaying?.id]);

  /**
   * The watchdog. A stream that has been refused, or a page that slept, leaves
   * the element "playing" while its clock stands still; that is the one signal
   * that distinguishes a dead stream from a quiet passage.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || recoveryRef.current) return;

      // Nothing resolved for this track: the iframe fallback cannot be relied on
      // to start without a gesture, so the room went silent until a reload. Keep
      // asking for a stream instead — a refusal is usually momentary.
      if (!streamUrl) {
        const videoId = streamIdRef.current;
        if (!videoId || !isPlayingRef.current) return;

        // Back off between attempts, and do not ask for a fresh resolve every
        // time. Hammering the resolver is what makes it refuse: it is rate
        // limited per client, and a refusal loop turns one slow track into a
        // room that skips through its queue.
        const failures = resolveFailuresRef.current;
        const wait = Math.min(3000 * 2 ** failures, 30_000);
        if (Date.now() - lastResolveAtRef.current < wait) return;
        lastResolveAtRef.current = Date.now();
        // Only skip the cache once a plain attempt has already failed.
        void fetchStream(videoId, failures >= 2)
          .then((data) => {
            if (streamIdRef.current !== videoId) return;
            console.warn("[PLAYER] stream resolved on retry");
            resolveFailuresRef.current = 0;
            setStreamUrl(data.url);
            setTrackLoudness(data.loudnessLufs ?? null);
            setStreamFailed(false);
          })
          .catch(() => {
            // A track YouTube will not serve is skipped rather than held forever;
            // the rest of the queue should keep playing. With the backoff above
            // this is around two and a half minutes of trying, which is long
            // enough that a passing refusal never costs a song.
            resolveFailuresRef.current += 1;
            if (resolveFailuresRef.current >= 8 && streamIdRef.current === videoId) {
              resolveFailuresRef.current = 0;
              console.warn("[PLAYER] giving up on this track, advancing");
              advanceTrack();
            }
          });
        return;
      }

      if (!isPlayingRef.current) {
        lastProgressRef.current = { at: audio.currentTime, seenAt: Date.now() };
        return;
      }

      const moved = Math.abs(audio.currentTime - lastProgressRef.current.at) > 0.25;
      if (moved) {
        lastProgressRef.current = { at: audio.currentTime, seenAt: Date.now() };
        return;
      }

      // Paused with the room playing, or the clock has not moved for 8s.
      if (audio.paused || Date.now() - lastProgressRef.current.seenAt > 8000) {
        // A paused element with a usable source is a resume, not a dead stream.
        // Re-resolving would only restart it from the synced position, and a
        // refused play leaves the room silent until someone reloads.
        if (audio.paused && audio.readyState >= 2 && !audio.ended) {
          void audio.play().catch(() => void recoverStream());
          lastProgressRef.current = { at: audio.currentTime, seenAt: Date.now() };
          return;
        }
        void recoverStream();
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [streamUrl, recoverStream, advanceTrack]);

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
          // That pause arrives on a later task, after `internalPauseRef` has been
          // cleared, so the flag cannot tell it apart from the host pausing. A
          // swap leaves nothing loaded, while a real pause can only happen on a
          // track that is. Without this the room was told it was paused at the
          // moment a track changed, and the next one never started.
          if (!audioRef.current || audioRef.current.readyState === 0) return;
          if (streamIdRef.current) handlePlayerPause({ current: audioPlayer });
        }}
        onError={() => {
          // The URL resolved but the media server refused it, which usually means
          // the signature expired. Re-resolve once before giving up on the
          // element; the iframe is the last resort, not the first answer.
          if (!streamIdRef.current) return;
          void recoverStream();
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
