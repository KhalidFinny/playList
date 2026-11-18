import type { Track } from "../../shared/types";

export interface StationSequenceProps {
  queue: Track[];
  roomId: string;
}

export interface TrackMetadataProps {
  track: Track | null;
  currentTime?: number;
  duration?: number;
  /** Seek to a fraction of the track. Only passed for the host. */
  onSeek?: (value: number, committed: boolean) => void;
  /** Drives the "now playing" morph; the shape holds still when paused. */
  isPlaying?: boolean;
}
