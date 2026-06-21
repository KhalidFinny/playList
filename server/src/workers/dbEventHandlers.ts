import { Effect } from "effect";
import { sql } from "../db/client";
import type { DbEvent } from "./types";
import { beginEvent, finishEvent } from "./dbEventStore";

const payloadOf = (event: DbEvent): Record<string, any> =>
  event.payload && typeof event.payload === "object" ? (event.payload as Record<string, any>) : {};

const songIdOf = (event: DbEvent) => {
  if (!event.songId) throw new Error(`${event.type} missing songId`);
  return event.songId;
};

const persistByType = async (event: DbEvent) => {
  const payload = payloadOf(event);

  switch (event.type) {
    case "room_created":
      await sql`
        INSERT INTO rooms (id, passkey, owner_id)
        VALUES (${event.roomId}, ${payload.passkey ?? null}, ${payload.ownerId ?? null})
        ON CONFLICT (id) DO UPDATE
        SET passkey = COALESCE(EXCLUDED.passkey, rooms.passkey),
            owner_id = COALESCE(EXCLUDED.owner_id, rooms.owner_id)
      `;
      return;

    case "song_submitted":
      await sql`
        INSERT INTO songs (id, room_id, youtube_id, title, author, status, submitted_by, created_at)
        VALUES (${songIdOf(event)}, ${event.roomId}, ${payload.youtubeId}, ${payload.title}, ${payload.author ?? ""}, 'pending', ${payload.submittedBy}, COALESCE(${payload.createdAt ? new Date(payload.createdAt) : null}, NOW()))
        ON CONFLICT (id) DO NOTHING
      `;
      return;

    case "song_added":
      await sql`
        INSERT INTO songs (id, room_id, youtube_id, title, author, status, submitted_by, created_at, approved_at)
        VALUES (${songIdOf(event)}, ${event.roomId}, ${payload.youtubeId}, ${payload.title}, ${payload.author ?? ""}, 'approved', ${payload.submittedBy}, COALESCE(${payload.createdAt ? new Date(payload.createdAt) : null}, NOW()), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      return;

    case "song_approved":
      await sql`
        UPDATE songs
        SET status = 'approved', approved_at = COALESCE(${payload.approvedAt ? new Date(payload.approvedAt) : null}, NOW())
        WHERE id = ${songIdOf(event)} AND room_id = ${event.roomId}
      `;
      return;

    case "song_deleted":
      await sql`DELETE FROM songs WHERE id = ${songIdOf(event)} AND room_id = ${event.roomId}`;
      return;

    case "song_updated":
      await sql`
        UPDATE songs
        SET title = COALESCE(${payload.title ?? null}, title),
            author = COALESCE(${payload.author ?? null}, author)
        WHERE id = ${songIdOf(event)} AND room_id = ${event.roomId}
      `;
      return;

    case "track_transitioned":
      if (payload.oldTrackId) {
        await sql`
          UPDATE songs
          SET status = 'done', done_at = COALESCE(${payload.transitionedAt ? new Date(payload.transitionedAt) : null}, NOW())
          WHERE id = ${payload.oldTrackId} AND room_id = ${event.roomId}
        `;
      }

      if (payload.nextTrackId) {
        await sql`
          UPDATE songs
          SET status = 'playing'
          WHERE id = ${payload.nextTrackId} AND room_id = ${event.roomId}
        `;
      }
      return;

    case "track_previous":
      if (payload.currentTrackId) {
        await sql`
          UPDATE songs
          SET status = 'approved', approved_at = NOW()
          WHERE id = ${payload.currentTrackId} AND room_id = ${event.roomId}
        `;
      }

      if (payload.previousTrackId) {
        await sql`
          UPDATE songs
          SET status = 'playing', done_at = NULL
          WHERE id = ${payload.previousTrackId} AND room_id = ${event.roomId}
        `;
      }
      return;

    case "queue_cleared":
      await sql`
        UPDATE songs
        SET status = 'done', done_at = NOW()
        WHERE room_id = ${event.roomId} AND status IN ('pending', 'approved')
      `;
      return;

    case "playback_synced_optional":
      return;
  }
};

export const persistEvent = (event: DbEvent) =>
  Effect.gen(function* () {
    const shouldProcess = yield* beginEvent(event);
    if (!shouldProcess) {
      yield* Effect.log("Skipping already-seen DB event", { eventId: event.eventId, type: event.type });
      return;
    }

    yield* Effect.log("Persisting DB event", { eventId: event.eventId, type: event.type, roomId: event.roomId });
    yield* Effect.promise(() => persistByType(event));
    yield* finishEvent(event);
  });
