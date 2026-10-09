import { Headphones, Loader2 } from "lucide-react";
import { useRoomStore } from "@/stores/roomStore";
import { useListenStore } from "@/stores/listenStore";
import { cn } from "@/shared/lib/utils";
import { startLocalListener, stopLocalListener } from "../lib/localListener";

/**
 * Plays the room's broadcast through this laptop's own audio, so a participant
 * can plug headphones into it instead of relying on the venue speaker.
 *
 * Icon button matching the header's other controls; it fills with `primary`
 * while listening. Inert rather than absent when there is nothing to play, so
 * the header does not reflow.
 */
export function ListenToggle() {
  const enabled = useListenStore((state) => state.enabled);
  const phase = useListenStore((state) => state.phase);
  const error = useListenStore((state) => state.error);
  const hasTrack = useRoomStore((state) => Boolean(state.nowPlaying));

  const label = error ? error : enabled ? "Stop listening on this device" : "Listen on this device";

  return (
    <button
      type="button"
      onClick={() => (enabled ? stopLocalListener() : startLocalListener())}
      disabled={!enabled && !hasTrack}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      className={cn(
        "state-layer flex size-10 shrink-0 items-center justify-center rounded-m3-full outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        enabled ? "bg-primary text-on-primary" : "text-on-surface-variant",
        !enabled && phase === "error" && "text-error",
        !enabled && !hasTrack && "pointer-events-none opacity-38",
      )}
    >
      {phase === "loading" ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <Headphones size={20} />
      )}
    </button>
  );
}
