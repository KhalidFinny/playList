import type { SearchResult, Track } from "../../shared/types";

export type ParticipantTrack = Track;

export type SuggestionsResponse = {
  success: boolean;
  suggestions?: string[];
};

export type NowPlayingResponse = {
  nowPlaying?: Track | null;
};

export type JoinRoomResponse = {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
};

export type SearchSongsResponse = {
  success: boolean;
  results?: SearchResult[];
};

export type SubmitSongResponse = {
  success: boolean;
  error?: string;
};

export type JoinByPasskeyResponse = {
  success: boolean;
  roomId?: string;
  error?: string;
};
