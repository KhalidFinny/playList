import { useRef, useEffect, useState } from "react";
import YouTube from "react-youtube";
import { Headphones, Speaker } from "lucide-react";
import { Badge } from "@/shared/components/badge";

interface PreviewAudioPlayerProps {
  youtubeId: string;
  isActive: boolean;
  deviceId?: string;
  title?: string;
  author?: string;
}

type PlayerMode = "youtube-iframe" | "audio-element" | "loading";

export function PreviewAudioPlayer({
  youtubeId,
  isActive,
  deviceId,
  title,
  author,
}: PreviewAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<PlayerMode>("loading");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shouldUseAudioElement = deviceId && deviceId !== "default";

  useEffect(() => {
    if (!isActive || !shouldUseAudioElement) {
      setMode(shouldUseAudioElement ? "loading" : "youtube-iframe");
      return;
    }

    setMode("loading");
    setError(null);

    fetch(`/api/preview/${youtubeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to get audio stream");
        return res.json() as Promise<{ url: string }>;
      })
      .then((data) => {
        setAudioUrl(data.url);
        setMode("audio-element");
      })
      .catch((err) => {
        console.error("[PREVIEW] Audio fetch failed:", err);
        setError("Audio stream unavailable, falling back to YouTube player");
        setMode("youtube-iframe");
      });

    return () => {
      setAudioUrl(null);
    };
  }, [isActive, shouldUseAudioElement, youtubeId]);

  useEffect(() => {
    if (mode !== "audio-element" || !audioUrl || !deviceId) return;

    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;
    audio.loop = false;
    audio.volume = 1;

    const handleCanPlay = async () => {
      try {
        await audio.setSinkId(deviceId);
      } catch {
        console.warn("[PREVIEW] setSinkId not supported, playing through default");
      }
      audio.play().catch(() => {});
    };

    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", () => {
      setError("Failed to load audio");
    });
    audio.load();

    return () => {
      audio.removeEventListener("canplay", handleCanPlay);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [mode, audioUrl, deviceId]);

  if (!isActive) return null;

  if (mode === "audio-element") {
    return (
      <div className="flex items-center gap-3 rounded-m3-sm bg-primary-container px-4 py-3 text-on-primary-container">
        <Headphones size={20} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-title-small">{title || "Previewing"}</p>
          {author && <p className="truncate text-body-small opacity-80">{author}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="status" className="animate-pulse bg-primary" />
          <span className="flex items-center gap-1 text-label-medium">
            <Speaker size={14} /> Routed
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="size-12 shrink-0 overflow-hidden rounded-m3-sm bg-inverse-surface">
        <YouTube
          videoId={youtubeId}
          opts={{
            width: "48",
            height: "48",
            playerVars: {
              autoplay: 1,
              controls: 0,
              modestbranding: 1,
              rel: 0,
              origin: window.location.origin,
            },
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title-small">{title || "Previewing"}</p>
        {author && (
          <p className="mt-0.5 truncate text-body-small text-on-surface-variant">{author}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="status" className="animate-pulse bg-primary" />
        <span className="text-label-medium text-on-surface-variant">Preview</span>
      </div>
      {error && <p className="text-body-small text-error">{error}</p>}
    </div>
  );
}
