/**
 * In-process metrics.
 *
 * Dependency-free on purpose: this is a small Bun server, and the budget is one
 * file. Every method is a `Map` increment on the hot path — no allocation, no
 * string building — because instrumentation that costs more than it measures is
 * worse than none. `snapshot()` is the only method that builds anything, and it
 * only runs when the endpoint is scraped.
 *
 * Buckets are tuned to this app rather than to a generic histogram: the
 * Cloudflare Workers free plan allows 10 ms of CPU per request, so the low
 * buckets are the ones that decide whether we fit.
 */
const BUCKET_EDGES_MS = [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];

type Histogram = {
  /** One count per bucket, plus a final overflow slot. */
  counts: number[];
  sum: number;
  count: number;
  max: number;
};

export type MetricsSnapshot = {
  uptimeMs: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  rows: { read: number; written: number };
  histograms: Record<string, { count: number; sum: number; max: number; p50: number; p95: number; buckets: Record<string, number> }>;
};

const counters = new Map<string, number>();
const histograms = new Map<string, Histogram>();
const gauges = new Map<string, number>();
const rows = { read: 0, written: 0 };
const startedAt = Date.now();

function bucketIndex(ms: number): number {
  for (let i = 0; i < BUCKET_EDGES_MS.length; i++) {
    const edge = BUCKET_EDGES_MS[i];
    if (edge !== undefined && ms <= edge) return i;
  }
  return BUCKET_EDGES_MS.length;
}

/** Nearest-rank percentile from cumulative bucket counts. */
function percentile(h: Histogram, p: number): number {
  const target = h.count * p;
  let seen = 0;
  for (let i = 0; i < h.counts.length; i++) {
    seen += h.counts[i] ?? 0;
    if (seen >= target) {
      const edge = BUCKET_EDGES_MS[i];
      return edge ?? h.max;
    }
  }
  return h.max;
}

export const metrics = {
  count(name: string, by = 1): void {
    counters.set(name, (counters.get(name) ?? 0) + by);
  },

  observe(name: string, ms: number): void {
    let h = histograms.get(name);
    if (!h) {
      h = { counts: new Array(BUCKET_EDGES_MS.length + 1).fill(0), sum: 0, count: 0, max: 0 };
      histograms.set(name, h);
    }
    const idx = bucketIndex(ms);
    h.counts[idx] = (h.counts[idx] ?? 0) + 1;
    h.sum += ms;
    h.count++;
    if (ms > h.max) h.max = ms;
  },

  gauge(name: string, value: number): void {
    gauges.set(name, value);
  },

  rowsRead(n: number): void {
    rows.read += n;
  },

  rowsWritten(n: number): void {
    rows.written += n;
  },

  snapshot(): MetricsSnapshot {
    const hist: MetricsSnapshot["histograms"] = {};
    for (const [name, h] of histograms) {
      const buckets: Record<string, number> = {};
      let cumulative = 0;
      for (let i = 0; i < h.counts.length; i++) {
        cumulative += h.counts[i] ?? 0;
        const label = i < BUCKET_EDGES_MS.length ? `le_${BUCKET_EDGES_MS[i]}ms` : "overflow";
        buckets[label] = cumulative;
      }
      hist[name] = {
        count: h.count,
        sum: Number(h.sum.toFixed(1)),
        max: Number(h.max.toFixed(1)),
        p50: percentile(h, 0.5),
        p95: percentile(h, 0.95),
        buckets,
      };
    }
    return {
      uptimeMs: Date.now() - startedAt,
      counters: Object.fromEntries(counters),
      gauges: Object.fromEntries(gauges),
      rows: { ...rows },
      histograms: hist,
    };
  },

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const [name, value] of counters) {
      lines.push(`${name.replace(/[^a-zA-Z0-9_]/g, "_")} ${value}`);
    }
    for (const [name, value] of gauges) {
      lines.push(`${name.replace(/[^a-zA-Z0-9_]/g, "_")} ${value}`);
    }
    lines.push(`db_rows_read ${rows.read}`);
    lines.push(`db_rows_written ${rows.written}`);
    for (const [name, h] of histograms) {
      const key = name.replace(/[^a-zA-Z0-9_]/g, "_");
      let cumulative = 0;
      for (let i = 0; i < h.counts.length; i++) {
        cumulative += h.counts[i] ?? 0;
        const le = i < BUCKET_EDGES_MS.length ? BUCKET_EDGES_MS[i] : "+Inf";
        lines.push(`${key}_bucket{le="${le}"} ${cumulative}`);
      }
      lines.push(`${key}_count ${h.count}`);
      lines.push(`${key}_sum ${h.sum.toFixed(1)}`);
    }
    return lines.join("\n") + "\n";
  },
};

/**
 * Times an async call and records it, without changing what it returns or
 * swallowing its errors. Used at the HTTP and socket boundaries.
 */
export async function timed<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    metrics.observe(name, performance.now() - start);
  }
}
