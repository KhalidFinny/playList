/**
 * Loudness normalization, in the spirit of Meiro's `playbackVolume`.
 *
 * YouTube already measures every track and returns the result with the player
 * response (`trackAbsoluteLoudnessLkfs`), so the resolver in
 * `server/src/services/preview/innertube.ts` forwards it and nothing has to be
 * decoded. That value is per track, which is what makes a loud music video and a
 * quietly mastered art track land at the same level.
 *
 * The local measurement below is the fallback for the tracks where the field is
 * absent: an EBU R128-ish K-weighting chain over a slice of the stream, then the
 * mean square of the result. It costs one range request instead of decoding the
 * whole song on a phone.
 */

/** Streaming targets land around -14 LUFS; streaming services do the same. */
const TARGET_LUFS = -14;

/** Roughly 30s at the bitrates YouTube serves: enough bytes for a stable mean. */
const SAMPLE_BYTES = 900_000;

/** Fetched slices are decoded once per track and never again. */
const CACHE_KEY = "playlist.loudness.v1";

type Cache = Record<string, number | null>;

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Cache;
  } catch {
    return {};
  }
}

function writeCache(videoId: string, value: number | null) {
  try {
    const cache = readCache();
    cache[videoId] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode or a full quota: normalization simply recomputes next time.
  }
}

/** Mean square of a rendered buffer, as LUFS relative to full scale. */
function loudnessOf(buffer: AudioBuffer): number {
  let sum = 0;
  let count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
      count++;
    }
  }
  if (count === 0 || sum === 0) return -Infinity;
  return -0.691 + 10 * Math.log10(sum / count);
}

/**
 * Measure a track's loudness from its stream URL, or `null` when the browser
 * cannot decode the format (older Safari on WebM, for instance). `null` means
 * "no correction", never "silence".
 */
export async function measureLoudness(streamUrl: string): Promise<number | null> {
  const response = await fetch(streamUrl, { headers: { Range: `bytes=0-${SAMPLE_BYTES}` } });
  if (!response.ok && response.status !== 206) return null;

  const bytes = await response.arrayBuffer();
  // A short slice cannot be decoded on its own; wait for a real body.
  if (bytes.byteLength < 64_000) return null;

  const AudioContextCtor =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!AudioContextCtor) return null;

  let decoded: AudioBuffer;
  try {
    const probe = new AudioContextCtor(1, 1, 44_100);
    decoded = await probe.decodeAudioData(bytes.slice(0));
  } catch {
    return null;
  }
  if (!decoded || decoded.duration < 1) return null;

  // K-weighting, approximated with the two stages R128 specifies: a high-pass at
  // 60 Hz, then a high shelf that lifts the presence region where the ear is most
  // sensitive. Two biquads is all a "which track is louder" decision needs.
  const length = Math.min(decoded.length, Math.floor(decoded.sampleRate * 30));
  const offline = new AudioContextCtor(decoded.numberOfChannels, length, decoded.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;

  const highPass = offline.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 60;

  const shelf = offline.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 1_500;
  shelf.gain.value = 4;

  source.connect(highPass).connect(shelf).connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  return loudnessOf(rendered);
}

/**
 * The volume multiplier for a track. `null` loudness means no correction.
 *
 * The upper bound is +6 dB rather than unity: a quiet track is lifted once the
 * Web Audio chain exists, and the limiter downstream catches the peaks. On the
 * plain element path `applyGain` clamps the result back to 1, so an old browser
 * just hears the track unmodified rather than clipping it.
 */
export function normalizeGain(loudness: number | null | undefined): number {
  if (loudness === null || loudness === undefined || !Number.isFinite(loudness)) return 1;
  const gain = 10 ** ((TARGET_LUFS - loudness) / 20);
  return Math.min(2, Math.max(0.2, gain));
}

/**
 * The loudness to normalize against: the value the server read from YouTube when
 * it resolved the stream, else a local measurement, else `null`.
 */
export async function resolveLoudness(
  videoId: string,
  streamUrl: string,
  reported: number | null | undefined,
): Promise<number | null> {
  if (typeof reported === "number" && Number.isFinite(reported)) return reported;
  return loudnessFor(videoId, streamUrl);
}

/** Looks a track up in the cache, measuring and remembering it on a miss. */
export async function loudnessFor(videoId: string, streamUrl: string): Promise<number | null> {
  const cache = readCache();
  if (videoId in cache) return cache[videoId];

  const measured = await measureLoudness(streamUrl).catch(() => null);
  writeCache(videoId, measured);
  return measured;
}
