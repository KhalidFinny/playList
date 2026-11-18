import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Modal } from "./Modal";
import { Chip } from "./chip";
import { Button } from "./button";
import { cn } from "@/shared/lib/utils";
import { EQ_BANDS_HZ, EQ_PRESETS, EQ_RANGE_DB, useAudioStore } from "@/stores/audioStore";

/** 60 Hz and 12 kHz are unreadable at a glance; these are the same bands. */
const BAND_LABELS = ["60", "150", "400", "1k", "2.4k", "6k", "12k"];

/**
 * The sound panel: volume matching and the equalizer.
 *
 * Both settings are per device, not per room: the host's speaker and a
 * participant's headphones are different hardware, so one shared setting would
 * be wrong for one of them. Nothing here is sent to the server.
 *
 * The equalizer is off by default. Turning it on attaches the audio graph, which
 * is the only way to boost a quiet track or shape the tone, but it is also the
 * one change that can interfere with background playback on a phone, so it is a
 * deliberate choice rather than something the app does behind the listener.
 */
export function SoundSettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const eqEnabled = useAudioStore((state) => state.eqEnabled);
  const preset = useAudioStore((state) => state.preset);
  const gains = useAudioStore((state) => state.gains);
  const normalize = useAudioStore((state) => state.normalize);
  const setPreset = useAudioStore((state) => state.setPreset);
  const setBand = useAudioStore((state) => state.setBand);
  const setEqEnabled = useAudioStore((state) => state.setEqEnabled);
  const setNormalize = useAudioStore((state) => state.setNormalize);
  const reset = useAudioStore((state) => state.reset);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sound settings"
        title="Sound settings"
        className={cn(
          "state-layer flex size-10 shrink-0 items-center justify-center rounded-m3-full outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          eqEnabled ? "bg-primary text-on-primary" : "text-on-surface-variant",
          className,
        )}
      >
        <SlidersHorizontal size={20} />
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Sound" maxWidth="max-w-lg">
        <div className="flex flex-col gap-6">
          <label className="flex items-center justify-between gap-4">
            <span className="flex flex-col">
              <span className="text-title-small">Match volume</span>
              <span className="mt-0.5 text-body-small text-on-surface-variant">
                Every track at the same level
              </span>
            </span>
            <input
              type="checkbox"
              checked={normalize}
              onChange={(event) => setNormalize(event.target.checked)}
              className="size-5 accent-primary"
            />
          </label>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-title-small">Equalizer</span>
              <label className="flex items-center gap-2 text-body-small text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={eqEnabled}
                  onChange={(event) => setEqEnabled(event.target.checked)}
                  className="size-5 accent-primary"
                />
                On
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {EQ_PRESETS.map((entry) => (
                <Chip
                  key={entry.id}
                  selected={preset === entry.id && eqEnabled}
                  onClick={() => {
                    setPreset(entry.id);
                    setEqEnabled(true);
                  }}
                >
                  {entry.label}
                </Chip>
              ))}
            </div>

            <div
              className={cn(
                "flex items-end justify-between gap-1 rounded-m3-md bg-surface-container p-4",
                !eqEnabled && "opacity-38",
              )}
            >
              {EQ_BANDS_HZ.map((frequency, index) => (
                <div key={frequency} className="flex flex-col items-center gap-2">
                  <span className="text-label-small tabular-nums text-on-surface-variant">
                    {gains[index] > 0 ? `+${gains[index]}` : gains[index]}
                  </span>
                  <input
                    type="range"
                    min={-EQ_RANGE_DB}
                    max={EQ_RANGE_DB}
                    step={1}
                    value={gains[index]}
                    disabled={!eqEnabled}
                    onChange={(event) => setBand(index, Number(event.target.value))}
                    aria-label={`${BAND_LABELS[index]} hertz`}
                    className="eq-slider"
                  />
                  <span className="text-label-small text-on-surface-variant">
                    {BAND_LABELS[index]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="text" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
