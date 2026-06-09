import { Server, Socket } from "socket.io";
import { roomManager } from "../state/roomManager";
import { sql } from "../db/client";
import { redisCache } from "../lib/redis";

export function handleConnection(io: Server, socket: Socket) {
  
  // Custom tracking for this socket
  let currentRoom: string | null = null;
  let currentRole: "participant" | "admin" | "eo" | null = null;

  socket.on("join_room", async ({ roomId, role, passkey: providedPasskey, adminToken }: { roomId: string; role: "participant" | "admin" | "eo"; passkey?: string; adminToken?: string }, callback?: (res: any) => void) => {
    // 1. Initial debug log
    console.log(`[JOIN_ATTEMPT] Socket: ${socket.id}, Room: ${roomId}, Role: ${role}`);
    
    try {
      // 1. ALWAYS resolve the latest room state from DB for the join event
      // This ensures we never have a "stale" expected key even if Redis/Memory lags.
      const dbRooms = await sql`SELECT id, passkey, owner_id FROM rooms WHERE id = ${roomId}`;
      let room = dbRooms[0];
      let roomPasskey: string | null = null;

      if (!room) {
        if (role === 'admin') {
          const generatedKey = Math.floor(10000 + Math.random() * 90000).toString();
          console.log(`[ROOM] Creating room ${roomId} with key: ${generatedKey}`);
          const newRoom = await sql`INSERT INTO rooms (id, passkey) VALUES (${roomId}, ${generatedKey}) RETURNING id, passkey, owner_id`;
          room = newRoom[0];
        } else {
          if (callback) callback({ success: false, message: "Room not found." });
          return;
        }
      }

      if (!room) {
        if (callback) callback({ success: false, message: "Could not resolve room state." });
        return;
      }

      roomPasskey = room.passkey;

      // Sync Caches
      await redisCache.setRoomKey(roomId, roomPasskey!);
      roomManager.setPasskey(roomId, roomPasskey!);

      // Unified Debug Log for the user
      console.log(`[DEBUG_JOIN] Socket: ${socket.id}, Room: ${roomId}, Role: ${role}, Key: "${roomPasskey}"`);

      // 2. Passkey validation for participants
      if (role === "participant") {
        const cleanProvided = providedPasskey?.trim();
        if (!cleanProvided || cleanProvided !== roomPasskey) {
          console.warn(`[AUTH] Participant ${socket.id} rejected. Wrong passkey for room ${roomId} (Got: "${cleanProvided}", Expected: "${roomPasskey}")`);
          if (callback) {
            callback({ 
              success: false, 
              code: "WRONG_PASSKEY", 
              message: "Invalid room key. Please check with your Admin." 
            });
          }
          return;
        }
        console.log(`[AUTH] Participant ${socket.id} joined room ${roomId} successfully`);
      }

      // 3. Admin Token Validation (If role is admin)
      if (role === "admin") {
        if (!adminToken) {
          if (callback) callback({ success: false, error: "Unauthorized. Please log in." });
          return;
        }
        const adminId = await redisCache.client.get(`admin_session:${adminToken}`);
        if (!adminId) {
          if (callback) callback({ success: false, error: "Session expired. Please log in again." });
          return;
        }

        // AUTO-OWNERSHIP: If the room has no owner, and an authenticated admin joins, they claim it.
        if (!room.owner_id) {
           console.log(`[ROOM] Room ${roomId} has no owner. Assigning to Admin ${adminId}`);
           await sql`UPDATE rooms SET owner_id = ${adminId} WHERE id = ${roomId}`;
           room.owner_id = adminId;
        }

        if (room.owner_id !== adminId) {
           if (callback) callback({ success: false, error: "You do not own this room." });
           return;
        }

        // ONLY Admins get the room key info pushed to them automatically
        socket.emit("room_key_info", { passkey: room.passkey });
        console.log(`[AUTH] Socket ${socket.id} joined as Admin for room ${roomId}`);
      }

    } catch (e) {
      console.error(e);
      if (callback) callback({ success: false, message: "Internal server error" });
      return;
    }

    // 2. Role logic enforcement (Playback Controllers)
    if (role === "eo") {
      console.log(`[AUTH] Socket ${socket.id} claiming EO role (Playback Controller) for room ${roomId}`);
      const registered = roomManager.registerPlaybackController(roomId, socket.id);
      if (!registered) {
        console.warn(`[AUTH] EO registration REJECTED for ${socket.id} (Room ${roomId} already controlled)`);
        socket.emit("error", { message: "Room already has an active playback controller." });
        socket.disconnect();
        return;
      }
      console.log(`[AUTH] EO registration SUCCESS for ${socket.id}`);
      socket.emit("eo_registered", { success: true });
    }

    // Join Socket.IO room
    socket.join(roomId);
    currentRoom = roomId;
    currentRole = role;

    // Optional scoping by role: we can also join a role-specific room for easy admin broadcasting
    socket.join(`${roomId}:${role}`);

    // 3. Push initial state to all roles (always fresh from DB)
    let nowPlaying = null;
    try {
      const nowPlayingRows = await sql`
        SELECT id, youtube_id as "youtubeId", title, author
        FROM songs
        WHERE room_id = ${roomId} AND status = 'playing'
        ORDER BY approved_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `;
      nowPlaying = nowPlayingRows[0] || null;
      roomManager.setNowPlaying(roomId, nowPlaying);
    } catch (err) {
      console.error("[DB ERROR] Failed to fetch nowPlaying:", err);
      nowPlaying = roomManager.getNowPlaying(roomId);
    }

    socket.emit("now_playing_updated", nowPlaying);

    // Push current playback state
    socket.emit("playback_updated", { isPlaying: roomManager.getIsPlaying(roomId) });

    // Push queue (always fresh from DB to prevent stale cache issues)
    let queue: any[] = [];
    try {
      const rows = await sql`
        SELECT id, youtube_id as "youtubeId", title, author, status, submitted_by as "submittedBy", created_at as "createdAt"
        FROM songs 
        WHERE room_id = ${roomId} AND status IN ('pending', 'approved')
        ORDER BY approved_at ASC NULLS LAST, created_at ASC
      `;
      queue = [...rows];
      roomManager.setQueue(roomId, queue);
    } catch (err) {
      console.error("[DB ERROR] Failed to fetch queue:", err);
      queue = [];
      roomManager.setQueue(roomId, []);
    }

    // Filter queue based on role
    if (role === "admin") {
      socket.emit("queue_updated", queue);
    } else {
      socket.emit("queue_updated", queue.filter(q => q.status === 'approved'));
    }

    console.log(`Socket ${socket.id} joined room ${roomId} as ${role}`);
    if (callback) callback({ success: true });
  });

  socket.on("get_now_playing", ({ roomId }: { roomId: string }, callback) => {
    const nowPlaying = roomManager.getNowPlaying(roomId);
    callback({ nowPlaying });
  });

  socket.on("join_by_passkey", async ({ passkey }: { passkey: string }, callback) => {
    try {
      // 1. Check Redis for near-instant resolution
      let roomId = await redisCache.getRoomIdByKey(passkey);

      if (!roomId) {
        // 2. DB Fallback
        const dbRooms = await sql`SELECT id FROM rooms WHERE passkey = ${passkey} LIMIT 1`;
        if (dbRooms.length > 0) {
          roomId = (dbRooms[0] as any).id;
          // Hydrate Redis
          await redisCache.setRoomKey(roomId!, passkey);
        }
      }

      if (roomId) {
        callback({ success: true, roomId });
      } else {
        callback({ success: false, error: "Invalid room code. Please check with your Admin." });
      }
    } catch (e) {
      console.error(e);
      callback({ success: false, error: "Internal server error" });
    }
  });

  socket.on("disconnect", () => {
    // Cleanup EO if this socket was an EO
    const eoCleanupRoomId = roomManager.unregisterControllerIfAny(socket.id);
    if (eoCleanupRoomId) {
      console.warn(`EO disconnected from room ${eoCleanupRoomId}`);
    }
  });
}
