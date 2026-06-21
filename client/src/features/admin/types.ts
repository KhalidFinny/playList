import type { YouTubeProps } from 'react-youtube';
import type { Track, PendingSong, SearchResult } from '../../shared/types';

export type { Track, PendingSong, SearchResult };

export type BasicResponse = {
  success: boolean;
  error?: string;
};

export type RoomKeyInfo = { passkey: string };

export type QueueSong = PendingSong & Partial<Track>;

export type EoTrackEndedResponse = {
  success: boolean;
  oldTrackId?: string | null;
  nextTrack: Track | null;
  upNext: Track | null;
};

export type SongUpdatedPayload = { id: string; title: string };

export type SearchSuggestionsResponse = {
  success: boolean;
  suggestions?: string[];
};

export type SearchSongsResponse = {
  success: boolean;
  results?: SearchResult[];
};

export interface PlayerRef {
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export interface PlaybackControllerProps {
  roomId: string;
  nowPlaying: Track | null;
  upNext: Track | null;
  fullQueue: Track[];
  activePlayer: 'A' | 'B';
  hasPreviousTrack: boolean;
  onPlayerReady: (id: 'A' | 'B') => NonNullable<YouTubeProps['onReady']>;
  onPlayerEnd: () => Promise<boolean>;
  onPrevious: () => Promise<boolean>;
  onGoToSearch: () => void;
  togglePlayback: (isPlaying: boolean) => void;
}

export interface ModerationQueueProps {
  pendingQueue: PendingSong[];
  processingId: string | null;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  handleApprove: (id: string) => void;
  handleDelete: (id: string) => void;
  startEditing: (song: PendingSong) => void;
  handleSaveEdit: (id: string) => void;
  setEditingId: (id: string | null) => void;
  onPreviewChange: (previewId: string | null) => void;
  onClearQueue?: () => void;
  pendingCount?: number;
}

export interface DashboardHeaderProps {
  roomId: string;
  connected: boolean;
  tabs: { id: string; label: string; icon: string }[];
  activeTab: string;
  setActiveTab: (id: string) => void;
}

export interface SongSearchProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchLoading: boolean;
  searchResults: SearchResult[];
  suggestions: string[];
  onSelectSuggestion: (s: string) => void;
  handleAddSong: (song: SearchResult) => void;
  submittingId: string | null;
}
