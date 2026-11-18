import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, X, Loader2 } from "lucide-react";

import { Button } from "@/shared/components/button";
import { Shape } from "@/shared/shapes/shape";
import { trackThumbnail } from "@/shared/lib/youtube";
import type { Track } from "@/shared/types";

interface StationSequenceProps {
  queue: Track[];
  roomId: string;
  onAddToQueue?: () => void;
  /** Admin only. Without it the rows carry no control, which is the participant view. */
  onRemove?: (trackId: string) => void;
  /** The track being removed, so its row can show that the request is in flight. */
  removingId?: string | null;
}

/**
 * Up-next queue.
 *
 * A numbered list with square artwork per row. The artwork is square rather than
 * 16:9 so the rows stay a consistent height against the two lines of text, and the
 * source image is centre-cropped to fill it.
 */
/**
 * Memoised because the room re-renders every second while a track plays (the
 * clock and progress move); the queue does not, and redrawing it was part of
 * that per-second cost.
 */
export const StationSequence = memo(function StationSequence({
  queue,
  roomId,
  onAddToQueue,
  onRemove,
  removingId = null,
}: StationSequenceProps) {
  return (
    <aside className="flex w-full min-h-0 flex-col">
      <h2 className="mb-2 shrink-0 text-title-medium">Up next</h2>

      {/* Five rows tall on desktop: 5 × (44px artwork + 16px vertical padding)
          = 300px. A fixed height rather than a maximum is deliberate there — the
          panel must not resize as tracks are added or played, or the artwork
          above it and the disc beside it shift with every change. On mobile the
          page scrolls instead: an inner scroll box clipped a row in half and
          reserved dead space under a short queue. */}
      <div className="min-h-0 lg:h-[300px] lg:overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Shape name="cookie12" size={40} className="text-on-surface-variant" />
            <p className="text-body-medium text-on-surface-variant">Queue is empty</p>
          </div>
        ) : (
          queue.map((track, index) => {
            const artwork = trackThumbnail(track);

            return (
              <div key={track.id} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-label-medium tabular-nums text-on-surface-variant">
                  {(index + 1).toString().padStart(2, "0")}
                </span>

                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-m3-sm bg-surface-container-high">
                  {artwork ? (
                    <img
                      src={artwork}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Shape name="cookie12" size={22} className="text-on-surface-variant" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-small">{track.title}</p>
                  <p className="mt-0.5 truncate text-body-small text-on-surface-variant">
                    {track.artist || track.author}
                  </p>
                </div>

                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(track.id)}
                    disabled={removingId === track.id}
                    aria-label={`Remove ${track.title} from the queue`}
                    className="state-layer flex size-11 shrink-0 items-center justify-center rounded-m3-full text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-38"
                  >
                    {removingId === track.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <X size={18} />
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {onAddToQueue ? (
        <Button variant="tonal" size="md" className="mt-4 w-full" onClick={onAddToQueue}>
          <Plus size={20} /> Add to queue
        </Button>
      ) : (
        <Button asChild variant="tonal" size="md" className="mt-4 w-full">
          <Link to="/r/$roomId/request" params={{ roomId }}>
            <Plus size={20} /> Add to queue
          </Link>
        </Button>
      )}
    </aside>
  );
});
