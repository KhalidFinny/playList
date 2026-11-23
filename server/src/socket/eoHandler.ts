import { Server, Socket } from "socket.io";
import { roomManager } from "../state/roomManager";
import { isAdminForRoom } from "./adminSession";
import { previousTrack, transitionToNextTrack } from "../services/liveQueue/index";
import { broadcastQueue } from "./queueBroadcast";
import { redis } from "../lib/redis";

/**
 * Who may drive a room's playback.
 *
 * The old check was `activeEO && activeEO !== socket.id`, which passes for
 * everyone whenever no EO is registered, and the client never registers one: the
 * admin joins as "admin". That left advancing, pausing, seeking and previous open
 * to any socket that knew a room id, so a participant could move the room.
 *
 * `isAdminForRoom` is the grant `join_room` records after it validates the admin
 * token and room ownership, the same one the admin mutations use. A socket that
 * did claim the playback-controller role is still allowed, so the slot keeps
 * meaning something if a dedicated controller is ever added back.
 */
const mayDrivePlayback = (socket: Socket, roomId: string) =>
  isAdminForRoom(socket, roomId) || roomManager.getPlaybackController(roomId) === socket.id;

export function handleEOEvents(io: Server, socket: Socket) {
  // EO asks for the next track right away or when a track finishes
  socket.on("eo_track_ended", async (data: { roomId: string; idempotencyKey?: string }, callback) => {
    const { roomId } = data;
    const idempotencyKey = data.idempotencyKey ?? crypto.randomUUID();

    if (!roomId) {
      if (callback) callback({ success: false, error: "Missing roomId" });
      return;
    }

    try {
      console.log(`EO for room ${roomId} requested next track...`);
      if (!mayDrivePlayback(socket, roomId)) {
        if (callback) callback({ success: false, error: "Unauthorized. You are not the playback controller for this room." });
        return;
      }

      const transition = await transitionToNextTrack(roomId, idempotencyKey);
      const { oldTrackId, nextTrack, upNext, queueVersion } = transition;

      roomManager.setNowPlaying(roomId, nextTrack);

      io.to(roomId).emit("track_transitioned", { oldTrackId, nextTrack, upNext, queueVersion });
      io.to(roomId).emit("now_playing_updated", nextTrack);
      if (nextTrack) io.to(roomId).emit("song_removed_from_queue", { songId: nextTrack.id });

      // Send authoritative queue snapshot
      await broadcastQueue(io, roomId);

      if (callback) callback({ success: true, oldTrackId, nextTrack, upNext, queueVersion });

    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Database error" });
    }
  });

  // Admin syncs playback progress to all participants
  socket.on("sync_playback", async (data: { roomId: string; currentTime: number; duration: number; isPlaying: boolean }) => {
    const { roomId, currentTime, duration, isPlaying } = data;
    if (!roomId) return;

    if (!mayDrivePlayback(socket, roomId)) return;

    const playbackState = { currentTime, duration, isPlaying, updatedAt: Date.now() };
    await redis.hset(`room:${roomId}:playback`, playbackState);
    await redis.expire(`room:${roomId}:playback`, 24 * 60 * 60);
    io.to(roomId).emit("playback_sync", playbackState);
  });

  // EO requests previous track
  socket.on("previous_track", async (data: { roomId: string }, callback) => {
    const { roomId } = data;

    if (!roomId) {
      if (callback) callback({ success: false, error: "Missing roomId" });
      return;
    }

    try {
      if (!mayDrivePlayback(socket, roomId)) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const result = await previousTrack(roomId);
      if (!result.ok) {
        if (callback) callback({ success: false, error: "No previous track" });
        return;
      }

      roomManager.setNowPlaying(roomId, result.previousTrack);
      io.to(roomId).emit("now_playing_updated", result.previousTrack);
      if (result.returnedTrack) io.to(roomId).emit("song_approved", result.returnedTrack);

      // Send authoritative queue snapshot
      await broadcastQueue(io, roomId);

      if (callback) callback({ success: true, previousTrack: result.previousTrack, hasPrevious: result.hasPrevious, queueVersion: result.queueVersion });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Database error" });
    }
  });

  // EO toggles playback (Play/Pause)
  socket.on("toggle_playback", (data: { roomId: string, isPlaying: boolean }) => {
    const { roomId, isPlaying } = data;
    if (!roomId) return;

    if (!mayDrivePlayback(socket, roomId)) return;

    roomManager.setIsPlaying(roomId, isPlaying);
    redis.hset(`room:${roomId}:playback`, { isPlaying, updatedAt: Date.now() }).catch(console.error);
    redis.expire(`room:${roomId}:playback`, 24 * 60 * 60).catch(console.error);
    io.to(roomId).emit("playback_updated", { isPlaying });
    console.log(`Playback for room ${roomId} set to: ${isPlaying}`);
  });
}
