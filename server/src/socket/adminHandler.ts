import { Server, Socket } from "socket.io";
import { sql } from "../db/client";
import { roomManager } from "../state/roomManager";
import { redisCache } from "../lib/redis";
import { addApprovedSong, approveSong, deleteSong, updateSongTitle } from "../services/liveQueue/index";

export function handleAdminEvents(io: Server, socket: Socket) {
  
  // Approve song request
  socket.on("approve_song", async (data: { roomId: string; songId: string }, callback) => {
    const { roomId, songId } = data;

    if (!roomId || !songId) {
      if (callback) callback({ success: false, error: "Missing fields" });
      return;
    }

    try {
      const result = await approveSong(roomId, songId);
      if (!result.ok) {
        if (callback) callback({ success: false, error: "Song not found or already processed" });
        return;
      }

      io.to(`${roomId}:admin`).emit("song_approved", result.song);
      io.to(`${roomId}:participant`).emit("song_approved", result.song);
      io.to(`${roomId}:eo`).emit("song_approved", result.song);

      if (callback) callback({ success: true, message: "Song approved", song: result.song });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Database error" });
    }
  });

  // Delete/Reject song request (Silently rejected from user's perspective, deleted entirely)
  socket.on("delete_song", async (data: { roomId: string; songId: string }, callback) => {
    const { roomId, songId } = data;

    if (!roomId || !songId) {
      if (callback) callback({ success: false, error: "Missing fields" });
      return;
    }

    try {
      const result = await deleteSong(roomId, songId);
      if (!result.ok) {
        if (callback) callback({ success: false, error: "Song not found" });
        return;
      }

      io.to(roomId).emit("song_deleted", { songId });
      if (result.song.status === "playing") io.to(roomId).emit("now_playing_updated", null);

      if (callback) callback({ success: true, message: "Song deleted" });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Database error" });
    }
  });

  // Edit song title
  socket.on("edit_song", async (data: { roomId: string; songId: string; newTitle: string }, callback) => {
    const { roomId, songId, newTitle } = data;

    if (!roomId || !songId || !newTitle) {
      if (callback) callback({ success: false, error: "Missing fields" });
      return;
    }

    try {
      const result = await updateSongTitle(roomId, songId, newTitle);
      if (!result.ok) {
        if (callback) callback({ success: false, error: "Song not found" });
        return;
      }

      io.to(roomId).emit("song_updated", result.song);

      if (callback) callback({ success: true, song: result.song });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Database error" });
    }
  });
  


  // Admin adds song directly to queue (no approval needed)
  socket.on("admin_add_song", async (data: { roomId: string; youtubeId: string; title: string; author: string; adminToken: string }, callback) => {
    const { roomId, youtubeId, title, author, adminToken } = data;

    if (!roomId || !youtubeId || !title || !adminToken) {
      if (callback) callback({ success: false, error: "Missing fields" });
      return;
    }

    try {
      // Verify admin authorization
      const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
      if (!adminId) {
        if (callback) callback({ success: false, error: "Unauthorized" });
        return;
      }

      const newSong = await addApprovedSong(roomId, {
        id: crypto.randomUUID(),
        youtubeId,
        title,
        author: author || "",
        submittedBy: adminId,
        createdAt: new Date().toISOString(),
      });

      console.log(`[ADMIN] Song directly added to queue for room ${roomId}: ${newSong.title}`);

      io.to(`${roomId}:admin`).emit("song_approved", newSong);
      io.to(`${roomId}:participant`).emit("song_approved", newSong);
      io.to(`${roomId}:eo`).emit("song_approved", newSong);

      if (callback) callback({ success: true, song: newSong });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Database error" });
    }
  });

  // Create a new station (room)
  socket.on("create_station", async (data: { roomId: string; adminToken: string }, callback) => {
    const { roomId, adminToken } = data;
    if (!roomId || !adminToken) return callback?.({ success: false, error: "Missing fields" });

    try {
      const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
      if (!adminId) return callback?.({ success: false, error: "Unauthorized" });

      // Check if room exists
      const existing = await sql`SELECT id FROM rooms WHERE id = ${roomId}`;
      if (existing.length > 0) return callback?.({ success: false, error: "Station ID already in use" });

      const generatedKey = Math.floor(10000 + Math.random() * 90000).toString();
      
      await sql`
        INSERT INTO rooms (id, passkey, owner_id) 
        VALUES (${roomId}, ${generatedKey}, ${adminId})
      `;

      await redisCache.setRoomKey(roomId, generatedKey);
      roomManager.setPasskey(roomId, generatedKey);

      if (callback) callback({ success: true, roomId, passkey: generatedKey });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

  // Get my stations
  socket.on("get_my_stations", async (data: { adminToken: string }, callback) => {
    const { adminToken } = data;
    if (!adminToken) return callback?.({ success: false, error: "Missing token" });

    try {
      const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
      if (!adminId) return callback?.({ success: false, error: "Unauthorized" });

      const rooms = await sql`
        SELECT id, passkey, created_at as "createdAt"
        FROM rooms 
        WHERE owner_id = ${adminId}
        ORDER BY created_at DESC
      `;

      if (callback) callback({ success: true, stations: rooms });
    } catch (err) {
      console.error(err);
      if (callback) callback({ success: false, error: "Internal server error" });
    }
  });

}
