import type { TrackMetadataProps } from '../types';

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const TrackMetadata = ({ track, currentTime = 0, duration = 0 }: TrackMetadataProps) => {
    if (!track) return (
        <header className="mb-12">
            <h1 className="text-6xl xl:text-7xl font-bebas tracking-tight text-black/25 leading-none uppercase mb-4">
                Nothing playing
            </h1>
            <p className="text-sm font-bold tracking-widest text-black/45 uppercase font-poppins">
                Waiting for music
            </p>
        </header>
    );

    return (
        <header className="mb-12">
            <h1 className="text-6xl xl:text-7xl font-bebas tracking-tight text-neutral-800 leading-none uppercase mb-4 transition-all line-clamp-2">
                {track.title}
            </h1>
            <div className="space-y-1">
                <p className="text-xl font-bold tracking-normal text-neutral-600 uppercase font-poppins leading-none">
                    {track.author}
                </p>
                <div className="flex items-center gap-3 mt-3">
                    <span className="text-sm font-bold text-black/40 uppercase font-poppins tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    {duration > 0 && (
                        <div className="h-1.5 flex-1 max-w-[200px] bg-black/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
                <p className="text-sm font-bold tracking-widest text-black/30 uppercase font-poppins pt-1">
                    Playing now
                </p>
            </div>
        </header>
    );
};
