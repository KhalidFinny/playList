import { useEffect, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { socket, getUserId } from '../../../shared/lib/socket';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { PendingSong, SearchResult, Track } from '../../../shared/types';
import { participantFlowMachine } from '../../../machines/participantFlowMachine';
import { useRoomStore } from '../../../stores/roomStore';

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
  code?: string;
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

const normalize = (value: string) => value.toLowerCase().trim();

const rankSuggestions = (query: string, rawSuggestions: string[]) => {
  const q = normalize(query);
  const unique = Array.from(new Set(rawSuggestions.map((item) => item.trim()).filter(Boolean)));

  return unique
    .map((text) => {
      const n = normalize(text);
      return { text, starts: n.startsWith(q), idx: n.indexOf(q), len: n.length };
    })
    .sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.len - b.len;
    })
    .map((item) => item.text);
};

export function useParticipant(roomId: string) {
  const [flow, send] = useMachine(participantFlowMachine);
  const { query, results, suggestions, isConfirmed, submittingId, statusMsg, cooldownSeconds } = flow.context;

  const nowPlaying = useRoomStore((state) => state.nowPlaying);
  const isPlaying = useRoomStore((state) => state.isPlaying);
  const queue = useRoomStore((state) => state.queue);

  const debouncedQuery = useDebounce(query, 350);
  const debouncedSuggestionQuery = useDebounce(query, 250);

  useEffect(() => {
    if (!statusMsg) return;
    const timer = setTimeout(() => send({ type: 'CLEAR_STATUS' }), 4000);
    return () => clearTimeout(timer);
  }, [send, statusMsg]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => send({ type: 'COOLDOWN_TICK' }), 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds, send]);

  const setQuery = useCallback((nextQuery: string) => {
    send({ type: 'QUERY_CHANGED', value: nextQuery });
  }, [send]);

  const setIsConfirmed = useCallback((value: boolean) => {
    send({ type: 'CONFIRM_QUERY', value });
  }, [send]);

  useEffect(() => {
    const trimmed = debouncedSuggestionQuery.trim();
    if (trimmed.length < 2 || isConfirmed) return;

    const requestId = flow.context.suggestionRequestId + 1;
    send({ type: 'SUGGESTIONS_REQUESTED', query: trimmed });

    socket.emit('get_search_suggestions', { query: trimmed }, (res: SuggestionsResponse) => {
      if (!res.success) return;
      send({
        type: 'SUGGESTIONS_RECEIVED',
        requestId,
        query: trimmed,
        suggestions: rankSuggestions(trimmed, res.suggestions ?? []),
      });
    });
  }, [debouncedSuggestionQuery, isConfirmed, send]);

  useEffect(() => {
    if (!roomId) return;

    useRoomStore.getState().setRoomId(roomId);
    socket.connect();

    socket.emit('get_now_playing', { roomId }, (res: NowPlayingResponse) => {
      if (res.nowPlaying) useRoomStore.getState().setNowPlaying(res.nowPlaying);
    });

    const handleNowPlayingUpdated = (track: Track) => useRoomStore.getState().setNowPlaying(track);
    const handleQueueUpdated = (newQueue: PendingSong[]) => useRoomStore.getState().applyQueueSnapshot(newQueue);
    const handlePlaybackUpdated = (state: { isPlaying: boolean }) => useRoomStore.getState().applyPlaybackUpdated(state.isPlaying);
    const handlePlaybackSync = (state: { currentTime: number; duration: number; isPlaying: boolean }) =>
      useRoomStore.getState().applyPlaybackSync(state);
    const handleSongApproved = (song: Track) => useRoomStore.getState().applySongApproved(song);
    const handleSongRemoved = ({ songId }: { songId: string }) => useRoomStore.getState().applySongRemoved(songId);

    socket.on('now_playing_updated', handleNowPlayingUpdated);
    socket.on('queue_updated', handleQueueUpdated);
    socket.on('playback_updated', handlePlaybackUpdated);
    socket.on('playback_sync', handlePlaybackSync);
    socket.on('song_approved', handleSongApproved);
    socket.on('song_removed_from_queue', handleSongRemoved);

    return () => {
      socket.off('now_playing_updated', handleNowPlayingUpdated);
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('playback_updated', handlePlaybackUpdated);
      socket.off('playback_sync', handlePlaybackSync);
      socket.off('song_approved', handleSongApproved);
      socket.off('song_removed_from_queue', handleSongRemoved);
    };
  }, [roomId]);

  const joinRoom = (passkey: string, callback?: (success: boolean, error?: string) => void, silent = false) => {
    if (!silent) send({ type: 'CLEAR_STATUS' });
    send({ type: 'SUBMIT_PASSKEY' });
    socket.emit('join_room', { roomId, role: 'participant', passkey }, (res: JoinRoomResponse) => {
      if (res?.success) {
        send({ type: 'JOIN_OK' });
        if (silent) send({ type: 'CLEAR_STATUS' });
        callback?.(true);
      } else {
        const errorText = res?.message || res?.error || 'Failed to join';
        send({ type: 'JOIN_FAILED', error: errorText });
        if (silent) send({ type: 'CLEAR_STATUS' });
        callback?.(false, errorText);
      }
    });
  };

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) return;

    const requestId = flow.context.searchRequestId + 1;
    send({ type: 'SEARCH_REQUESTED', query: trimmed });

    socket.emit('search_songs', { query: trimmed }, (res: SearchSongsResponse) => {
      if (res.success) {
        send({ type: 'SEARCH_RECEIVED', requestId, query: trimmed, results: res.results ?? [] });
      }
    });
  }, [debouncedQuery, send]);

  const handleSelect = (song: SearchResult) => {
    send({ type: 'SELECT_SONG', youtubeId: song.youtubeId });

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
        if (res.success) send({ type: 'SUBMIT_OK' });
        else send({ type: 'SUBMIT_FAILED', error: res.error ?? 'Unable to submit song' });
      },
    );
  };

  const clearStatusMsg = useCallback(() => send({ type: 'CLEAR_STATUS' }), [send]);

  const resolveRoomByKey = useCallback(
    (passkey: string, callback: (success: boolean, resolvedRoomId?: string, error?: string) => void) => {
      send({ type: 'CLEAR_STATUS' });
      socket.emit('join_by_passkey', { passkey }, (res: JoinByPasskeyResponse) => {
        if (res.success) {
          send({ type: 'JOIN_OK' });
          callback(true, res.roomId);
        } else {
          callback(false, undefined, res.error);
        }
      });
    },
    [send],
  );

  const visibleResults = query.trim().length === 0 ? [] : results;
  const visibleSuggestions = query.trim().length < 2 || isConfirmed ? [] : suggestions;
  const loading = query.trim().length > 0 && flow.matches('searching');

  return {
    query,
    setQuery,
    isConfirmed,
    setIsConfirmed,
    results: visibleResults,
    loading,
    submitting: submittingId,
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
