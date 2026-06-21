export type DbEventType =
  | "room_created"
  | "song_submitted"
  | "song_added"
  | "song_approved"
  | "song_deleted"
  | "song_updated"
  | "track_transitioned"
  | "track_previous"
  | "queue_cleared"
  | "playback_synced_optional";

export type DbEvent = {
  eventId: string;
  type: DbEventType;
  roomId: string;
  songId?: string;
  payload: unknown;
  createdAt: number;
  attempts?: number;
};

export type StreamMessage = {
  messageId: string;
  event: DbEvent;
};

const defaultDbEventStream = process.env.NODE_ENV === "test" ? "db-events:test" : "db-events";

export const DB_EVENT_STREAM = process.env.DB_EVENT_STREAM ?? defaultDbEventStream;
export const DB_EVENT_DLQ_STREAM = process.env.DB_EVENT_DLQ_STREAM ?? `${DB_EVENT_STREAM}:dlq`;
export const DB_EVENT_GROUP = process.env.DB_EVENT_GROUP ?? "db-persistence-workers";
export const DB_EVENT_CONSUMER = `server-${process.pid}`;

export const DB_EVENT_MAX_ATTEMPTS = 5;
export const DB_EVENT_BATCH_SIZE = 20;
export const DB_EVENT_BLOCK_MS = 5_000;
export const DB_EVENT_PENDING_IDLE_MS = 30_000;

export const makeDbEvent = (
  input: Omit<DbEvent, "eventId" | "createdAt"> & { eventId?: string; createdAt?: number },
): DbEvent => ({
  ...input,
  eventId: input.eventId ?? crypto.randomUUID(),
  createdAt: input.createdAt ?? Date.now(),
});
