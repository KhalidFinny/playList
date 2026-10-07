import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Play, Headphones, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Logo } from "@/shared/components/Logo";
import { transitions } from "@/shared/motion/springs";
import { PreviewAudioPlayer } from "./PreviewAudioPlayer";
import { useAudioOutput } from "@/shared/hooks/useAudioOutput";

import type { ModerationQueueProps } from "../types";

/**
 * Moderation queue.
 *
 * Rows are M3 list items on `surface-container` tiers. Approve is `success`
 * (tertiary role), delete is an `outlined` icon button in the error role. The
 * empty state uses the shape library rather than a bare icon.
 */
export function ModerationQueue({
  pendingQueue,
  processingId,
  editingId,
  editValue,
  setEditValue,
  handleApprove,
  handleDelete,
  handleSaveEdit,
  onPreviewChange,
  onClearQueue,
  pendingCount,
}: ModerationQueueProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { devices, selectedDeviceId, selectDevice, supportsSetSinkId, isCustomDevice } =
    useAudioOutput();

  const togglePreview = (youtubeId: string | null) => {
    const nextId = previewId === youtubeId ? null : youtubeId;
    setPreviewId(nextId);
    onPreviewChange(nextId);
  };

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title-large">Pending requests</h2>
          <p className="mt-0.5 text-body-small text-on-surface-variant">Songs to approve</p>
        </div>

        <div className="flex items-center gap-2">
          {devices.length > 0 && supportsSetSinkId && (
            <div className="relative flex min-w-0 items-center">
              <select
                value={selectedDeviceId}
                onChange={(e) => selectDevice(e.target.value)}
                aria-label="Preview audio output device"
                className="h-10 max-w-[11rem] truncate rounded-m3-sm border border-outline-variant bg-transparent pl-3 pr-8 text-label-large text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="default">Default speaker</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
              <Headphones
                size={16}
                className="pointer-events-none absolute right-3 text-on-surface-variant"
              />
            </div>
          )}

          {onClearQueue && pendingCount !== undefined && pendingCount > 0 && (
            <Button
              variant="outlined"
              size="sm"
              onClick={onClearQueue}
              className="border-error text-error"
            >
              <Trash2 size={18} /> Clear all
            </Button>
          )}

          <span className="flex h-10 items-center rounded-m3-full bg-surface-container-high px-4 text-label-large text-on-surface-variant">
            {pendingQueue.length.toString().padStart(2, "0")} waiting
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4">
        <AnimatePresence>
          {pendingQueue.map((song, index) => (
            <motion.article
              key={song.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.fast}
            >
              <div className="flex flex-col gap-3 rounded-m3-md bg-surface-container p-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-6 shrink-0 text-label-medium tabular-nums text-on-surface-variant">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>

                  <div className="group relative size-14 shrink-0 overflow-hidden rounded-m3-sm bg-surface-container-highest">
                    <img
                      src={`https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`}
                      className="size-full object-cover"
                      alt=""
                    />
                    <button
                      type="button"
                      onClick={() => togglePreview(song.youtubeId)}
                      aria-label={previewId === song.youtubeId ? "Stop preview" : "Preview song"}
                      className="state-layer absolute inset-0 flex items-center justify-center bg-scrim/50 text-inverse-on-surface outline-none"
                    >
                      {previewId === song.youtubeId ? <X size={20} /> : <Play size={20} />}
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    {editingId === song.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          aria-label="Edit song title"
                          className="h-10 py-0 text-title-small"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="text"
                          onClick={() => handleSaveEdit(song.id)}
                          aria-label="Save title"
                        >
                          <Check size={20} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="truncate text-title-small text-on-surface">{song.title}</h3>
                        <p className="mt-0.5 truncate text-body-small text-on-surface-variant">
                          {song.author} · by {song.submittedBy.slice(0, 6)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  <Button
                    size="icon"
                    variant="outlined"
                    onClick={() => togglePreview(song.youtubeId)}
                    aria-label={previewId === song.youtubeId ? "Stop preview" : "Preview song"}
                    className={previewId === song.youtubeId ? "border-primary text-primary" : ""}
                  >
                    {previewId === song.youtubeId ? <X size={20} /> : <Play size={20} />}
                  </Button>

                  <Button
                    size="icon"
                    variant="success"
                    onClick={() => handleApprove(song.id)}
                    disabled={processingId === song.id}
                    aria-label="Approve song"
                  >
                    {processingId === song.id ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Check size={20} />
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="outlined"
                    onClick={() => handleDelete(song.id)}
                    aria-label="Reject song"
                    className="border-error text-error"
                  >
                    <X size={20} />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {previewId === song.youtubeId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={transitions.fast}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded-m3-md bg-surface-container-high p-4">
                      <PreviewAudioPlayer
                        youtubeId={song.youtubeId}
                        isActive={true}
                        deviceId={isCustomDevice ? selectedDeviceId : "default"}
                        title={song.title}
                        author={song.author}
                      />
                      <p className="mt-3 text-center text-label-medium text-on-surface-variant">
                        Private preview:{" "}
                        {isCustomDevice
                          ? "routed to selected device"
                          : "plays through default speakers"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          ))}
        </AnimatePresence>

        {pendingQueue.length === 0 && (
          <div className="flex flex-col items-center rounded-m3-xl bg-surface-container px-6 py-16 text-center">
            <Logo size={64} className="mb-5" />
            <p className="text-title-medium text-on-surface-variant">Your queue is empty</p>
          </div>
        )}
      </div>
    </section>
  );
}
