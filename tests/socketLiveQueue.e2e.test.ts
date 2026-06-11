import { createServer, type Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { Server } from "socket.io";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { handleAdminEvents } from "../server/src/socket/adminHandler";
import { handleConnection } from "../server/src/socket/connectionHandler";
import { handleEOEvents } from "../server/src/socket/eoHandler";
import { handleParticipantEvents } from "../server/src/socket/participantHandler";

type RedisClient = typeof import("../server/src/lib/redis")["redis"];

let redis: RedisClient;
let httpServer: HttpServer;
let ioServer: Server;
let baseUrl: string;

const sockets: ClientSocket[] = [];
const touchedRooms = new Set<string>();
const touchedSongs = new Set<string>();

const roomKeys = (roomId: string) => [
  `room:key:12345`,
  `room:id:${roomId}`,
  `room:${roomId}:queue:pending`,
  `room:${roomId}:queue:approved`,
  `room:${roomId}:queue:done`,
  `room:${roomId}:nowPlaying`,
  `room:${roomId}:version`,
  `room:${roomId}:transition:socket-ended`,
  `room:${roomId}:transition:latency-ended`,
];

const connectSocket = () =>
  Effect.promise(
    () =>
      new Promise<ClientSocket>((resolve, reject) => {
        const socket = createClient(baseUrl, { transports: ["websocket"], forceNew: true });
        sockets.push(socket);
        socket.once("connect", () => resolve(socket));
        socket.once("connect_error", reject);
      }),
  );

const emitAck = <T>(socket: ClientSocket, event: string, data: unknown) =>
  Effect.promise(
    () =>
      new Promise<T>((resolve, reject) => {
        socket.timeout(1_000).emit(event, data, (error: Error | null, response: T) => {
          if (error) reject(error);
          else resolve(response);
        });
      }),
  );

const waitFor = <T>(socket: ClientSocket, event: string) =>
  new Promise<T>((resolve, reject) => {
    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 1_000);

    socket.once(event, handler);
  });

beforeAll(async () => {
  process.env.REDIS_URL ??= "redis://:REDIS@localhost:6104";
  process.env.DATABASE_URL ??= "postgres://unused";

  ({ redis } = await import("../server/src/lib/redis"));
  await redis.ping();

  httpServer = createServer();
  ioServer = new Server(httpServer, { cors: { origin: "*" } });
  ioServer.on("connection", (socket) => {
    handleConnection(ioServer, socket);
    handleParticipantEvents(ioServer, socket);
    handleAdminEvents(ioServer, socket);
    handleEOEvents(ioServer, socket);
  });

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();

  const keys = [
    ...[...touchedRooms].flatMap(roomKeys),
    ...[...touchedSongs].map((id) => `song:${id}`),
  ];
  await redis.del("db-events:test", "db-events:test:dlq");
  if (keys.length > 0) await redis.del(...keys);
  touchedRooms.clear();
  touchedSongs.clear();
});

afterAll(async () => {
  await ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await redis.quit();
});

describe("socket live queue e2e", () => {
  it.effect("joins from Redis, submits, approves, transitions, and suppresses duplicate transitions", () =>
    Effect.gen(function* () {
      const roomId = `socket-${crypto.randomUUID()}`;
      touchedRooms.add(roomId);
      yield* Effect.promise(() =>
        redis.mset(`room:key:12345`, roomId, `room:id:${roomId}`, "12345", `room:${roomId}:version`, "1"),
      );

      const participant = yield* connectSocket();
      const eo = yield* connectSocket();
      const admin = yield* connectSocket();

      expect(yield* emitAck(participant, "join_room", { roomId, role: "participant", passkey: "bad" })).toMatchObject({
        success: false,
        code: "WRONG_PASSKEY",
      });
      expect(yield* emitAck(participant, "join_room", { roomId, role: "participant", passkey: "12345" })).toMatchObject({
        success: true,
      });
      expect(yield* emitAck(eo, "join_room", { roomId, role: "eo" })).toMatchObject({ success: true });

      const pendingEvent = waitFor<{ id: string; title: string }>(participant, "song_approved");
      const submitResponse = yield* emitAck<{ success: boolean }>(participant, "submit_song", {
        roomId,
        youtubeId: "yt-socket",
        title: "Socket Song",
        author: "Socket Artist",
        userId: `user-${crypto.randomUUID()}`,
      });
      expect(submitResponse).toMatchObject({ success: true });

      const pendingIds = yield* Effect.promise(() => redis.lrange(`room:${roomId}:queue:pending`, 0, -1));
      expect(pendingIds).toHaveLength(1);
      const songId = pendingIds[0]!;
      touchedSongs.add(songId);

      const approveResponse = yield* emitAck<{ success: boolean; song: { id: string } }>(admin, "approve_song", {
        roomId,
        songId,
      });
      expect(approveResponse.success).toBe(true);
      expect(approveResponse.song.id).toBe(songId);
      expect((yield* Effect.promise(() => pendingEvent)).id).toBe(songId);

      const firstTransition = yield* emitAck<{ success: boolean; nextTrack: { id: string } | null }>(eo, "eo_track_ended", {
        roomId,
        idempotencyKey: "socket-ended",
      });
      const duplicateTransition = yield* emitAck<{ success: boolean; nextTrack: { id: string } | null }>(eo, "eo_track_ended", {
        roomId,
        idempotencyKey: "socket-ended",
      });

      expect(firstTransition.nextTrack?.id).toBe(songId);
      expect(duplicateTransition).toEqual(firstTransition);
      expect(yield* Effect.promise(() => redis.get(`room:${roomId}:nowPlaying`))).toBe(songId);
      expect(yield* Effect.promise(() => redis.lrange(`room:${roomId}:queue:approved`, 0, -1))).toEqual([]);
    }),
  );

  it.effect("next and previous callbacks stay on Redis/socket fast path", () =>
    Effect.gen(function* () {
      const roomId = `socket-${crypto.randomUUID()}`;
      touchedRooms.add(roomId);
      const currentId = `song-${crypto.randomUUID()}`;
      const previousId = `song-${crypto.randomUUID()}`;
      const nextId = `song-${crypto.randomUUID()}`;
      touchedSongs.add(currentId);
      touchedSongs.add(previousId);
      touchedSongs.add(nextId);

      yield* Effect.promise(() =>
        redis.mset(
          `room:key:12345`, roomId,
          `room:id:${roomId}`, "12345",
          `room:${roomId}:version`, "1",
          `room:${roomId}:nowPlaying`, currentId,
          `song:${currentId}`, JSON.stringify({ id: currentId, youtubeId: "yt-current", title: "Current", author: "Artist", status: "playing" }),
          `song:${previousId}`, JSON.stringify({ id: previousId, youtubeId: "yt-previous", title: "Previous", author: "Artist", status: "done" }),
          `song:${nextId}`, JSON.stringify({ id: nextId, youtubeId: "yt-next", title: "Next", author: "Artist", status: "approved" }),
        ),
      );
      yield* Effect.promise(() => redis.lpush(`room:${roomId}:queue:done`, previousId));
      yield* Effect.promise(() => redis.rpush(`room:${roomId}:queue:approved`, nextId));

      const eo = yield* connectSocket();
      expect(yield* emitAck(eo, "join_room", { roomId, role: "eo" })).toMatchObject({ success: true });

      const previousStarted = performance.now();
      const previousResponse = yield* emitAck<{ success: boolean; previousTrack?: { id: string } }>(eo, "previous_track", { roomId });
      const previousMs = performance.now() - previousStarted;

      const nextStarted = performance.now();
      const nextResponse = yield* emitAck<{ success: boolean; nextTrack: { id: string } | null }>(eo, "eo_track_ended", {
        roomId,
        idempotencyKey: "latency-ended",
      });
      const nextMs = performance.now() - nextStarted;

      expect(previousResponse.previousTrack?.id).toBe(previousId);
      expect(nextResponse.nextTrack?.id).toBe(nextId);
      expect(previousMs).toBeLessThan(100);
      expect(nextMs).toBeLessThan(100);
    }),
  );

  it.effect("rejects second EO controller for the same room", () =>
    Effect.gen(function* () {
      const roomId = `socket-${crypto.randomUUID()}`;
      touchedRooms.add(roomId);
      yield* Effect.promise(() =>
        redis.mset(`room:key:12345`, roomId, `room:id:${roomId}`, "12345", `room:${roomId}:version`, "1"),
      );

      const firstEo = yield* connectSocket();
      const secondEo = yield* connectSocket();
      const errorEvent = waitFor<{ message: string }>(secondEo, "error");

      expect(yield* emitAck(firstEo, "join_room", { roomId, role: "eo" })).toMatchObject({ success: true });
      secondEo.emit("join_room", { roomId, role: "eo" });
      expect((yield* Effect.promise(() => errorEvent)).message).toBe("Room already has an active playback controller.");
    }),
  );
});
