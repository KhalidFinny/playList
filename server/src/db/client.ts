import postgres from "postgres";
import { metrics } from "../lib/metrics";

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is missing!");
} else {
  try {
    const url = new URL(connectionString);
    console.log(`🐘 Initializing Postgres client for host: ${url.hostname}...`);
    console.log(`📡 Connection String Length: ${connectionString.length}`);
  } catch (e) {
    console.error("❌ Invalid DATABASE_URL format.");
  }
}

// We use neon postgres. Default options are fine.
const rawSql = postgres(connectionString || "", {
  ssl: connectionString?.includes("localhost") || 
       connectionString?.includes("127.0.0.1") || 
       connectionString?.includes("@postgres") || 
       connectionString?.includes("sslmode=disable") ? false : "require",
  max: 10,
  connect_timeout: 45, // Increased timeout for Neon cold-starts (45s)
  idle_timeout: 20,    // Close idle connections after 20s
  onnotice: (notice) => console.log("Postgres Notice:", notice.message),
});

/**
 * `sql` with per-query accounting.
 *
 * D1 and Durable Object SQLite bill **rows**, not queries, so one unindexed
 * SELECT is the whole risk. Wrapping the tagged template covers every call site
 * without editing them.
 *
 * Caveat, and it matters for the Cloudflare projection: the number recorded is
 * rows **returned** (or affected, for a write), which is a lower bound on rows
 * **scanned**. A full table scan that filters down to 3 rows reports 3.
 */
export const sql = new Proxy(rawSql, {
  apply(target, thisArg, args: unknown[]) {
    const startedAt = performance.now();
    const pending = Reflect.apply(target, thisArg, args) as Promise<unknown[]> & { count?: number };

    const originalThen = pending.then.bind(pending);
    pending.then = function <TResult1 = unknown[], TResult2 = never>(
      onFulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return originalThen(
        (rows: unknown[]) => {
          // Counting must never change the result or break the chain.
          try {
            const isWrite = typeof pending.count === "number";
            const n = isWrite ? (pending.count as number) : Array.isArray(rows) ? rows.length : 0;
            if (isWrite) metrics.rowsWritten(n);
            else metrics.rowsRead(n);
            metrics.count("db.queries");
            metrics.observe("db.query_ms", performance.now() - startedAt);
          } catch {
            /* metrics are best-effort */
          }
          return onFulfilled ? onFulfilled(rows) : (rows as unknown as TResult1);
        },
        onRejected,
      ) as Promise<TResult1 | TResult2>;
    };

    return pending;
  },
}) as unknown as typeof rawSql;
