import { useState, useEffect } from 'react';
import { socket } from '../../../shared/lib/socket';
import type { Track, PendingSong } from '../../../shared/types';

type JoinRoomResponse = {
  success: boolean;
  code?: string;
};

type GetNowPlayingResponse = {
  nowPlaying?: Track | null;
};

export function useMusicRoom(roomId: string) {
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    socket.connect();
    
    const doJoinRoom = () => {
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

    doJoinRoom();

    const handleRoomKeyInfo = ({ passkey }: { passkey: string }) => {
      setRoomKey(passkey);
    };

    // Initial fetch
    socket.emit('get_now_playing', { roomId }, (res: GetNowPlayingResponse) => {
      if (res.nowPlaying) setNowPlaying(res.nowPlaying);
      setIsConnecting(false);
    });

    // Also fall back if socket never responds (e.g. offline)
    const fallbackTimer = setTimeout(() => setIsConnecting(false), 3000);

    const handleNowPlayingUpdated = (track: Track) => {
      setNowPlaying(track);
    };

    const handlePlaybackUpdated = (state: { isPlaying: boolean }) => {
      setIsPlaying(state.isPlaying);
    };

    const handleQueueUpdated = (newQueue: PendingSong[]) => {
      // Filter for only approved songs for the public view
      setQueue(newQueue.filter(s => s.status === 'approved') as Track[]);
    };

    const handleSongApproved = (song: Track) => {
      setQueue((prev) => (prev.some((item) => item.id === song.id) ? prev : [...prev, song]));
    };

    const handleSongRemoved = ({ songId }: { songId: string }) => {
      setQueue((prev) => prev.filter((song) => song.id !== songId));
    };

    // Re-join room on socket reconnect
    const handleConnect = () => {
      const passkey = sessionStorage.getItem(`room_${roomId}_key`);
      if (passkey) {
        socket.emit('join_room', { roomId, role: 'participant', passkey }, (res: JoinRoomResponse) => {
          if (!res.success && res.code === 'WRONG_PASSKEY') {
            sessionStorage.removeItem(`room_${roomId}_key`);
          }
        });
      }
    };

    const handlePlaybackSync = (state: { currentTime: number; duration: number; isPlaying: boolean }) => {
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
      setIsPlaying(state.isPlaying);
    };

    socket.on('connect', handleConnect);
    socket.on('room_key_info', handleRoomKeyInfo);
    socket.on('now_playing_updated', handleNowPlayingUpdated);
    socket.on('playback_updated', handlePlaybackUpdated);
    socket.on('playback_sync', handlePlaybackSync);
    socket.on('queue_updated', handleQueueUpdated);
    socket.on('song_approved', handleSongApproved);
    socket.on('song_removed_from_queue', handleSongRemoved);

    // Cleanup
    return () => {
      clearTimeout(fallbackTimer);
      socket.off('connect', handleConnect);
      socket.off('room_key_info', handleRoomKeyInfo);
      socket.off('now_playing_updated', handleNowPlayingUpdated);
      socket.off('playback_updated', handlePlaybackUpdated);
      socket.off('playback_sync', handlePlaybackSync);
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('song_approved', handleSongApproved);
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
    isConnecting
  };
}
