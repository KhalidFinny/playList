import type { FC } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/shared/components/button";
import { Shape } from "@/shared/shapes/shape";
import { trackThumbnail } from "@/shared/lib/youtube";
import type { Track } from "@/shared/types";

interface StationSequenceProps {
  queue: Track[];
  roomId: string;
  onAddToQueue?: () => void;
}

/**
 * Up-next queue.
 *
 * A numbered list with square artwork per row. The artwork is square rather than
 * 16:9 so the rows stay a consistent height against the two lines of text, and the
 * source image is centre-cropped to fill it.
 */
export const StationSequence: FC<StationSequenceProps> = ({ queue, roomId, onAddToQueue }) => {
  return (
    <aside className="flex min-h-0 w-full flex-col">
      <h2 className="mb-2 text-title-medium">Up next</h2>

      <div className="min-h-0 flex-1 overflow-y-auto">
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
};
