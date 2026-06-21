import { create } from 'zustand';
import type { PendingSong, Track } from '../shared/types';

type PlaybackSync = { currentTime: number; duration: number; isPlaying: boolean };

type RoomState = {
  roomId: string | null;
  roomKey: string | null;
  nowPlaying: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isConnecting: boolean;
  setRoomId: (roomId: string | null) => void;
  setRoomKey: (roomKey: string | null) => void;
  setNowPlaying: (track: Track | null) => void;
  applyQueueSnapshot: (queue: Array<PendingSong | Track>) => void;
  applySongApproved: (song: Track) => void;
  applySongRemoved: (songId: string) => void;
  applyPlaybackUpdated: (isPlaying: boolean) => void;
  applyPlaybackSync: (state: PlaybackSync) => void;
  clearRoomQueue: () => void;
  setIsConnecting: (isConnecting: boolean) => void;
  resetRoom: () => void;
};

const initialRoomState = {
  roomId: null,
  roomKey: null,
  nowPlaying: null,
  queue: [] as Track[],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  isConnecting: true,
};

export const useRoomStore = create<RoomState>((set) => ({
  ...initialRoomState,
  setRoomId: (roomId) => set({ roomId }),
  setRoomKey: (roomKey) => set({ roomKey }),
  setNowPlaying: (track) =>
    set((state) => ({
      nowPlaying: track,
      isPlaying: Boolean(track),
      queue: track ? state.queue.filter((song) => song.id !== track.id) : state.queue,
    })),
  applyQueueSnapshot: (queue) =>
    set({ queue: queue.filter((song) => !('status' in song) || song.status === 'approved') as Track[] }),
  applySongApproved: (song) =>
    set((state) => ({
      queue: state.queue.some((item) => item.id === song.id) ? state.queue : [...state.queue, song],
    })),
  applySongRemoved: (songId) => set((state) => ({ queue: state.queue.filter((song) => song.id !== songId) })),
  applyPlaybackUpdated: (isPlaying) => set({ isPlaying }),
  applyPlaybackSync: ({ currentTime, duration, isPlaying }) => set({ currentTime, duration, isPlaying }),
  clearRoomQueue: () => set({ queue: [] }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  resetRoom: () => set(initialRoomState),
}));
