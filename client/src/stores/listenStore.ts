import { create } from "zustand";

export type ListenPhase = "idle" | "loading" | "ready" | "error";

type ListenState = {
  /** Whether this device is playing the broadcast locally. */
  enabled: boolean;
  phase: ListenPhase;
  error: string | null;
  setEnabled: (enabled: boolean) => void;
  setPhase: (phase: ListenPhase, error?: string | null) => void;
};

/**
 * UI state for headset mode. A store rather than props because the control is
 * mounted in two headers and the audio engine lives outside React.
 */
export const useListenStore = create<ListenState>((set) => ({
  enabled: false,
  phase: "idle",
  error: null,
  setEnabled: (enabled) => set({ enabled }),
  setPhase: (phase, error = null) => set({ phase, error }),
}));
