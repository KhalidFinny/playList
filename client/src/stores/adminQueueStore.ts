import { create } from 'zustand';
import type { PendingSong, Track } from '../shared/types';

type SongUpdatedPayload = { id: string; title: string };

type AdminQueueState = {
  pendingQueue: PendingSong[];
  fullQueue: Track[];
  processingId: string | null;
  editingId: string | null;
  editValue: string;
  applyInitialQueues: (pendingQueue: PendingSong[], fullQueue: Track[]) => void;
  applyNewPendingSong: (song: PendingSong) => void;
  applySongApproved: (song: Track) => void;
  applySongDeleted: (songId: string) => void;
  applySongUpdated: (payload: SongUpdatedPayload) => void;
  clearEntireQueue: () => void;
  setProcessingId: (id: string | null) => void;
  startEditing: (song: Pick<Track, 'id' | 'title'>) => void;
  stopEditing: () => void;
  setEditValue: (value: string) => void;
  resetAdminQueue: () => void;
};

const initialAdminQueueState = {
  pendingQueue: [] as PendingSong[],
  fullQueue: [] as Track[],
  processingId: null,
  editingId: null,
  editValue: '',
};

export const useAdminQueueStore = create<AdminQueueState>((set) => ({
  ...initialAdminQueueState,
  applyInitialQueues: (pendingQueue, fullQueue) => set({ pendingQueue, fullQueue }),
  applyNewPendingSong: (song) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.some((item) => item.id === song.id)
        ? state.pendingQueue
        : [song, ...state.pendingQueue],
    })),
  applySongApproved: (song) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.filter((item) => item.id !== song.id),
      fullQueue: state.fullQueue.some((item) => item.id === song.id) ? state.fullQueue : [...state.fullQueue, song],
    })),
  applySongDeleted: (songId) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.filter((song) => song.id !== songId),
      fullQueue: state.fullQueue.filter((song) => song.id !== songId),
    })),
  applySongUpdated: ({ id, title }) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.map((song) => (song.id === id ? { ...song, title } : song)),
      fullQueue: state.fullQueue.map((song) => (song.id === id ? { ...song, title } : song)),
    })),
  clearEntireQueue: () => set({ pendingQueue: [], fullQueue: [] }),
  setProcessingId: (processingId) => set({ processingId }),
  startEditing: (song) => set({ editingId: song.id, editValue: song.title }),
  stopEditing: () => set({ editingId: null, editValue: '' }),
  setEditValue: (editValue) => set({ editValue }),
  resetAdminQueue: () => set(initialAdminQueueState),
}));
