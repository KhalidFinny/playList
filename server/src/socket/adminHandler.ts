import { Server, Socket } from "socket.io";
import { sql } from "../db/client";
import { roomManager } from "../state/roomManager";
import { redisCache } from "../lib/redis";

export function handleAdminEvents(io: Server, socket: Socket) {
  
  // Approve song request
  socket.on("approve_song", async (data: { roomId: string; songId: string }, callback) => {
    const { roomId, songId } = data;

    if (!roomId || !songId) {
      if (callback) callback({ success: false, error: "Missing fields" });
      return;
    }

    try {
      // 1. Update DB
      const result = await sql`
        UPDATE songs 
        SET status = 'approved', approved_at = NOW()
        WHERE id = ${songId} AND room_id = ${roomId} AND status = 'pending'
        RETURNING id, youtube_id as "youtubeId", title, author, status, submitted_by as "submittedBy", created_at as "createdAt"
      `;

      if (result.length === 0) {
        if (callback) callback({ success: false, error: "Song not found or already processed" });
        return;
      }

      const updatedSong = result[0];

      // 2. Reload canonical queue from DB and sync memory cache
      const queueRows = await sql`
        SELECT id, youtube_id as "youtubeId", title, author, status, submitted_by as "submittedBy", created_at as "createdAt"
        FROM songs
        WHERE room_id = ${roomId} AND status IN ('pending', 'approved')
        ORDER BY approved_at ASC NULLS LAST, created_at ASC
      `;
      const updatedQueue = [...queueRows];
      roomManager.setQueue(roomId, updatedQueue);

      // 3. Broadcast targeted updates
      io.to(`${roomId}:admin`).emit("queue_updated", updatedQueue);

      const approvedOnly = updatedQueue.filter(q => q.status === 'approved');
      io.to(`${roomId}:participant`).emit("queue_updated", approvedOnly);
      io.to(`${roomId}:eo`).emit("queue_updated", approvedOnly);

      // Also notify admins specifically to clear their pending item
      io.to(`${roomId}:admin`).emit("song_approved", updatedSong);

      if (callback) callback({ success: true, message: "Song approved" });
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
      const result = await sql`
        DELETE FROM songs 
        WHERE id = ${songId} AND room_id = ${roomId}
        RETURNING id
      `;

      if (result.length > 0) {
        // Reload canonical queue and broadcast to all roles
        const queueRows = await sql`
          SELECT id, youtube_id as "youtubeId", title, author, status, submitted_by as "submittedBy", created_at as "createdAt"
          FROM songs
          WHERE room_id = ${roomId} AND status IN ('pending', 'approved')
          ORDER BY approved_at ASC NULLS LAST, created_at ASC
        `;
        const updatedQueue = [...queueRows];
        roomManager.setQueue(roomId, updatedQueue);

        io.to(`${roomId}:admin`).emit("song_deleted", { songId });
        io.to(`${roomId}:admin`).emit("queue_updated", updatedQueue);

        const approvedOnly = updatedQueue.filter(q => q.status === 'approved');
        io.to(`${roomId}:participant`).emit("queue_updated", approvedOnly);
        io.to(`${roomId}:eo`).emit("queue_updated", approvedOnly);
      }

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
      const result = await sql`
        UPDATE songs 
        SET title = ${newTitle}
        WHERE id = ${songId} AND room_id = ${roomId}
        RETURNING id, title
      `;

      if (result.length === 0) {
        if (callback) callback({ success: false, error: "Song not found" });
        return;
      }

      const updated = result[0];
      // Broadcast update to all admins and the EO
      io.to(roomId).emit("song_updated", updated);

      if (callback) callback({ success: true, song: updated });
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
