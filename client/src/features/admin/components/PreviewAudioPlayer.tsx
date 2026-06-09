import { useRef, useEffect, useState } from 'react';
import YouTube from 'react-youtube';
import { Headphones, Speaker } from 'lucide-react';

interface PreviewAudioPlayerProps {
  youtubeId: string;
  isActive: boolean;
  deviceId?: string;
  title?: string;
  author?: string;
}

type PlayerMode = 'youtube-iframe' | 'audio-element' | 'loading';

export function PreviewAudioPlayer({ youtubeId, isActive, deviceId, title, author }: PreviewAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<PlayerMode>('loading');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shouldUseAudioElement = deviceId && deviceId !== 'default';

  // Fetch audio URL from server when using audio element approach
  useEffect(() => {
    if (!isActive || !shouldUseAudioElement) {
      setMode(shouldUseAudioElement ? 'loading' : 'youtube-iframe');
      return;
    }

    setMode('loading');
    setError(null);

    fetch(`/api/preview/${youtubeId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to get audio stream');
        return res.json() as Promise<{ url: string }>;
      })
      .then((data) => {
        setAudioUrl(data.url);
        setMode('audio-element');
      })
      .catch((err) => {
        console.error('[PREVIEW] Audio fetch failed:', err);
        setError('Audio stream unavailable, falling back to YouTube player');
        setMode('youtube-iframe');
      });

    return () => {
      setAudioUrl(null);
    };
  }, [isActive, shouldUseAudioElement, youtubeId]);

  // Create and manage audio element with setSinkId
  useEffect(() => {
    if (mode !== 'audio-element' || !audioUrl || !deviceId) return;

    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = 'anonymous';
    audio.src = audioUrl;
    audio.loop = false;
    audio.volume = 1;

    const handleCanPlay = async () => {
      try {
        // @ts-ignore - setSinkId available in Chrome 110+, Edge, Safari 15.4+
        await audio.setSinkId(deviceId);
        console.log(`[PREVIEW] Audio routed to device: ${deviceId}`);
      } catch {
        console.warn('[PREVIEW] setSinkId not supported, playing through default');
      }
      audio.play().catch(() => {});
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', () => {
      setError('Failed to load audio');
    });
    audio.load();

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [mode, audioUrl, deviceId]);

  if (!isActive) return null;

  // Audio element mode with setSinkId routing
  if (mode === 'audio-element') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/5 rounded-xl border border-orange-500/15">
        <Headphones size={18} className="text-orange-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-black/80 truncate leading-tight">{title || 'Previewing'}</p>
          {author && (
            <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest truncate">{author}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[9px] font-bold text-orange-500/60 uppercase tracking-widest">Preview</span>
          </div>
          <span className="text-[8px] font-bold text-black/20 uppercase tracking-widest flex items-center gap-1">
            <Speaker size={10} /> Routed
          </span>
        </div>
      </div>
    );
  }

  // Fallback: YouTube iframe (plays through default speakers)
  return (
    <div className="flex items-center gap-4 max-w-lg mx-auto">
      <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-black">
        <YouTube
          videoId={youtubeId}
          opts={{
            width: '48',
            height: '48',
            playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0 },
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-black truncate leading-tight">{title || 'Previewing'}</p>
        {author && (
          <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest truncate mt-0.5">{author}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-[9px] font-bold text-black/30 uppercase tracking-widest">Preview</span>
      </div>
      {error && <p className="text-[9px] text-orange-500 italic">{error}</p>}
    </div>
  );
}
