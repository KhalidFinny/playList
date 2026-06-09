import type { Track } from '../../shared/types';

export interface StationSequenceProps {
    queue: Track[];
    roomId: string;
}

export interface TrackMetadataProps {
    track: Track | null;
    currentTime?: number;
    duration?: number;
}
