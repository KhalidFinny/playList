import { assign, setup } from "xstate";

export type PlayerDeck = "A" | "B";

type PlaybackContext = {
  activePlayer: PlayerDeck;
  currentTime: number;
  duration: number;
  lastSync: { currentTime: number; duration: number; isPlaying: boolean };
  error: string | null;
};

type PlaybackEvent =
  | { type: "PLAYER_READY" }
  | { type: "TRACK_LOADED" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK"; currentTime: number }
  | { type: "TRACK_ENDED" }
  | { type: "NEXT_REQUESTED" }
  | { type: "NEXT_RESOLVED"; activePlayer?: PlayerDeck }
  | { type: "NEXT_FAILED"; error: string }
  | { type: "PREVIOUS_REQUESTED" }
  | { type: "PREVIOUS_RESOLVED" }
  | { type: "PREVIOUS_FAILED"; error: string }
  | { type: "SYNC_TICK"; currentTime: number; duration: number; isPlaying: boolean }
  | { type: "PLAYER_ERROR"; error: string };

export const playbackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent,
  },
  actions: {
    setSync: assign(({ event }) =>
      event.type === "SYNC_TICK"
        ? {
            currentTime: event.currentTime,
            duration: event.duration,
            lastSync: {
              currentTime: event.currentTime,
              duration: event.duration,
              isPlaying: event.isPlaying,
            },
          }
        : {},
    ),
    setActivePlayer: assign(({ context, event }) =>
      event.type === "NEXT_RESOLVED" && event.activePlayer
        ? { activePlayer: event.activePlayer }
        : { activePlayer: context.activePlayer === "A" ? "B" : "A" },
    ),
    setError: assign(({ event }) =>
      event.type === "NEXT_FAILED" ||
      event.type === "PREVIOUS_FAILED" ||
      event.type === "PLAYER_ERROR"
        ? { error: event.error }
        : {},
    ),
    clearError: assign({ error: null }),
  },
}).createMachine({
  id: "playback",
  initial: "idle",
  context: {
    activePlayer: "A",
    currentTime: 0,
    duration: 0,
    lastSync: { currentTime: 0, duration: 0, isPlaying: false },
    error: null,
  },
  on: {
    SYNC_TICK: { actions: "setSync" },
    PLAYER_ERROR: { target: ".error", actions: "setError" },
  },
  states: {
    idle: { on: { TRACK_LOADED: "ready", PLAYER_READY: "ready" } },
    loading: { on: { TRACK_LOADED: "ready" } },
    ready: {
      on: {
        PLAY: { target: "playing", actions: "clearError" },
        PAUSE: "paused",
        TRACK_ENDED: "transitioning",
        NEXT_REQUESTED: "transitioning",
        PREVIOUS_REQUESTED: "previousLoading",
      },
    },
    playing: {
      on: {
        PAUSE: "paused",
        TRACK_ENDED: "transitioning",
        NEXT_REQUESTED: "transitioning",
        PREVIOUS_REQUESTED: "previousLoading",
      },
    },
    paused: {
      on: {
        PLAY: "playing",
        NEXT_REQUESTED: "transitioning",
        PREVIOUS_REQUESTED: "previousLoading",
      },
    },
    transitioning: {
      on: {
        TRACK_LOADED: { target: "playing", actions: "clearError" },
        NEXT_RESOLVED: { target: "playing", actions: ["setActivePlayer", "clearError"] },
        NEXT_FAILED: { target: "error", actions: "setError" },
      },
    },
    previousLoading: {
      on: {
        PREVIOUS_RESOLVED: { target: "playing", actions: "clearError" },
        PREVIOUS_FAILED: { target: "error", actions: "setError" },
      },
    },
    error: {
      on: {
        PLAY: { target: "playing", actions: "clearError" },
        TRACK_LOADED: { target: "ready", actions: "clearError" },
        TRACK_ENDED: "transitioning",
        NEXT_REQUESTED: "transitioning",
        PREVIOUS_REQUESTED: "previousLoading",
      },
    },
  },
});
