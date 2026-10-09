/**
 * Runs a k6 scenario against the instrumented load server and diffs the
 * server's own metrics across the run.
 *
 *   bun tests/load/run.ts <vus> <holdMs> <label>
 *
 * Refuses to run unless the target is the load server on :3101 — the production
 * database and the public origin must never be load-tested.
 */
const [, , vusArg = "50", holdArg = "60000", label = "run"] = Bun.argv;
const vus = Number(vusArg);
const holdMs = Number(holdArg);

const LOAD_PORT = 3101;
const METRICS = `http://localhost:${LOAD_PORT}/api/metrics?token=loadtest`;
const ROOM = "DEMO";
const PASSKEY = process.env.LOAD_PASSKEY ?? "94957";
const K6 = `${process.env.HOME}/.local/bin/k6`;

type Snapshot = {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  rows: { read: number; written: number };
  uptimeMs: number;
};

async function scrape(): Promise<Snapshot> {
  const res = await fetch(METRICS);
  if (!res.ok) throw new Error(`metrics scrape failed: ${res.status}`);
  return (await res.json()) as Snapshot;
}

/** Guard: only ever drive the isolated load server. */
async function assertLoadTarget() {
  const res = await fetch(`http://localhost:${LOAD_PORT}/api/metrics?token=loadtest`);
  if (!res.ok) {
    throw new Error(
      `No instrumented load server on :${LOAD_PORT}. Refusing to run — start it with the isolated env first.`,
    );
  }
}

const diff = (before: Snapshot, after: Snapshot) => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(after.counters)) {
    const prev = before.counters[k] ?? 0;
    if (v !== prev) out[k] = v - prev;
  }
  return out;
};

await assertLoadTarget();

console.log(`\n=== ${label} — ${vus} VUs, holding ${holdMs / 1000}s ===`);
const before = await scrape();
console.log(`server uptime before: ${(before.uptimeMs / 1000).toFixed(0)}s`);

const durationS = Math.ceil(holdMs / 1000) + 20;
const proc = Bun.spawn(
  [
    K6,
    "run",
    "--quiet",
    "-e", `VUS=${vus}`,
    "-e", `HOLD_MS=${holdMs}`,
    "-e", `ROOM=${ROOM}`,
    "-e", `PASSKEY=${PASSKEY}`,
    "-e", `DURATION=${durationS}s`,
    "-e", `ACTIVE=${process.env.ACTIVE ?? "0"}`,
    "-e", `ACTIVE_EVERY_MS=${process.env.ACTIVE_EVERY_MS ?? "10000"}`,
    "tests/load/socket.js",
  ],
  { stdout: "pipe", stderr: "pipe" },
);
const stdout = await new Response(proc.stdout).text();
const stderr = await new Response(proc.stderr).text();
await proc.exited;

const after = await scrape();
const elapsedS = (after.uptimeMs - before.uptimeMs) / 1000;

console.log("\n--- k6 summary ---");
const summary = stdout.split("\n").filter((l) => /eio_|checks|iterations|http_req/.test(l));
console.log(summary.length ? summary.join("\n") : "(no summary lines)");
if (proc.exitCode !== 0) console.log("k6 stderr:", stderr.slice(0, 500));

console.log("\n--- server metric delta over the run ---");
const counters = diff(before, after);
for (const key of Object.keys(counters).sort()) {
  console.log(`  ${key}: ${counters[key]}`);
}
console.log(`  (elapsed ${elapsedS.toFixed(1)}s)`);

const packets = counters["ws.inbound_packets"] ?? 0;
const appOnly = Object.entries(counters)
  .filter(([k]) => k.startsWith("socket."))
  .reduce((a, [, v]) => a + v, 0);
const perHour = elapsedS > 0 ? (packets / elapsedS) * 3600 : 0;

console.log("\n--- Cloudflare Durable Object projection ---");
console.log(`  inbound packets:        ${packets}`);
console.log(`  of which app events:    ${appOnly}`);
console.log(`  of which heartbeats:    ${packets - appOnly}`);
console.log(`  measured packets/hour:  ${perHour.toFixed(0)}`);
console.log(`  free DO limit/day:      100000`);
console.log(`  projected/day:          ${(perHour * 24).toFixed(0)}  (${(((perHour * 24) / 100000) * 100).toFixed(1)}% of the limit)`);

await Bun.write(
  `/tmp/load-${label}.json`,
  JSON.stringify({ label, vus, holdMs, elapsedS, counters, before, after }, null, 2),
);
console.log(`\nwrote /tmp/load-${label}.json`);
