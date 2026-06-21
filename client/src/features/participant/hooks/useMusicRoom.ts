import { useEffect } from 'react';
import { socket } from '../../../shared/lib/socket';
import type { PendingSong, Track } from '../../../shared/types';
import { useRoomStore } from '../../../stores/roomStore';
import type { JoinRoomResponse, NowPlayingResponse } from '../types';

export function useMusicRoom(roomId: string) {
  const nowPlaying = useRoomStore((state) => state.nowPlaying);
  const queue = useRoomStore((state) => state.queue);
  const isPlaying = useRoomStore((state) => state.isPlaying);
  const roomKey = useRoomStore((state) => state.roomKey);
  const currentTime = useRoomStore((state) => state.currentTime);
  const duration = useRoomStore((state) => state.duration);
  const isConnecting = useRoomStore((state) => state.isConnecting);

  useEffect(() => {
    if (!roomId) return;

    const store = useRoomStore.getState();
    store.setRoomId(roomId);
    store.setIsConnecting(true);
    socket.connect();
    
    const joinWithSavedPasskey = () => {
      const passkey = sessionStorage.getItem(`room_${roomId}_key`);
      if (passkey) {
        socket.emit('join_room', { roomId, role: 'participant', passkey }, (res: JoinRoomResponse) => {
          if (!res.success && res.code === 'WRONG_PASSKEY') {
            console.warn(`[AUTH] Stale key found for room ${roomId}, clearing...`);
            sessionStorage.removeItem(`room_${roomId}_key`);
          }
        });
      }
    };

    joinWithSavedPasskey();

    const handleRoomKeyInfo = ({ passkey }: { passkey: string }) => useRoomStore.getState().setRoomKey(passkey);

    socket.emit('get_now_playing', { roomId }, (res: NowPlayingResponse) => {
      if (res.nowPlaying) useRoomStore.getState().setNowPlaying(res.nowPlaying);
      useRoomStore.getState().setIsConnecting(false);
    });

    const fallbackTimer = setTimeout(() => useRoomStore.getState().setIsConnecting(false), 3000);

    const handleNowPlayingUpdated = (track: Track) => useRoomStore.getState().setNowPlaying(track);
    const handlePlaybackUpdated = (state: { isPlaying: boolean }) => useRoomStore.getState().applyPlaybackUpdated(state.isPlaying);
    const handleQueueUpdated = (newQueue: PendingSong[]) => useRoomStore.getState().applyQueueSnapshot(newQueue);
    const handleSongApproved = (song: Track) => useRoomStore.getState().applySongApproved(song);
    const handleSongRemoved = ({ songId }: { songId: string }) => useRoomStore.getState().applySongRemoved(songId);
    const handlePlaybackSync = (state: { currentTime: number; duration: number; isPlaying: boolean }) =>
      useRoomStore.getState().applyPlaybackSync(state);

    socket.on('connect', joinWithSavedPasskey);
    socket.on('room_key_info', handleRoomKeyInfo);
    socket.on('now_playing_updated', handleNowPlayingUpdated);
    socket.on('playback_updated', handlePlaybackUpdated);
    const handleQueueCleared = () => useRoomStore.getState().clearRoomQueue();

    socket.on('playback_sync', handlePlaybackSync);
    socket.on('queue_updated', handleQueueUpdated);
    socket.on('song_approved', handleSongApproved);
    socket.on('queue_cleared', handleQueueCleared);
    socket.on('song_removed_from_queue', handleSongRemoved);

    return () => {
      clearTimeout(fallbackTimer);
      socket.off('connect', joinWithSavedPasskey);
      socket.off('room_key_info', handleRoomKeyInfo);
      socket.off('now_playing_updated', handleNowPlayingUpdated);
      socket.off('playback_updated', handlePlaybackUpdated);
      socket.off('playback_sync', handlePlaybackSync);
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('song_approved', handleSongApproved);
      socket.off('queue_cleared', handleQueueCleared);
      socket.off('song_removed_from_queue', handleSongRemoved);
    };
  }, [roomId]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return {
    nowPlaying,
    queue,
    isPlaying,
    roomKey,
    currentTime,
    duration,
    progress,
    isConnecting,
  };
}
