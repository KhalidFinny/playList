import { create } from "zustand";

/** Centre frequencies, in Hz, of the seven bands. Spread across the audible range. */
export const EQ_BANDS_HZ = [60, 150, 400, 1000, 2400, 6000, 12000] as const;

/** dB of cut or boost a band allows. Beyond this a biquad starts to ring. */
export const EQ_RANGE_DB = 12;

export type EqPresetId = "flat" | "warm" | "vocal" | "bright" | "night" | "custom";

export type EqPreset = { id: EqPresetId; label: string; gains: number[] };

/**
 * Presets are shaped by what the room actually plays: a lot of bass-heavy
 * electronic and pop, voice-led tracks, and late-night listening where the top
 * end is what carries. "Warm" trims the presence band rather than adding bass,
 * because the room speaker is usually the thing that cannot take more low end.
 */
export const EQ_PRESETS: EqPreset[] = [
  { id: "flat", label: "Flat", gains: [0, 0, 0, 0, 0, 0, 0] },
  { id: "warm", label: "Warm", gains: [4, 3, 1, 0, -1, -2, -3] },
  { id: "vocal", label: "Vocal", gains: [-2, -1, 1, 3, 3, 1, -1] },
  { id: "bright", label: "Bright", gains: [-1, 0, 0, 1, 3, 4, 4] },
  { id: "night", label: "Night", gains: [2, 1, 0, -1, -3, -4, -5] },
];

/** Editing one band leaves the curve matching no preset; the chips show none. */
const PRESET_IDS = new Set<string>(EQ_PRESETS.map((entry) => entry.id));

export type AudioSettings = {
  /** The equalizer is opt-in: until it is on, audio keeps the plain element path. */
  eqEnabled: boolean;
  preset: EqPresetId;
  gains: number[];
  /** Matches every track to the same loudness. On by default. */
  normalize: boolean;
  setEqEnabled: (enabled: boolean) => void;
  setPreset: (preset: EqPresetId) => void;
  setBand: (index: number, gain: number) => void;
  setNormalize: (normalize: boolean) => void;
  reset: () => void;
};

const STORAGE_KEY = "playlist.audio.v1";

type Stored = Pick<AudioSettings, "eqEnabled" | "preset" | "gains" | "normalize">;

const defaults: Stored = {
  eqEnabled: false,
  preset: "flat",
  gains: EQ_PRESETS[0].gains,
  normalize: true,
};

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const gains =
      Array.isArray(parsed.gains) && parsed.gains.length === EQ_BANDS_HZ.length
        ? parsed.gains.map((value) =>
            Math.min(EQ_RANGE_DB, Math.max(-EQ_RANGE_DB, Number(value) || 0)),
          )
        : defaults.gains;
    return {
      eqEnabled: Boolean(parsed.eqEnabled),
      preset:
        PRESET_IDS.has(String(parsed.preset)) || parsed.preset === "custom"
          ? (parsed.preset as EqPresetId)
          : defaults.preset,
      gains,
      normalize: parsed.normalize === undefined ? defaults.normalize : Boolean(parsed.normalize),
    };
  } catch {
    return defaults;
  }
}

function write(state: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode: the settings still apply for this session.
  }
}

const initial = read();

export const useAudioStore = create<AudioSettings>((set, get) => {
  const persist = (patch: Partial<Stored>) => {
    const { eqEnabled, preset, gains, normalize } = get();
    write({ eqEnabled, preset, gains, normalize, ...patch });
  };

  return {
    ...initial,
    setEqEnabled: (eqEnabled) => {
      set({ eqEnabled });
      persist({ eqEnabled });
    },
    setPreset: (preset) => {
      const gains = EQ_PRESETS.find((entry) => entry.id === preset)?.gains ?? defaults.gains;
      set({ preset, gains: [...gains] });
      persist({ preset, gains });
    },
    setBand: (index, gain) => {
      const gains = get().gains.map((value, i) => (i === index ? gain : value));
      const preset: EqPresetId =
        EQ_PRESETS.find((entry) => entry.gains.every((value, i) => value === gains[i]))?.id ??
        "custom";
      set({ gains, preset, eqEnabled: true });
      persist({ gains, preset, eqEnabled: true });
    },
    setNormalize: (normalize) => {
      set({ normalize });
      persist({ normalize });
    },
    reset: () => {
      set({ ...defaults, gains: [...defaults.gains] });
      persist({ ...defaults });
    },
  };
});
