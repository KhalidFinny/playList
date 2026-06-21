import { readFile } from "node:fs/promises";
import { sql } from "../../db/client";
import { redis } from "../../lib/redis";
import { makeDbEvent } from "../../workers/dbEvents";

const approveSongScript = await readFile(new URL("./scripts/approve.lua", import.meta.url), "utf8");
const deleteSongScript = await readFile(new URL("./scripts/delete.lua", import.meta.url), "utf8");
const previousTrackScript = await readFile(new URL("./scripts/previous.lua", import.meta.url), "utf8");
const transitionNextScript = await readFile(new URL("./scripts/transition.lua", import.meta.url), "utf8");
const updateSongScript = await readFile(new URL("./scripts/update.lua", import.meta.url), "utf8");
const clearQueueScript = await readFile(new URL("./scripts/clear_queue.lua", import.meta.url), "utf8");

export type QueueSong = {
  id: string;
  youtubeId: string;
  title: string;
  author?: string;
  status: "pending" | "approved" | "playing" | "done";
  submittedBy?: string;
  createdAt?: string;
};

const key = {
  pending: (roomId: string) => `room:${roomId}:queue:pending`,
  approved: (roomId: string) => `room:${roomId}:queue:approved`,
  done: (roomId: string) => `room:${roomId}:queue:done`,
  nowPlaying: (roomId: string) => `room:${roomId}:nowPlaying`,
  version: (roomId: string) => `room:${roomId}:version`,
  song: (songId: string) => `song:${songId}`,
  eventStream: () => "db-events",
  transitionId: (roomId: string, idempotencyKey: string) => `room:${roomId}:transition:${idempotencyKey}`,
};

export async function rebuildRoomQueue(roomId: string) {
  const rows = await sql`
    SELECT id, youtube_id as "youtubeId", title, author, status, submitted_by as "submittedBy", created_at as "createdAt"
    FROM songs
    WHERE room_id = ${roomId} AND status IN ('pending', 'approved', 'playing', 'done')
    ORDER BY CASE WHEN status = 'done' THEN done_at END DESC NULLS LAST, approved_at ASC NULLS LAST, created_at ASC
  `;

  const pending: string[] = [];
  const approved: string[] = [];
  let nowPlaying: string | null = null;
  const pipeline = redis.pipeline();

  pipeline.del(key.pending(roomId), key.approved(roomId), key.done(roomId), key.nowPlaying(roomId));

  for (const row of rows as unknown as QueueSong[]) {
    const song = { ...row, author: row.author ?? "", createdAt: row.createdAt ? String(row.createdAt) : undefined };
    pipeline.set(key.song(song.id), JSON.stringify(song));

    if (song.status === "pending") pending.push(song.id);
    if (song.status === "approved") approved.push(song.id);
    if (song.status === "done") pipeline.rpush(key.done(roomId), song.id);
    if (song.status === "playing") nowPlaying = song.id;
  }

  if (pending.length > 0) pipeline.rpush(key.pending(roomId), ...pending);
  if (approved.length > 0) pipeline.rpush(key.approved(roomId), ...approved);
  if (nowPlaying) pipeline.set(key.nowPlaying(roomId), nowPlaying);
  pipeline.incr(key.version(roomId));

  await pipeline.exec();
}

export async function getQueueWindow(roomId: string, role: "participant" | "admin" | "eo", limit = 50) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const pendingIds = role === "admin" ? await redis.lrange(key.pending(roomId), 0, limit - 1) : [];
  const approvedIds = await redis.lrange(key.approved(roomId), 0, limit - 1);
  const songIds = [...pendingIds, ...approvedIds];
  if (songIds.length === 0) return [];

  const songs = await redis.mget(songIds.map(key.song));
  return songs.flatMap((raw) => raw ? [JSON.parse(raw) as QueueSong] : []);
}

export async function getQueuePage(roomId: string, status: "pending" | "approved", cursor = 0, limit = 50) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const safeCursor = Math.max(0, cursor);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const queueKey = status === "pending" ? key.pending(roomId) : key.approved(roomId);
  const [songIds, total] = await Promise.all([
    redis.lrange(queueKey, safeCursor, safeCursor + safeLimit - 1),
    redis.llen(queueKey),
  ]);

  const songs = songIds.length > 0 ? await redis.mget(songIds.map(key.song)) : [];
  const items = songs.flatMap((raw) => raw ? [JSON.parse(raw) as QueueSong] : []);
  const nextCursor = safeCursor + items.length < total ? safeCursor + items.length : null;

  return { items, nextCursor, total };
}

export async function getNowPlaying(roomId: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const songId = await redis.get(key.nowPlaying(roomId));
  if (!songId) return null;

  const raw = await redis.get(key.song(songId));
  return raw ? (JSON.parse(raw) as QueueSong) : null;
}

export async function countPendingSongs(roomId: string, submittedBy?: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const pendingIds = await redis.lrange(key.pending(roomId), 0, -1);
  if (!submittedBy) return pendingIds.length;

  const songs = pendingIds.length > 0 ? await redis.mget(pendingIds.map(key.song)) : [];
  return songs.reduce((count, raw) => {
    if (!raw) return count;
    const song = JSON.parse(raw) as QueueSong;
    return song.submittedBy === submittedBy ? count + 1 : count;
  }, 0);
}

export async function submitSong(roomId: string, song: Omit<QueueSong, "status">) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const pendingSong = { ...song, status: "pending" as const };
  const event = makeDbEvent({
    type: "song_submitted",
    roomId,
    songId: song.id,
    payload: pendingSong,
  });

  await redis
    .multi()
    .set(key.song(song.id), JSON.stringify(pendingSong))
    .rpush(key.pending(roomId), song.id)
    .incr(key.version(roomId))
    .xadd(key.eventStream(), "*", "event", JSON.stringify(event))
    .exec();

  return pendingSong;
}

export async function addApprovedSong(roomId: string, song: Omit<QueueSong, "status">) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const approvedSong = { ...song, status: "approved" as const };
  const event = makeDbEvent({
    type: "song_added",
    roomId,
    songId: song.id,
    payload: approvedSong,
  });

  await redis
    .multi()
    .set(key.song(song.id), JSON.stringify(approvedSong))
    .rpush(key.approved(roomId), song.id)
    .incr(key.version(roomId))
    .xadd(key.eventStream(), "*", "event", JSON.stringify(event))
    .exec();

  return approvedSong;
}

export async function approveSong(roomId: string, songId: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const event = makeDbEvent({ type: "song_approved", roomId, songId, payload: {} });
  const raw = await redis.eval(
    approveSongScript,
    5,
    key.pending(roomId),
    key.approved(roomId),
    key.version(roomId),
    key.eventStream(),
    key.song(songId),
    roomId,
    songId,
    event.eventId,
    event.createdAt,
  );

  return JSON.parse(String(raw)) as
    | { ok: true; song: QueueSong; queueVersion: number }
    | { ok: false; error: "missing_song" | "not_pending" };
}

export async function deleteSong(roomId: string, songId: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const event = makeDbEvent({ type: "song_deleted", roomId, songId, payload: {} });
  const raw = await redis.eval(
    deleteSongScript,
    7,
    key.pending(roomId),
    key.approved(roomId),
    key.done(roomId),
    key.nowPlaying(roomId),
    key.version(roomId),
    key.eventStream(),
    key.song(songId),
    roomId,
    songId,
    event.eventId,
    event.createdAt,
  );

  return JSON.parse(String(raw)) as
    | { ok: true; song: QueueSong; queueVersion: number }
    | { ok: false; error: "missing_song" };
}

export async function updateSongTitle(roomId: string, songId: string, title: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const event = makeDbEvent({ type: "song_updated", roomId, songId, payload: { title } });
  const raw = await redis.eval(
    updateSongScript,
    3,
    key.song(songId),
    key.version(roomId),
    key.eventStream(),
    roomId,
    songId,
    title,
    event.eventId,
    event.createdAt,
  );

  return JSON.parse(String(raw)) as
    | { ok: true; song: QueueSong; queueVersion: number }
    | { ok: false; error: "missing_song" };
}

export async function transitionToNextTrack(roomId: string, idempotencyKey: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const event = makeDbEvent({
    type: "track_transitioned",
    roomId,
    payload: {},
    eventId: `track_transitioned:${roomId}:${idempotencyKey}`,
  });

  const raw = await redis.eval(
    transitionNextScript,
    6,
    key.approved(roomId),
    key.nowPlaying(roomId),
    key.version(roomId),
    key.transitionId(roomId, idempotencyKey),
    key.eventStream(),
    key.done(roomId),
    "song:",
    roomId,
    event.eventId,
    event.createdAt,
  );

  return JSON.parse(String(raw)) as {
    oldTrackId: string | null;
    nextTrack: QueueSong | null;
    upNext: QueueSong | null;
    queueVersion: number;
  };
}

export async function clearQueue(roomId: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const event = makeDbEvent({ type: "queue_cleared", roomId, payload: {}, eventId: `queue_cleared:${roomId}:${crypto.randomUUID()}` });
  const raw = await redis.eval(
    clearQueueScript,
    5,
    key.pending(roomId),
    key.approved(roomId),
    key.nowPlaying(roomId),
    key.version(roomId),
    key.eventStream(),
    roomId,
    event.eventId,
    event.createdAt,
  );

  return JSON.parse(String(raw)) as
    | { ok: true; clearedCount: number; queueVersion: number }
    | { ok: false; error: string };
}

export async function previousTrack(roomId: string) {
  if ((await redis.exists(key.version(roomId))) === 0) await rebuildRoomQueue(roomId);

  const event = makeDbEvent({ type: "track_previous", roomId, payload: {} });
  const raw = await redis.eval(
    previousTrackScript,
    5,
    key.approved(roomId),
    key.done(roomId),
    key.nowPlaying(roomId),
    key.version(roomId),
    key.eventStream(),
    "song:",
    roomId,
    event.eventId,
    event.createdAt,
  );

  return JSON.parse(String(raw)) as
    | { ok: true; previousTrack: QueueSong; returnedTrack: QueueSong | null; hasPrevious: boolean; queueVersion: number }
    | { ok: false; error: "no_previous_track" };
}
