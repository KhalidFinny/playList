import { EQ_BANDS_HZ, useAudioStore } from "@/stores/audioStore";

/**
 * The shared audio chain: normalization gain, then the equalizer, then a limiter.
 *
 * A media element's `volume` cannot exceed 1, so lifting a quiet track or shaping
 * it with filters needs a Web Audio graph. That has a cost: once an element's
 * output is routed into a graph, the graph's `AudioContext` has to be running or
 * the element is silent. A backgrounded or screen-locked page can suspend it, and
 * a suspended context is the one thing that would break the "keep playing with the
 * screen off" requirement.
 *
 * So the graph is **opt-in and lazy**: while the equalizer is off and a track only
 * needs turning down, the element keeps its plain `volume` path, which is the
 * configuration that is known to survive backgrounding. Turning the equalizer on
 * is what attaches the element, and from then on every play, every visibility
 * change and every context `statechange` tries to resume the context.
 */

type Chain = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  filters: BiquadFilterNode[];
};

const chains = new WeakMap<HTMLAudioElement, Chain>();
// A gain applied before the graph existed still has to land on it when the
// listener turns the equalizer on mid-track.
const gains = new WeakMap<HTMLAudioElement, number>();
let context: AudioContext | null = null;

function contextOf(): AudioContext | null {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** Browsers suspend the context on backgrounding; every entry point retries. */
export function resumeAudio(): void {
  if (!context || context.state === "running") return;
  void context.resume().catch(() => {});
}

function build(element: HTMLAudioElement): Chain | null {
  const ctx = contextOf();
  if (!ctx) return null;

  const source = ctx.createMediaElementSource(element);
  const gain = ctx.createGain();

  const filters = EQ_BANDS_HZ.map((frequency) => {
    const filter = ctx.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = 1.1;
    filter.gain.value = 0;
    return filter;
  });

  // A compressor with a hard ratio and a high threshold behaves as a safety
  // limiter: it only engages on the peaks a boosted band would otherwise clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  source.connect(gain);
  let node: AudioNode = gain;
  for (const filter of filters) {
    node.connect(filter);
    node = filter;
  }
  node.connect(limiter).connect(ctx.destination);

  gain.gain.value = gains.get(element) ?? 1;

  const chain = { context: ctx, source, gain, filters };
  chains.set(element, chain);
  return chain;
}

/** Attaches the graph to an element, once. Safe to call on every play. */
export function attachElement(element: HTMLAudioElement): void {
  if (chains.has(element)) {
    resumeAudio();
    return;
  }
  const chain = build(element);
  if (!chain) return;
  applyEqualizer();
  resumeAudio();
}

/**
 * Applies a normalization multiplier. Before the graph exists this is the
 * element's `volume`, which cannot exceed 1; afterwards it is the gain node, so a
 * quiet track can be lifted (the limiter catches the peaks).
 */
export function applyGain(element: HTMLAudioElement, gain: number): void {
  gains.set(element, gain);
  const chain = chains.get(element);
  if (chain) {
    chain.gain.gain.value = gain;
    element.volume = 1;
    return;
  }
  element.volume = Math.min(1, gain);
}

/** Pushes the current band values into every attached chain. */
export function applyEqualizer(): void {
  const { eqEnabled, gains: bands } = useAudioStore.getState();
  for (const chain of allChains()) {
    chain.filters.forEach((filter, index) => {
      filter.gain.value = eqEnabled ? (bands[index] ?? 0) : 0;
    });
  }
}

// `WeakMap` cannot be iterated, so attached elements are also tracked here. The
// list only ever holds the one or two elements a page creates.
const attached: HTMLAudioElement[] = [];

function allChains(): Chain[] {
  return attached.flatMap((element) => {
    const chain = chains.get(element);
    return chain ? [chain] : [];
  });
}

/**
 * Keeps one element in step with the settings, for the lifetime of that element.
 * Returns the unsubscribe. Equalizer changes are rare, so this is a plain
 * subscription rather than a React effect.
 */
export function watchAudioSettings(element: HTMLAudioElement): () => void {
  // The registry `applyEqualizer` walks. Without this the graph is built and then
  // left at 0 dB on every band, which is a silent equalizer.
  if (!attached.includes(element)) attached.push(element);

  const apply = () => {
    const { eqEnabled, gains } = useAudioStore.getState();
    if (eqEnabled && gains.some((gain) => gain !== 0)) attachElement(element);
    applyEqualizer();
  };

  element.addEventListener("play", resumeAudio);
  document.addEventListener("visibilitychange", resumeAudio);
  apply();

  const unsubscribe = useAudioStore.subscribe(apply);
  return () => {
    unsubscribe();
    element.removeEventListener("play", resumeAudio);
    document.removeEventListener("visibilitychange", resumeAudio);
    const index = attached.indexOf(element);
    if (index >= 0) attached.splice(index, 1);
  };
}
