import { sql } from "../db/client";

// Retention for the two tables that grow without bound. The live queue is
// bounded separately (Redis done list + the rebuild query); this handles the
// durable history that nothing else prunes.

const EVENT_LOG_RETENTION_DAYS = 7;
const DONE_SONG_RETENTION_DAYS = 30;
const INTERVAL_MS = 60 * 60 * 1000;

async function pruneOnce(): Promise<void> {
  const events = await sql`
    DELETE FROM db_event_log
    WHERE created_at < NOW() - make_interval(days => ${EVENT_LOG_RETENTION_DAYS})
    RETURNING event_id
  `;

  const songs = await sql`
    DELETE FROM songs
    WHERE status = 'done'
      AND done_at < NOW() - make_interval(days => ${DONE_SONG_RETENTION_DAYS})
    RETURNING id
  `;

  if (events.length > 0 || songs.length > 0) {
    console.log(`[MAINTENANCE] pruned ${events.length} event log row(s), ${songs.length} done song(s)`);
  }
}

// Fire-and-forget: a failed prune must never take the process down.
export function startMaintenance(): void {
  const run = () => {
    pruneOnce().catch((err) => console.error("[MAINTENANCE] prune failed:", err));
  };

  run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref?.();
}
