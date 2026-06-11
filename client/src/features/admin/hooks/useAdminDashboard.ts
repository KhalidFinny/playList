import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../../../shared/lib/socket';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { YouTubeProps } from 'react-youtube';
import type { Track, PendingSong, SearchResult } from '../types';

type BasicResponse = {
  success: boolean;
  error?: string;
};

type RoomKeyInfo = { passkey: string };

type QueueSong = PendingSong & Partial<Track>;

type EoTrackEndedResponse = {
  success: boolean;
  nextTrack: Track | null;
  upNext: Track | null;
};

type SongUpdatedPayload = { id: string; title: string };

type SearchSuggestionsResponse = {
  success: boolean;
  suggestions?: string[];
};

type SearchSongsResponse = {
  success: boolean;
  results?: SearchResult[];
};

interface PlayerRef {
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

const normalize = (value: string) => value.toLowerCase().trim();

const rankSuggestions = (query: string, rawSuggestions: string[]) => {
  const q = normalize(query);
  const unique = Array.from(new Set(rawSuggestions.map((item) => item.trim()).filter(Boolean)));

  return unique
    .map((text) => {
      const n = normalize(text);
      return {
        text,
        starts: n.startsWith(q),
        idx: n.indexOf(q),
        len: n.length,
      };
    })
    .sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.len - b.len;
    })
    .map((item) => item.text);
};

export function useAdminDashboard(roomId: string) {
  // --- STATE: GLOBAL ---
  const [connected, setConnected] = useState(false);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState(false);

  // --- STATE: PLAYER (EO) ---
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [upNext, setUpNext] = useState<Track | null>(null);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const playerARef = useRef<PlayerRef | null>(null);
  const playerBRef = useRef<PlayerRef | null>(null);
  const nowPlayingRef = useRef<Track | null>(null);
  const isRequestingNextRef = useRef(false);

  // --- STATE: MODERATION (Admin) ---
  const [pendingQueue, setPendingQueue] = useState<PendingSong[]>([]);
  const [fullQueue, setFullQueue] = useState<Track[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // --- STATE: SEARCH (Add Music) ---
  const [searchQuery, setSearchQueryValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 150);

  const latestSearchQueryRef = useRef('');
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
  const upNextRef = useRef<Track | null>(null);
  const activePlayerRef = useRef<'A' | 'B'>('A');

  useEffect(() => { upNextRef.current = upNext; }, [upNext]);
  useEffect(() => { activePlayerRef.current = activePlayer; }, [activePlayer]);

  const fetchNext = useCallback(() => {
    if (!roomId || isRequestingNextRef.current) return;

    isRequestingNextRef.current = true;
    socket.emit('eo_track_ended', { roomId, idempotencyKey: crypto.randomUUID() }, (res: EoTrackEndedResponse) => {
      if (res.success) {
        setNowPlaying(res.nextTrack);
        setUpNext(res.upNext);
      }
      isRequestingNextRef.current = false;
    });
  }, [roomId]);

  const onPlayerReady: (id: 'A' | 'B') => NonNullable<YouTubeProps['onReady']> = (id) => (event) => {
    if (id === 'A') playerARef.current = event.target as unknown as PlayerRef;
    else playerBRef.current = event.target as unknown as PlayerRef;
  };

  const onPlayerEnd = useCallback(() => {
    const cachedUpNext = upNextRef.current;
    const cachedActivePlayer = activePlayerRef.current;

    if (cachedUpNext) {
      // Try to use the preloaded player for instant playback
      const nextPlayer = cachedActivePlayer === 'A' ? 'B' : 'A';
      const newPlayer = nextPlayer === 'A' ? playerARef.current : playerBRef.current;

      if (newPlayer) {
        // Preloaded player is ready — switch to it
        setNowPlaying(cachedUpNext);
        setActivePlayer(nextPlayer);
        newPlayer.playVideo();
      } else {
        // Preloaded player not ready yet — fall through to server fetch
        setNowPlaying(null);
      }
    } else {
      // No preloaded track — clear and wait for server response
      setNowPlaying(null);
    }

    // Always fetch next upNext from server
    socket.emit('eo_track_ended', { roomId, idempotencyKey: crypto.randomUUID() }, (res: EoTrackEndedResponse) => {
      if (res.success) setUpNext(res.upNext);
    });
    // Broadcast that we're still playing (next track started)
    socket.emit('sync_playback', { roomId, currentTime: 0, isPlaying: true });
  }, [roomId]);

  const onPrevious = useCallback(() => {
    socket.emit('previous_track', { roomId }, (res: { success: boolean; previousTrack?: Track; error?: string }) => {
      if (res.success && res.previousTrack) {
        setNowPlaying(res.previousTrack);
        // Server broadcasts now_playing_updated, so other clients pick it up
      }
    });
  }, [roomId]);

  // --- SOCKET LIFECYCLE ---
  const joinRoomRef = useRef<string | null>(null);

  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  }, [nowPlaying]);

  useEffect(() => {
    if (!roomId) return;

    console.log(`[DASHBOARD] Connecting to room: ${roomId}`);
    socket.connect();

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      console.warn('Unauthorized. Missing admin token.');
      return;
    }

    const doJoinRoom = () => {
      socket.emit('join_room', { roomId, role: 'admin', adminToken }, (res: BasicResponse) => {
        if (res && !res.success) {
          console.warn(res.error || 'Failed to join room');
        }
      });
    };

    joinRoomRef.current = roomId;
    doJoinRoom();

    const handleConnect = () => {
      console.log('[DASHBOARD] Socket connected');
      setConnected(true);
      // Re-join the room on reconnect (socket.io reconnects automatically but doesn't re-emit our events)
      const token = localStorage.getItem('adminToken');
      if (token && joinRoomRef.current) {
        console.log('[DASHBOARD] Reconnecting - rejoining room');
        socket.emit('join_room', { roomId: joinRoomRef.current, role: 'admin', adminToken: token }, (res: BasicResponse) => {
          if (res && !res.success) {
            console.warn(res.error || 'Failed to rejoin room');
          }
        });
      }
    };

    // Socket might already be connected (e.g. from useAdminAuth on hub page)
    // socket.io won't re-fire 'connect' if already connected when we register the listener
    if (socket.connected) {
      handleConnect();
    }

    const handleEoRegistered = () => {
      console.log('[DASHBOARD] EO Registered successfully');
    };

    const handleRoomKeyInfo = ({ passkey }: RoomKeyInfo) => {
      console.log(`[DASHBOARD] Room Key: ${passkey}`);
      setRoomKey(passkey);
    };

    const handleNowPlayingUpdated = (track: Track) => {
      setNowPlaying(track);
    };

    const handleQueueUpdated = (queue: QueueSong[]) => {
      const pending = queue.filter((q) => q.status === 'pending');
      const approved = queue.filter((q) => q.status === 'approved') as Track[];

      setPendingQueue(pending);
      setFullQueue(approved);

      // Only request next track if there is at least one approved song.
      if (!nowPlayingRef.current && approved.length > 0 && !isRequestingNextRef.current) {
        fetchNext();
      }
    };

    const handleNewPendingSong = (song: PendingSong) => {
      console.log('[DASHBOARD] New pending song received:', song);
      setPendingQueue((prev) => [...prev, song]);
    };

    const handleSongDeleted = ({ songId }: { songId: string }) => {
      setPendingQueue((prev) => prev.filter((s) => s.id !== songId));
      setFullQueue((prev) => prev.filter((s) => s.id !== songId));
    };

    const handleSongApproved = (song: PendingSong & Partial<Track>) => {
      setPendingQueue((prev) => prev.filter((s) => s.id !== song.id));
      setFullQueue((prev) => (prev.some((s) => s.id === song.id) ? prev : [...prev, song as Track]));
    };

    const handleSongUpdated = (updated: SongUpdatedPayload) => {
      setPendingQueue((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, title: updated.title } : s)),
      );
      setFullQueue((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, title: updated.title } : s)),
      );
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('eo_registered', handleEoRegistered);
    socket.on('room_key_info', handleRoomKeyInfo);
    socket.on('now_playing_updated', handleNowPlayingUpdated);
    socket.on('queue_updated', handleQueueUpdated);
    socket.on('new_pending_song', handleNewPendingSong);
    socket.on('song_deleted', handleSongDeleted);
    socket.on('song_removed_from_queue', handleSongDeleted);
    socket.on('song_approved', handleSongApproved);
    socket.on('song_updated', handleSongUpdated);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('eo_registered', handleEoRegistered);
      socket.off('room_key_info', handleRoomKeyInfo);
      socket.off('now_playing_updated', handleNowPlayingUpdated);
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('new_pending_song', handleNewPendingSong);
      socket.off('song_deleted', handleSongDeleted);
      socket.off('song_removed_from_queue', handleSongDeleted);
      socket.off('song_approved', handleSongApproved);
      socket.off('song_updated', handleSongUpdated);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchNext, roomId]);

  useEffect(() => {
    if (connected && !nowPlaying && fullQueue.length > 0 && !isRequestingNextRef.current) {
      fetchNext();
    }
  }, [connected, fetchNext, fullQueue.length, nowPlaying]);

  // --- LOGIC: MODERATION ---
  const handleApprove = (songId: string) => {
    const original = [...pendingQueue];
    setPendingQueue((prev) => prev.filter((s) => s.id !== songId));
    setProcessingId(songId);
    socket.emit('approve_song', { roomId, songId }, (res: BasicResponse) => {
      setProcessingId(null);
      if (!res.success) {
        setPendingQueue(original);
      }
    });
  };

  const handleDelete = (songId: string) => {
    const original = [...pendingQueue];
    setPendingQueue((prev) => prev.filter((s) => s.id !== songId));
    setProcessingId(songId);
    socket.emit('delete_song', { roomId, songId }, (res: BasicResponse) => {
      setProcessingId(null);
      if (!res.success) {
        setPendingQueue(original);
      }
    });
  };

  const startEditing = (song: PendingSong) => {
    setEditingId(song.id);
    setEditValue(song.title);
  };

  const handleSaveEdit = (songId: string) => {
    socket.emit('edit_song', { roomId, songId, newTitle: editValue }, (res: BasicResponse) => {
      if (res.success) setEditingId(null);
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
    socket.emit('get_search_suggestions', { query: trimmed }, (res: SearchSuggestionsResponse) => {
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
    socket.emit('search_songs', { query: suggestion }, (res: SearchSongsResponse) => {
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

  const handleAddSong = (song: SearchResult) => {
    setSubmittingId(song.youtubeId);
    const adminToken = localStorage.getItem('adminToken');
    socket.emit(
      'admin_add_song',
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
          console.warn('[ADMIN] Failed to add song:', res.error);
        }
      },
    );
  };

  const togglePlayback = useCallback((playing: boolean) => {
    socket.emit('toggle_playback', { roomId, isPlaying: playing });
  }, [roomId]);

  const visibleSuggestions = debouncedSearch.trim().length < 2 ? [] : suggestions;

  return {
    connected,
    roomKey,
    nowPlaying,
    upNext,
    activePlayer,
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
    setEditingId,
  };
}
