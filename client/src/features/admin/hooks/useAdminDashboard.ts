import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "../../../shared/lib/socket";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import type {
  BasicResponse,
  EoTrackEndedResponse,
  PendingSong,
  PlayerRef,
  QueueSong,
  RoomKeyInfo,
  RoomMode,
  SearchResult,
  SearchSongsResponse,
  SearchSuggestionsResponse,
  SongUpdatedPayload,
  Track,
} from "../types";
import { useAdminQueueStore } from "../../../stores/adminQueueStore";
import {
  begin,
  idleGuard,
  isRequesting,
  reset,
  settle,
  type AdvanceGuard,
} from "../lib/advanceGuard";
import { rankSuggestions } from "../../../shared/lib/suggestions";

export function useAdminDashboard(roomId: string) {
  // --- STATE: GLOBAL ---
  const [connected, setConnected] = useState(false);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [mode, setMode] = useState<RoomMode | null>(null);
  const [previewActive, setPreviewActive] = useState(false);

  // --- STATE: PLAYER (EO) ---
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  // The track the room is on, readable from callbacks without re-creating them.
  const nowPlayingIdRef = useRef<string | null>(null);
  const [upNext, setUpNext] = useState<Track | null>(null);
  const [hasPreviousTrack, setHasPreviousTrack] = useState(false);
  const [activePlayer, setActivePlayer] = useState<"A" | "B">("A");
  const playerARef = useRef<PlayerRef | null>(null);
  const playerBRef = useRef<PlayerRef | null>(null);
  const nowPlayingRef = useRef<Track | null>(null);
  // How long the room has to answer a playback request. Without a bound, a reply
  // lost to a dropped socket left the in-flight guard set for good.
  const ACK_TIMEOUT_MS = 10_000;

  // Explicit advance machine; see `../lib/advanceGuard` and `specs/AdvanceGuard.tla`.
  const guardRef = useRef<AdvanceGuard>(idleGuard);

  // --- STATE: MODERATION (Admin) ---
  const pendingQueue = useAdminQueueStore((state) => state.pendingQueue);
  const fullQueue = useAdminQueueStore((state) => state.fullQueue);
  const processingId = useAdminQueueStore((state) => state.processingId);
  const editingId = useAdminQueueStore((state) => state.editingId);
  const editValue = useAdminQueueStore((state) => state.editValue);
  const applyInitialQueues = useAdminQueueStore((state) => state.applyInitialQueues);
  const applyNewPendingSong = useAdminQueueStore((state) => state.applyNewPendingSong);
  const applySongApproved = useAdminQueueStore((state) => state.applySongApproved);
  const applySongDeleted = useAdminQueueStore((state) => state.applySongDeleted);
  const applySongUpdated = useAdminQueueStore((state) => state.applySongUpdated);
  const clearEntireQueue = useAdminQueueStore((state) => state.clearEntireQueue);
  const setProcessingId = useAdminQueueStore((state) => state.setProcessingId);
  const startAdminEditing = useAdminQueueStore((state) => state.startEditing);
  const stopAdminEditing = useAdminQueueStore((state) => state.stopEditing);
  const setEditValue = useAdminQueueStore((state) => state.setEditValue);

  // --- STATE: SEARCH (Add Music) ---
  const [searchQuery, setSearchQueryValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 150);

  const latestSearchQueryRef = useRef("");
  const suggestionRequestIdRef = useRef(0);
  const searchResultsRequestIdRef = useRef(0);

  useEffect(() => {
    latestSearchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const setSearchQuery = useCallback((nextQuery: string) => {
    setSearchQueryValue(nextQuery);

    const trimmed = nextQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
    }

    if (trimmed.length === 0) {
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, []);

  // --- LOGIC: PLAYER (EO) ---
  const activePlayerRef = useRef<"A" | "B">("A");

  useEffect(() => {
    activePlayerRef.current = activePlayer;
  }, [activePlayer]);

  const applyNowPlaying = useCallback(
    (track: Track | null) => {
      setNowPlaying(track);
      nowPlayingIdRef.current = track?.id ?? null;
      if (track) applySongDeleted(track.id);
    },
    [applySongDeleted],
  );

  const fetchNext = useCallback(() => {
    if (!roomId) return;
    const begun = begin(guardRef.current, "next");
    if (!begun) return;
    guardRef.current = begun;

    socket.timeout(ACK_TIMEOUT_MS).emit(
      "eo_track_ended",
      // The track this client believes is ending. The room ignores the request
      // if it has already moved on, so a second dashboard tab — or a retry —
      // cannot advance twice and skip a song.
      { roomId, trackId: nowPlayingIdRef.current, idempotencyKey: crypto.randomUUID() },
      (err: Error | null, res: EoTrackEndedResponse) => {
        if (err || !res) {
          guardRef.current = settle(guardRef.current, "next");
          return;
        }
        // The room had already moved on, so there is nothing to apply.
        if (res.stale) {
          guardRef.current = settle(guardRef.current, "next");
          return;
        }
        if (res.success) {
          applyNowPlaying(res.nextTrack);
          setUpNext(res.upNext);
          if (res.oldTrackId) setHasPreviousTrack(true);
        }
        guardRef.current = settle(guardRef.current, "next");
      },
    );
  }, [applyNowPlaying, roomId]);

  const onPlayerReady = useCallback((id: "A" | "B", player: PlayerRef) => {
    if (id === "A") playerARef.current = player;
    else playerBRef.current = player;
  }, []);

  const onPlayerEnd = useCallback(() => {
    if (!roomId) return Promise.resolve(false);
    const begun = begin(guardRef.current, "next");
    if (!begun) return Promise.resolve(false);
    guardRef.current = begun;

    return new Promise<boolean>((resolve) => {
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit(
          "eo_track_ended",
          { roomId, trackId: nowPlayingIdRef.current, idempotencyKey: crypto.randomUUID() },
          (err: Error | null, res: EoTrackEndedResponse) => {
            // The room did not answer in time. Treat it as a failed advance rather
            // than leaving the guard set, which used to block every later track
            // end until the page was reloaded.
            if (err || !res) {
              guardRef.current = settle(guardRef.current, "next");
              resolve(false);
              return;
            }
            let advanced = false;
            if (res.stale) {
              guardRef.current = settle(guardRef.current, "next");
              resolve(false);
              return;
            }
            if (res.success) {
              applyNowPlaying(res.nextTrack);
              setUpNext(res.upNext);
              if (res.oldTrackId) setHasPreviousTrack(true);

              if (res.nextTrack) {
                const nextPlayer = activePlayerRef.current === "A" ? "B" : "A";
                setActivePlayer(nextPlayer);
                socket.emit("sync_playback", {
                  roomId,
                  currentTime: 0,
                  duration: 0,
                  isPlaying: true,
                });
                advanced = true;
              } else {
                socket.emit("sync_playback", {
                  roomId,
                  currentTime: 0,
                  duration: 0,
                  isPlaying: false,
                });
              }
            }
            guardRef.current = settle(guardRef.current, "next");
            resolve(advanced);
          },
        );
    });
  }, [applyNowPlaying, roomId]);

  const onPrevious = useCallback(() => {
    if (!roomId) return Promise.resolve(false);
    const begun = begin(guardRef.current, "previous");
    if (!begun) return Promise.resolve(false);
    guardRef.current = begun;

    return new Promise<boolean>((resolve) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(
        "previous_track",
        { roomId },
        (
          err: Error | null,
          res: {
            success: boolean;
            previousTrack?: Track;
            hasPrevious?: boolean;
            error?: string;
          },
        ) => {
          if (err || !res) {
            guardRef.current = settle(guardRef.current, "previous");
            resolve(false);
            return;
          }
          const moved = Boolean(res.success && res.previousTrack);
          if (res.success && res.previousTrack) {
            applyNowPlaying(res.previousTrack);
            setHasPreviousTrack(Boolean(res.hasPrevious));
            // Server broadcasts now_playing_updated, so other clients pick it up
          } else {
            setHasPreviousTrack(false);
          }
          guardRef.current = settle(guardRef.current, "previous");
          resolve(moved);
        },
      );
    });
  }, [applyNowPlaying, roomId]);

  // --- SOCKET LIFECYCLE ---
  const joinRoomRef = useRef<string | null>(null);

  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  }, [nowPlaying]);

  useEffect(() => {
    if (!roomId) return;

    console.log(`[DASHBOARD] Connecting to room: ${roomId}`);
    socket.connect();

    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      console.warn("Unauthorized. Missing admin token.");
      return;
    }

    const doJoinRoom = () => {
      socket.emit("join_room", { roomId, role: "admin", adminToken }, (res: BasicResponse) => {
        if (res && !res.success) {
          console.warn(res.error || "Failed to join room");
        }
        if (res?.success && res.mode) setMode(res.mode);
      });
    };

    joinRoomRef.current = roomId;

    const handleConnect = () => {
      console.log("[DASHBOARD] Socket connected");
      setConnected(true);
      // A request that was in flight when the socket dropped will never be
      // acknowledged, so its guard has to be released here.
      guardRef.current = reset(guardRef.current);
      // Re-join the room on reconnect (socket.io reconnects automatically but doesn't re-emit our events)
      const token = localStorage.getItem("adminToken");
      if (token && joinRoomRef.current) {
        console.log("[DASHBOARD] Reconnecting - rejoining room");
        socket.emit(
          "join_room",
          { roomId: joinRoomRef.current, role: "admin", adminToken: token },
          (res: BasicResponse) => {
            if (res && !res.success) {
              console.warn(res.error || "Failed to rejoin room");
            }
            if (res?.success && res.mode) setMode(res.mode);
          },
        );
      }
    };

    // Socket might already be connected (e.g. from useAdminAuth on hub page)
    // socket.io won't re-fire 'connect' if already connected when we register the listener
    if (socket.connected) {
      setConnected(true);
      doJoinRoom();
    }

    const handleEoRegistered = () => {
      console.log("[DASHBOARD] EO Registered successfully");
    };

    const handleRoomKeyInfo = ({ passkey }: RoomKeyInfo) => {
      console.log(`[DASHBOARD] Room Key: ${passkey}`);
      setRoomKey(passkey);
    };

    const handleNowPlayingUpdated = (track: Track) => {
      applyNowPlaying(track);
    };

    const handleQueueUpdated = (queue: QueueSong[]) => {
      const pending = queue.filter((q) => q.status === "pending");
      const approved = queue.filter((q) => q.status === "approved") as Track[];

      applyInitialQueues(pending, approved);

      // Only request next track if there is at least one approved song.
      if (
        !nowPlayingRef.current &&
        approved.length > 0 &&
        !isRequesting(guardRef.current, "next")
      ) {
        fetchNext();
      }
    };

    const handleNewPendingSong = (song: PendingSong) => {
      console.log("[DASHBOARD] New pending song received:", song);
      applyNewPendingSong(song);
    };

    const handleSongDeleted = ({ songId }: { songId: string }) => {
      applySongDeleted(songId);
    };

    const handleSongApproved = (song: PendingSong & Partial<Track>) => {
      applySongApproved(song as Track);
    };

    const handleSongUpdated = (updated: SongUpdatedPayload) => {
      applySongUpdated(updated);
    };

    const handleDisconnect = () => {
      setConnected(false);
      guardRef.current = reset(guardRef.current);
    };

    socket.on("connect", handleConnect);
    socket.on("eo_registered", handleEoRegistered);
    socket.on("room_key_info", handleRoomKeyInfo);
    socket.on("now_playing_updated", handleNowPlayingUpdated);
    socket.on("queue_updated", handleQueueUpdated);
    socket.on("new_pending_song", handleNewPendingSong);
    socket.on("song_deleted", handleSongDeleted);
    socket.on("song_removed_from_queue", handleSongDeleted);
    socket.on("song_approved", handleSongApproved);
    const handleQueueCleared = () => {
      clearEntireQueue();
    };

    socket.on("song_updated", handleSongUpdated);
    socket.on("queue_cleared", handleQueueCleared);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("eo_registered", handleEoRegistered);
      socket.off("room_key_info", handleRoomKeyInfo);
      socket.off("now_playing_updated", handleNowPlayingUpdated);
      socket.off("queue_updated", handleQueueUpdated);
      socket.off("new_pending_song", handleNewPendingSong);
      socket.off("song_deleted", handleSongDeleted);
      socket.off("song_removed_from_queue", handleSongDeleted);
      socket.off("song_approved", handleSongApproved);
      socket.off("song_updated", handleSongUpdated);
      socket.off("queue_cleared", handleQueueCleared);
      socket.off("disconnect", handleDisconnect);
    };
  }, [
    applyInitialQueues,
    applyNewPendingSong,
    applyNowPlaying,
    applySongApproved,
    applySongDeleted,
    applySongUpdated,
    fetchNext,
    roomId,
  ]);

  useEffect(() => {
    if (
      connected &&
      !nowPlaying &&
      fullQueue.length > 0 &&
      !isRequesting(guardRef.current, "next")
    ) {
      fetchNext();
    }
  }, [connected, fetchNext, fullQueue.length, nowPlaying]);

  // --- LOGIC: MODERATION ---
  // Both of these roll back the one song they touched, never a snapshot.
  //
  // They used to capture the whole queue before the click and restore it if the
  // server refused. Approving two songs quickly made the second refusal revert
  // the first approval too, so a song that had been accepted vanished from the
  // dashboard — and the restored order was the stale one, which is why the queue
  // also looked rearranged.
  const handleApprove = (songId: string) => {
    const song = pendingQueue.find((item) => item.id === songId);
    applySongDeleted(songId);
    setProcessingId(songId);
    socket.emit("approve_song", { roomId, songId }, (res: BasicResponse) => {
      setProcessingId(null);
      if (!res.success && song) applyNewPendingSong(song);
    });
  };

  const handleDelete = (songId: string) => {
    const song = pendingQueue.find((item) => item.id === songId);
    applySongDeleted(songId);
    setProcessingId(songId);
    socket.emit("delete_song", { roomId, songId }, (res: BasicResponse) => {
      setProcessingId(null);
      if (!res.success && song) applyNewPendingSong(song);
    });
  };

  const startEditing = (song: PendingSong) => {
    startAdminEditing(song);
  };

  const handleSaveEdit = (songId: string) => {
    socket.emit("edit_song", { roomId, songId, newTitle: editValue }, (res: BasicResponse) => {
      if (res.success) stopAdminEditing();
    });
  };

  // --- LOGIC: SEARCH ---
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed.length < 2) {
      return;
    }

    const requestId = ++suggestionRequestIdRef.current;
    const requestedQuery = trimmed.toLowerCase();

    // As user types, get fast suggestions
    socket.emit("get_search_suggestions", { query: trimmed }, (res: SearchSuggestionsResponse) => {
      const latestQuery = latestSearchQueryRef.current.trim().toLowerCase();
      const isLatestRequest = requestId === suggestionRequestIdRef.current;
      const isForCurrentQuery = requestedQuery === latestQuery;

      if (res.success && isLatestRequest && isForCurrentQuery) {
        const ranked = rankSuggestions(trimmed, res.suggestions ?? []);
        setSuggestions(ranked.slice(0, 8));
      }
    });
  }, [debouncedSearch]);

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setSuggestions([]);
    setSearchLoading(true);

    const requestId = ++searchResultsRequestIdRef.current;
    const requestedQuery = suggestion.trim().toLowerCase();

    // When a suggestion is picked, fetch the HIGH FIDELITY video result
    socket.emit("search_songs", { query: suggestion }, (res: SearchSongsResponse) => {
      const latestQuery = latestSearchQueryRef.current.trim().toLowerCase();
      const isLatestRequest = requestId === searchResultsRequestIdRef.current;
      const isForCurrentQuery = requestedQuery === latestQuery;

      if (isLatestRequest && isForCurrentQuery && res.success) {
        setSearchResults(res.results ?? []);
      }

      if (isLatestRequest) {
        setSearchLoading(false);
      }
    });
  };

  const handleClearQueue = useCallback(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken || !roomId) return;
    socket.emit(
      "clear_queue",
      { roomId, adminToken },
      (res: { success: boolean; clearedCount?: number; error?: string }) => {
        if (res.success) {
          console.log(`[ADMIN] Queue cleared: ${res.clearedCount} songs removed`);
        } else {
          console.warn("[ADMIN] Failed to clear queue:", res.error);
        }
      },
    );
  }, [roomId]);

  const handleAddSong = (song: SearchResult) => {
    setSubmittingId(song.youtubeId);
    const adminToken = localStorage.getItem("adminToken");
    socket.emit(
      "admin_add_song",
      {
        roomId,
        youtubeId: song.youtubeId,
        title: song.title,
        author: song.author,
        adminToken,
      },
      (res: { success: boolean; error?: string }) => {
        setSubmittingId(null);
        if (!res.success) {
          console.warn("[ADMIN] Failed to add song:", res.error);
        }
      },
    );
  };

  const togglePlayback = useCallback(
    (playing: boolean) => {
      socket.emit("toggle_playback", { roomId, isPlaying: playing });
    },
    [roomId],
  );

  const visibleSuggestions = debouncedSearch.trim().length < 2 ? [] : suggestions;

  return {
    connected,
    roomKey,
    mode,
    nowPlaying,
    upNext,
    activePlayer,
    hasPreviousTrack,
    previewActive,
    setPreviewActive,
    pendingQueue,
    fullQueue,
    processingId,
    editingId,
    editValue,
    setEditValue,
    searchQuery,
    setSearchQuery,
    suggestions: visibleSuggestions,
    onSelectSuggestion: handleSelectSuggestion,
    searchResults,
    searchLoading,
    submittingId,
    onPlayerReady,
    onPlayerEnd,
    onPrevious,
    togglePlayback,
    handleApprove,
    handleDelete,
    startEditing,
    handleSaveEdit,
    handleAddSong,
    handleClearQueue,
    setEditingId: (id: string | null) =>
      id ? startAdminEditing({ id, title: editValue }) : stopAdminEditing(),
  };
}
