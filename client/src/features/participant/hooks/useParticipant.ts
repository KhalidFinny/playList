import { useState, useEffect, useCallback, useRef } from 'react';
import { socket, getUserId } from '../../../shared/lib/socket';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { Track, SearchResult } from '../../../shared/types';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

type SuggestionsResponse = {
  success: boolean;
  suggestions?: string[];
};

type NowPlayingResponse = {
  nowPlaying?: Track | null;
};

type JoinRoomResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

type SearchSongsResponse = {
  success: boolean;
  results?: SearchResult[];
};

type SubmitSongResponse = {
  success: boolean;
  error?: string;
};

type JoinByPasskeyResponse = {
  success: boolean;
  roomId?: string;
  error?: string;
};

type QueueLikeSong = Track & { status?: string };

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

export function useParticipant(roomId: string) {
  const [query, setQueryValue] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [requestMarker, setRequestMarker] = useState('');
  const [responseMarker, setResponseMarker] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => {
        setStatusMsg(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [statusMsg]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const debouncedQuery = useDebounce(query, 350);
  const debouncedSuggestionQuery = useDebounce(query, 250);

  const latestQueryRef = useRef('');
  const suggestionRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  const setQuery = useCallback((nextQuery: string) => {
    setQueryValue(nextQuery);

    if (isConfirmed) {
      setIsConfirmed(false);
    }

    const trimmed = nextQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
    }

    if (trimmed.length === 0) {
      setResults([]);
      setRequestMarker('');
      setResponseMarker('');
    } else {
      setRequestMarker(trimmed);
    }
  }, [isConfirmed]);

  // Suggestions Effect
  useEffect(() => {
    const trimmed = debouncedSuggestionQuery.trim();
    if (trimmed.length < 2 || isConfirmed) {
      return;
    }

    const requestId = ++suggestionRequestIdRef.current;
    const requestedQuery = trimmed.toLowerCase();

    socket.emit('get_search_suggestions', { query: trimmed }, (res: SuggestionsResponse) => {
      const latestQuery = latestQueryRef.current.trim().toLowerCase();
      const isLatestRequest = requestId === suggestionRequestIdRef.current;
      const isForCurrentQuery = requestedQuery === latestQuery;

      if (res.success && isLatestRequest && isForCurrentQuery && !isConfirmed) {
        const ranked = rankSuggestions(trimmed, res.suggestions ?? []);
        setSuggestions(ranked.slice(0, 8));
      }
    });
  }, [debouncedSuggestionQuery, isConfirmed]);

  useEffect(() => {
    if (!roomId) return;

    socket.connect();

    // Initial fetch
    socket.emit('get_now_playing', { roomId }, (res: NowPlayingResponse) => {
      if (res.nowPlaying) {
        setNowPlaying(res.nowPlaying);
        setIsPlaying(true);
      }
    });

    const handleNowPlayingUpdated = (track: Track) => {
      setNowPlaying(track);
      setIsPlaying(true);
    };

    const handleQueueUpdated = (newQueue: QueueLikeSong[]) => {
      // Filter for only approved songs for the public view
      setQueue(newQueue.filter((song) => song.status === 'approved') as Track[]);
    };

    const handlePlaybackUpdated = (state: { isPlaying: boolean }) => {
      setIsPlaying(state.isPlaying);
    };

    const handleSongApproved = (song: Track) => {
      setQueue((prev) => (prev.some((item) => item.id === song.id) ? prev : [...prev, song]));
    };

    const handleSongRemoved = ({ songId }: { songId: string }) => {
      setQueue((prev) => prev.filter((song) => song.id !== songId));
    };

    socket.on('now_playing_updated', handleNowPlayingUpdated);
    socket.on('queue_updated', handleQueueUpdated);
    socket.on('playback_updated', handlePlaybackUpdated);
    socket.on('song_approved', handleSongApproved);
    socket.on('song_removed_from_queue', handleSongRemoved);

    return () => {
      socket.off('now_playing_updated', handleNowPlayingUpdated);
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('playback_updated', handlePlaybackUpdated);
      socket.off('song_approved', handleSongApproved);
      socket.off('song_removed_from_queue', handleSongRemoved);
    };
  }, [roomId]);

  const joinRoom = (passkey: string, callback?: (success: boolean, error?: string) => void, silent = false) => {
    if (!silent) setStatusMsg(null);
    socket.emit('join_room', { roomId, role: 'participant', passkey }, (res: JoinRoomResponse) => {
      if (res?.success) {
        if (!silent) setStatusMsg({ type: 'success', text: 'Access granted! Welcome to the room.' });
        callback?.(true);
      } else {
        const errorText = res?.message || res?.error || 'Failed to join';
        if (!silent) setStatusMsg({ type: 'error', text: errorText });
        callback?.(false, errorText);
      }
    });
  };

  // Live Search Effect
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setResponseMarker('');
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const currentSearch = trimmed.toLowerCase();

    socket.emit('search_songs', { query: trimmed }, (res: SearchSongsResponse) => {
      const latestQuery = latestQueryRef.current.trim().toLowerCase();
      const isLatestRequest = requestId === searchRequestIdRef.current;
      const isForCurrentQuery = currentSearch === latestQuery;

      if (isLatestRequest && isForCurrentQuery) {
        setResponseMarker(trimmed);
        if (res.success) {
          setResults(res.results ?? []);
          setStatusMsg(null);
        }
      }
    });
  }, [debouncedQuery]);

  const handleSelect = (song: SearchResult) => {
    const originalQuery = query;
    const originalResults = results;

    setSubmitting(song.youtubeId);
    setStatusMsg({ type: 'success', text: 'Submitting request...' });

    socket.emit(
      'submit_song',
      {
        roomId,
        youtubeId: song.youtubeId,
        title: song.title,
        author: song.author,
        userId: getUserId(),
      },
      (res: SubmitSongResponse) => {
        setSubmitting(null);
        if (res.success) {
          setStatusMsg({ type: 'success', text: 'Song added to queue!' });
          // Start 3s cooldown on submit buttons
          setCooldownSeconds(3);
        } else {
          setResults(originalResults);
          setQuery(originalQuery);
          setStatusMsg({ type: 'error', text: res.error ?? 'Unable to submit song' });
        }
      },
    );
  };

  const clearStatusMsg = useCallback(() => {
    setStatusMsg(null);
  }, []);

  const resolveRoomByKey = useCallback(
    (passkey: string, callback: (success: boolean, resolvedRoomId?: string, error?: string) => void) => {
      setStatusMsg(null);
      socket.emit('join_by_passkey', { passkey }, (res: JoinByPasskeyResponse) => {
        if (res.success) {
          setStatusMsg({ type: 'success', text: 'Room found! Redirecting...' });
          callback(true, res.roomId);
        } else {
          callback(false, undefined, res.error);
        }
      });
    },
    [],
  );

  const visibleResults = query.trim().length === 0 ? [] : results;
  const visibleSuggestions = query.trim().length < 2 || isConfirmed ? [] : suggestions;

  const loading = query.trim().length > 0 && requestMarker !== responseMarker;

  return {
    query,
    setQuery,
    isConfirmed,
    setIsConfirmed,
    results: visibleResults,
    loading,
    submitting,
    nowPlaying,
    isPlaying,
    queue,
    statusMsg,
    suggestions: visibleSuggestions,
    handleSelect,
    joinRoom,
    clearStatusMsg,
    resolveRoomByKey,
    cooldownSeconds,
  };
}
