import { useRoomStore } from "@/stores/roomStore";
import { useListenStore } from "@/stores/listenStore";
import type { Track } from "@/shared/types";

/**
 * Plays the room's broadcast on this device, so a participant can plug
 * headphones into their own laptop instead of relying on the venue speaker.
 *
 * A module singleton rather than a component: the room page and the request
 * page each unmount on navigation, and playback must not stop when the
 * participant moves between them. `socket.ts` is the same shape.
 *
 * Position comes from the `playback_sync` the server already relays to every
 * participant. `syncedAt` is stamped locally on receipt, so the anchor never
 * has to agree with the server's clock; between syncs the position is
 * extrapolated from it.
 */

// Audible drift below this is not worth a seek, which would be a glitch.
const DRIFT_TOLERANCE_S = 1;
const DRIFT_CHECK_MS = 2000;

let audio: HTMLAudioElement | null = null;
let unsubscribe: (() => void) | null = null;
let driftTimer: ReturnType<typeof setInterval> | null = null;
let loadedTrackId: string | null = null;
let appliedPlaying: boolean | null = null;
let ready = false;
// Bumped on every load and teardown so a slow load cannot write to a newer one.
let generation = 0;
// Settles a `canplay` wait that teardown would otherwise leave hanging.
let abortLoad: (() => void) | null = null;

/** Where the broadcast is now, extrapolated from the last sync. */
function expectedPosition(): number {
  const { currentTime, duration, isPlaying, syncedAt } = useRoomStore.getState();
  // `syncedAt === 0` means no position has arrived yet, so there is nothing to
  // extrapolate from and the track should start at the top.
  const elapsed = isPlaying && syncedAt > 0 ? (Date.now() - syncedAt) / 1000 : 0;
  const position = Math.max(0, currentTime + elapsed);
  return duration > 0 ? Math.min(position, duration) : position;
}

function waitForCanPlay(element: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const settle = () => {
      element.removeEventListener("canplay", onCanPlay);
      element.removeEventListener("error", onError);
      if (abortLoad === abort) abortLoad = null;
    };
    const abort = () => {
      settle();
      reject(new Error("Load cancelled"));
    };
    const onCanPlay = () => {
      settle();
      resolve();
    };
    const onError = () => {
      settle();
      reject(new Error("Audio is unavailable for this track"));
    };
    abortLoad = abort;
    element.addEventListener("canplay", onCanPlay);
    element.addEventListener("error", onError);
  });
}

async function startPlayback(element: HTMLAudioElement): Promise<void> {
  if (!ready) return;
  try {
    await element.play();
    useListenStore.getState().setPhase("ready");
  } catch {
    // Autoplay policy: the enabling click grants playback for the document, but
    // a reload or a new tab can still refuse.
    useListenStore.getState().setPhase("error", "Playback was blocked. Tap to try again.");
  }
}

async function loadTrack(element: HTMLAudioElement, track: Track): Promise<void> {
  const token = ++generation;
  ready = false;
  useListenStore.getState().setPhase("loading");

  try {
    const res = await fetch(`/api/preview/${track.youtubeId}`);
    if (!res.ok) throw new Error("Audio is unavailable for this track");
    const { url } = (await res.json()) as { url: string };
    if (token !== generation) return;

    element.src = url;
    await waitForCanPlay(element);
    if (token !== generation) return;

    // Seek before playing, so it never starts from the top and jumps.
    element.currentTime = expectedPosition();
    ready = true;

    const { isPlaying } = useRoomStore.getState();
    appliedPlaying = isPlaying;
    if (isPlaying) await startPlayback(element);
    else useListenStore.getState().setPhase("ready");
  } catch (err) {
    if (token !== generation) return;
    fail(err instanceof Error ? err.message : "Audio is unavailable for this track");
  }
}

/** Reads the broadcast and brings the element in line with it. */
function syncFromStore(): void {
  const element = audio;
  if (!element) return;

  const { nowPlaying, isPlaying } = useRoomStore.getState();
  const trackId = nowPlaying?.id ?? null;

  if (trackId !== loadedTrackId) {
    loadedTrackId = trackId;
    appliedPlaying = null;
    ready = false;
    if (nowPlaying) void loadTrack(element, nowPlaying);
    else {
      element.pause();
      useListenStore.getState().setPhase("idle");
    }
    return;
  }

  if (!trackId || isPlaying === appliedPlaying) return;

  appliedPlaying = isPlaying;
  if (isPlaying) void startPlayback(element);
  else element.pause();
}

/** A safety net for gross error — a stalled player or a suspended tab. */
function correctDrift(): void {
  const element = audio;
  if (!element || !ready || !useRoomStore.getState().isPlaying) return;

  const target = expectedPosition();
  if (Math.abs(element.currentTime - target) > DRIFT_TOLERANCE_S) {
    element.currentTime = target;
  }
}

function teardown(): void {
  generation += 1;

  abortLoad?.();
  abortLoad = null;

  if (driftTimer !== null) {
    clearInterval(driftTimer);
    driftTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;

  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio = null;
  }

  loadedTrackId = null;
  appliedPlaying = null;
  ready = false;
}

function fail(message: string): void {
  teardown();
  const store = useListenStore.getState();
  store.setEnabled(false);
  store.setPhase("error", message);
}

export function startLocalListener(): void {
  if (audio) return;

  const element = new Audio();
  element.preload = "auto";
  audio = element;

  const store = useListenStore.getState();
  store.setEnabled(true);
  store.setPhase("loading");

  unsubscribe = useRoomStore.subscribe(syncFromStore);
  driftTimer = setInterval(correctDrift, DRIFT_CHECK_MS);
  syncFromStore();
}

export function stopLocalListener(): void {
  if (!audio) return;
  teardown();
  const store = useListenStore.getState();
  store.setEnabled(false);
  store.setPhase("idle");
}
