import { hashPassword, verifyPassword } from "./lib/password";
import { resolveAudio, searchSuggestions, searchYouTube } from "./lib/youtube";

export interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  ADMIN_INVITE_CODE?: string;
}

type Role = "participant" | "admin" | "eo";

/** A rate-limit key with no hits for this long is dead weight; drop it. */
const RATE_KEY_TTL_MS = 10 * 60 * 1000;
type Mode = "approval" | "party";

type Song = {
  id: string;
  youtubeId: string;
  title: string;
  author: string;
  status: "pending" | "approved" | "playing" | "done";
  submittedBy: string;
  createdAt: number;
  approvedAt: number | null;
  doneAt: number | null;
  position: number;
};

type Session = { sid: string; room: string | null; role: Role | null };

const PING_INTERVAL_MS = 25_000;

/** Seed accounts. Password `12345678`, the same as the Bun server. */
const SEED_ADMINS = [
  ["admin1", "admin1@playit.com", "super_admin", "pbkdf2$10000$9f2c1a7b4e6d80315c9a2f7e6b1d4c08$c8d6867afb872fe57fcf21c560004469802388e71c621917101fbbdf56a93db5"],
  ["admin2", "admin2@playit.com", "admin", "pbkdf2$10000$3a7e0c5b9d2f1648a1c6e0b7d3f5924a$88eb837ceada379cc10fc0e9de51651441331370607ab5349add9b11557d4b9c"],
  ["admin3", "admin3@playit.com", "admin", "pbkdf2$10000$c4b8f1e6a0d372955e1b7c2a8f604d13$7a1d880c401f157bcdc4d81ab8b8f873730aa5af32847af4a3c6eab9722fc581"],
] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

/**
 * One object holds every room.
 *
 * A room id has to be known before the WebSocket is accepted, but this app joins
 * by passkey or by a URL the client already has, so the socket can land on any
 * object. One object therefore owns all rooms and routes by id, which also keeps
 * the admin session table and the room list in a single SQLite database.
 *
 * It uses the Hibernation API: an idle room is evicted and costs no duration, so
 * per-room objects would be the only way to exceed the free tier.
 */
export class RoomHub {
  private state: DurableObjectState;
  private env: Env;
  private sockets = new Map<WebSocket, Session>();
  private ready: Promise<void>;
  // Per-isolate caches; losing them on eviction is acceptable.
  // Bounded: a Durable Object lives for hours, and this used to keep every query
  // a room ever searched, each with its full result set. Oldest-first eviction is
  // enough here because a re-search is one upstream call.
  private searchCache = new Map<string, unknown>();
  private static readonly SEARCH_CACHE_MAX = 100;
  private rateLimits = new Map<string, number[]>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Session | null;
      if (attachment) this.sockets.set(ws, attachment);
    }

    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("2", "3"));
    this.ready = this.migrate();
  }

  private get ctx() {
    return this.state;
  }

  private async migrate() {
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        passkey TEXT UNIQUE NOT NULL,
        owner_id TEXT,
        mode TEXT NOT NULL DEFAULT 'approval',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        youtube_id TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        status TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        approved_at INTEGER,
        done_at INTEGER,
        position INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS songs_room_idx ON songs(room_id, status, position);
      CREATE TABLE IF NOT EXISTS meta (
        room_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (room_id, key)
      );
    `);

    const now = Date.now();
    for (const [username, email, role, hash] of SEED_ADMINS) {
      await this.ctx.storage.sql.exec(
        `INSERT INTO admins (id, username, email, password_hash, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?)
         ON CONFLICT(username) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash, role = excluded.role, status = 'active'`,
        crypto.randomUUID(),
        username,
        email,
        hash,
        role,
        now,
      );
    }

    // No websocket survives a restart, so any playback-controller id recorded
    // before this one is dead. Left in place it locks the host out of playback
    // control on the first reconnect after every deploy, which stops the room.
    await this.ctx.storage.sql.exec(`UPDATE meta SET value = '' WHERE key = 'eo_socket'`);
  }

  async fetch(req: Request): Promise<Response> {
    await this.ready;
    const url = new URL(req.url);

    if (url.pathname === "/stats") {
      return json({ sockets: this.ctx.getWebSockets().length, rooms: this.roomList().length });
    }

    if (url.pathname === "/api/top-tracks") {
      return json({ tracks: this.topTracks() });
    }
    if (url.pathname === "/api/metrics") {
      return json({ error: "Not found" }, 404);
    }

    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);

    const session: Session = { sid: crypto.randomUUID(), room: null, role: null };
    server.serializeAttachment(session);
    this.sockets.set(server, session);

    server.send(
      `0${JSON.stringify({
        sid: session.sid,
        upgrades: [],
        pingInterval: PING_INTERVAL_MS,
        pingTimeout: 20_000,
        maxPayload: 1_000_000,
      })}`,
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------------------------------------------------------------- socket ---

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const frame = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    const prefix = frame.slice(0, 2);

    if (prefix === "40") {
      const session = this.sockets.get(ws);
      ws.send(`40${JSON.stringify({ sid: session?.sid ?? "" })}`);
      return;
    }
    if (prefix === "41") {
      ws.close(1000, "client disconnect");
      return;
    }
    if (prefix !== "42") return;

    await this.ready;

    const body = frame.slice(2);
    const ackId = /^(\d+)/.exec(body)?.[1];
    const payload = body.slice(ackId?.length ?? 0);

    let event = "";
    let data: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(payload) as [string, Record<string, unknown>?];
      event = parsed[0];
      data = parsed[1] ?? {};
    } catch {
      ws.close(1003, "malformed frame");
      return;
    }

    const session = this.sockets.get(ws);
    if (!session) return;

    const reply = (result: unknown) => {
      if (ackId) ws.send(`43${ackId}[${JSON.stringify(result)}]`);
    };

    try {
      const result = await this.handleEvent(ws, session, event, data);
      if (result !== SKIP) reply(result ?? { success: true });
    } catch (err) {
      console.error(`[ws] ${event} failed:`, err);
      reply({ success: false, error: err instanceof Error ? err.message : "Internal error" });
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.dropSocket(ws);
    ws.close(1000, "closed");
  }

  async webSocketError(ws: WebSocket) {
    this.dropSocket(ws);
  }

  private dropSocket(ws: WebSocket) {
    const session = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (session?.room && session.role === "eo" && this.getMeta(session.room, "eo_socket") === session.sid) {
      this.setMeta(session.room, "eo_socket", "");
    }
    // A disconnect is exactly when a socket's rate-limit keys become garbage.
    this.pruneRateLimits();
  }

  private async handleEvent(
    ws: WebSocket,
    session: Session,
    event: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
    const roomId = str("roomId");

    switch (event) {
      // ------------------------------------------------------------ room join
      case "join_room": {
        const role = str("role") as Role;
        const room = this.roomById(roomId);

        if (!room) {
          if (role !== "admin") return { success: false, message: "Room not found." };
          const passkey = this.createRoom(roomId, str("adminToken"));
          session.room = roomId;
          session.role = role;
          ws.serializeAttachment(session);
          this.send(ws, "room_key_info", { passkey });
          return { success: true, mode: "approval" };
        }

        if (role === "participant") {
          if (str("passkey").trim() !== room.passkey) {
            return { success: false, code: "WRONG_PASSKEY", message: "Invalid room key. Please check with your Admin." };
          }
        }

        if (role === "admin") {
          const adminId = this.sessionAdmin(str("adminToken"));
          if (!adminId) return { success: false, error: "Session expired. Please log in again." };
          if (!room.owner_id) {
            this.ctx.storage.sql.exec("UPDATE rooms SET owner_id = ? WHERE id = ?", adminId, roomId);
          } else if (room.owner_id !== adminId) {
            return { success: false, error: "You do not own this room." };
          }
          this.send(ws, "room_key_info", { passkey: room.passkey });
        }

        if (role === "eo") {
          const active = this.getMeta(roomId, "eo_socket");
          if (active && active !== session.sid) {
            this.send(ws, "error", { message: "Room already has an active playback controller." });
            ws.close(1000, "eo taken");
            return SKIP;
          }
          this.setMeta(roomId, "eo_socket", session.sid);
          this.send(ws, "eo_registered", { success: true });
        }

        session.room = roomId;
        session.role = role;
        ws.serializeAttachment(session);

        this.send(ws, "now_playing_updated", this.nowPlaying(roomId));
        const playback = this.getMeta(roomId, "playback");
        if (playback) {
          this.send(ws, "playback_sync", JSON.parse(playback));
        } else {
          this.send(ws, "playback_updated", { isPlaying: this.getMeta(roomId, "isPlaying") === "true" });
        }
        this.send(ws, "queue_updated", this.queueWindow(roomId, role));
        return { success: true, mode: room.mode as Mode };
      }

      case "join_by_passkey": {
        if (!this.rate("passkey:" + session.sid, 8, 60_000)) {
          return { success: false, error: "Too many attempts. Please wait a moment." };
        }
        const row = this.ctx.storage.sql
          .exec("SELECT id FROM rooms WHERE passkey = ? LIMIT 1", str("passkey").trim())
          .toArray()[0] as { id: string } | undefined;
        return row ? { success: true, roomId: row.id } : { success: false, error: "Invalid room code. Please check with your Admin." };
      }

      case "get_now_playing":
        return { nowPlaying: this.nowPlaying(roomId) };

      case "get_queue_page": {
        const status = str("status");
        if (status !== "pending" && status !== "approved") return { success: false, error: "Missing fields" };
        if (!this.isAdminOf(session, roomId)) return { success: false, error: "Forbidden" };
        return { success: true, ...this.queuePage(roomId, status, Number(data.cursor ?? 0), Number(data.limit ?? 50)) };
      }

      // --------------------------------------------------------- participant
      case "search_songs": {
        const query = str("query").trim().toLowerCase().slice(0, 80);
        if (query.length < 2) return { success: true, results: [] };

        const cached = this.searchCache.get(query);
        if (cached) return { success: true, results: cached };

        if (!this.rate("search:" + session.sid, 1, 750)) {
          return { success: false, error: "Please wait before searching again" };
        }
        const results = await searchYouTube(query);
        if (this.searchCache.size >= RoomHub.SEARCH_CACHE_MAX) {
          const oldest = this.searchCache.keys().next().value;
          if (oldest !== undefined) this.searchCache.delete(oldest);
        }
        this.searchCache.set(query, results);
        return { success: true, results };
      }

      case "get_search_suggestions": {
        if (!this.rate("suggest:" + session.sid, 1, 350)) return { success: true, suggestions: [] };
        return { success: true, suggestions: await searchSuggestions(str("query")) };
      }

      case "submit_song": {
        const videoId = str("youtubeId");
        const title = str("title");
        if (!roomId || !videoId || !title) return { success: false, error: "Missing fields" };
        if (!this.rate("submit:" + session.sid, 1, 3000)) {
          return { success: false, error: "Please wait a moment before submitting again" };
        }
        if (!this.rate("submit-ip:" + session.sid, 12, 60_000)) {
          return { success: false, error: "Too many requests. Please slow down." };
        }
        if (!this.rate("submit-room:" + roomId, 10, 10_000)) {
          return { success: false, error: "Too many requests in this room, please slow down" };
        }

        const room = this.roomById(roomId);
        if (!room) return { success: false, error: "Room not found." };

        const song = this.insertSong(roomId, {
          youtubeId: videoId,
          title,
          author: str("author"),
          submittedBy: str("userId") || session.sid,
          status: room.mode === "party" ? "approved" : "pending",
        });

        if (song.status === "approved") {
          this.broadcast(roomId, "song_approved", song);
          this.broadcastQueue(roomId);
          return { success: true, message: "Added to the queue" };
        }
        this.broadcastRole(roomId, "admin", "new_pending_song", song);
        return { success: true, message: "Request submitted" };
      }

      // --------------------------------------------------------------- admin
      case "admin_login": {
        if (!this.rate("login:" + session.sid, 10, 60_000)) {
          return { success: false, error: "Too many attempts. Please wait a moment." };
        }
        const username = str("username");
        const password = str("password");
        if (!username || !password) return { success: false, error: "Missing credentials" };

        const admin = this.ctx.storage.sql
          .exec("SELECT id, username, email, password_hash, role, status FROM admins WHERE username = ? OR email = ?", username, username)
          .toArray()[0] as
          | { id: string; username: string; email: string; password_hash: string; role: string; status: string }
          | undefined;

        if (!admin) return { success: false, error: "Invalid credentials" };
        if (admin.status !== "active") {
          return {
            success: false,
            error:
              admin.status === "pending"
                ? "Your account is pending approval from the Head Admin."
                : "Your account has been suspended.",
          };
        }
        if (!(await verifyPassword(password, admin.password_hash))) {
          return { success: false, error: "Invalid credentials" };
        }

        const token = crypto.randomUUID();
        this.ctx.storage.sql.exec(
          "INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)",
          token,
          admin.id,
          Date.now() + 7 * 86_400_000,
        );
        return {
          success: true,
          token,
          user: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
        };
      }

      case "admin_authenticate": {
        const adminId = this.sessionAdmin(str("token"));
        if (!adminId) return { success: false };
        const admin = this.ctx.storage.sql
          .exec("SELECT id, username, email, role FROM admins WHERE id = ?", adminId)
          .toArray()[0];
        return admin ? { success: true, user: admin } : { success: false };
      }

      case "admin_logout":
        this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token = ?", str("token"));
        return { success: true };

      case "admin_register": {
        if (!this.rate("register:" + session.sid, 5, 3_600_000)) {
          return { success: false, error: "Too many registration attempts. Please try again later." };
        }
        const expected = this.env.ADMIN_INVITE_CODE;
        if (!expected) return { success: false, error: "Registration is currently disabled." };
        if (str("inviteCode") !== expected) return { success: false, error: "Invalid invite code." };

        const email = str("email");
        const username = str("username");
        const password = str("password");
        if (!email.toLowerCase().endsWith("@playit.com")) {
          return { success: false, error: "Only @playit.com corporate emails are allowed." };
        }
        if (!username || password.length < 6) return { success: false, error: "Invalid username or password" };

        const existing = this.ctx.storage.sql
          .exec("SELECT id FROM admins WHERE username = ? OR email = ?", username, email)
          .toArray();
        if (existing.length > 0) return { success: false, error: "Username or Email already registered" };

        const id = crypto.randomUUID();
        this.ctx.storage.sql.exec(
          "INSERT INTO admins (id, username, email, password_hash, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
          id,
          username,
          email,
          await hashPassword(password),
          Date.now(),
        );
        return {
          success: true,
          message: "Registration received. Please wait for Head Admin approval.",
          user: { id, username, email, status: "pending" },
        };
      }

      case "get_pending_admins": {
        const admin = this.requireSuperAdmin(str("adminToken"));
        if (!admin) return { success: false, error: "Unauthorized" };
        const admins = this.ctx.storage.sql
          .exec("SELECT id, username, email, createdAt FROM (SELECT id, username, email, created_at AS createdAt FROM admins WHERE status = 'pending' ORDER BY created_at DESC)")
          .toArray();
        return { success: true, admins };
      }

      case "approve_admin": {
        if (!this.requireSuperAdmin(str("adminToken"))) return { success: false, error: "Unauthorized" };
        this.ctx.storage.sql.exec("UPDATE admins SET status = 'active' WHERE id = ?", str("targetId"));
        return { success: true };
      }

      case "deny_admin": {
        if (!this.requireSuperAdmin(str("adminToken"))) return { success: false, error: "Unauthorized" };
        this.ctx.storage.sql.exec("DELETE FROM admins WHERE id = ? AND status = 'pending'", str("targetId"));
        return { success: true };
      }

      case "create_station": {
        const adminId = this.sessionAdmin(str("adminToken"));
        if (!adminId) return { success: false, error: "Unauthorized" };
        if (this.roomById(roomId)) return { success: false, error: "Station ID already in use" };

        const passkey = this.createRoom(roomId, str("adminToken"), str("mode"));
        const row = this.roomById(roomId);
        return { success: true, roomId, passkey, mode: row?.mode ?? "approval" };
      }

      case "get_my_stations": {
        const adminId = this.sessionAdmin(str("adminToken"));
        if (!adminId) return { success: false, error: "Unauthorized" };
        const stations = this.ctx.storage.sql
          .exec(
            `SELECT id, passkey, mode, createdAt FROM
             (SELECT id, passkey, mode, created_at AS createdAt FROM rooms WHERE owner_id = ? ORDER BY created_at DESC)`,
            adminId,
          )
          .toArray();
        return { success: true, stations };
      }

      // Deleting a station also has to evict anyone still connected to it, or a
      // listener keeps a socket bound to a room that no longer exists.
      case "delete_station": {
        const adminId = this.sessionAdmin(str("adminToken"));
        if (!adminId) return { success: false, error: "Unauthorized" };

        const target = str("roomId");
        const room = this.roomById(target);
        if (!room) return { success: false, error: "Station not found" };
        if (room.owner_id !== adminId) return { success: false, error: "You do not own this room" };

        this.broadcast(target, "station_deleted", { roomId: target });
        for (const [peer, peerSession] of this.sockets) {
          if (peerSession.room !== target) continue;
          peerSession.room = null;
          peerSession.role = null;
          peer.serializeAttachment(peerSession);
        }

        this.sql("DELETE FROM songs WHERE room_id = ?", target);
        this.sql("DELETE FROM meta WHERE room_id = ?", target);
        this.sql("DELETE FROM rooms WHERE id = ?", target);
        return { success: true };
      }

      case "approve_song": {
        if (!this.isAdminOf(session, roomId)) return { success: false, error: "Unauthorized" };
        const songId = str("songId");
        const existing = this.songById(songId);
        if (!existing) return { success: false, error: "Song not found or already processed" };

        // Approving is idempotent. A double click lands after the first has
        // already moved the song, and a failure here made the dashboard roll its
        // whole queue back to a snapshot taken before the click, dropping any
        // song approved in between.
        if (existing.status !== "pending") {
          if (existing.status === "approved" || existing.status === "playing") {
            return { success: true, message: "Song approved", song: existing };
          }
          return { success: false, error: "Song not found or already processed" };
        }

        this.sql("UPDATE songs SET status = 'approved', approved_at = ? WHERE id = ?", Date.now(), existing.id);
        const approved = { ...existing, status: "approved" as const };
        this.broadcast(roomId, "song_approved", approved);
        return { success: true, message: "Song approved", song: approved };
      }

      case "delete_song": {
        if (!this.isAdminOf(session, roomId)) return { success: false, error: "Unauthorized" };
        const songId = str("songId");
        const song = this.songById(songId);
        if (!song) return { success: false, error: "Song not found" };
        this.sql("DELETE FROM songs WHERE id = ?", songId);
        this.broadcast(roomId, "song_deleted", { songId });
        if (song.status === "playing") {
          this.setMeta(roomId, "nowPlaying", "");
          this.broadcast(roomId, "now_playing_updated", null);
        }
        this.broadcastQueue(roomId);
        return { success: true, message: "Song deleted" };
      }

      case "edit_song": {
        if (!this.isAdminOf(session, roomId)) return { success: false, error: "Unauthorized" };
        const songId = str("songId");
        const title = str("newTitle");
        if (!songId || !title) return { success: false, error: "Missing fields" };
        this.sql("UPDATE songs SET title = ? WHERE id = ?", title, songId);
        const song = this.songById(songId);
        if (!song) return { success: false, error: "Song not found" };
        this.broadcast(roomId, "song_updated", song);
        return { success: true, song };
      }

      case "clear_queue": {
        if (!this.isAdminOf(session, roomId)) return { success: false, error: "Unauthorized" };
        const cleared = this.ctx.storage.sql.exec(
          "UPDATE songs SET status = 'done', done_at = ? WHERE room_id = ? AND status IN ('pending','approved','playing')",
          Date.now(),
          roomId,
        ).rowsWritten;
        this.setMeta(roomId, "nowPlaying", "");
        this.broadcast(roomId, "queue_cleared", { roomId });
        this.broadcast(roomId, "now_playing_updated", null);
        this.broadcastQueue(roomId);
        return { success: true, clearedCount: cleared };
      }

      case "admin_add_song": {
        if (!this.isAdminOf(session, roomId)) return { success: false, error: "Unauthorized" };
        if (!str("youtubeId") || !str("title")) return { success: false, error: "Missing fields" };
        const song = this.insertSong(roomId, {
          youtubeId: str("youtubeId"),
          title: str("title"),
          author: str("author"),
          submittedBy: this.sessionAdmin(str("adminToken")) ?? session.sid,
          status: "approved",
        });
        this.broadcast(roomId, "song_approved", song);
        this.broadcastQueue(roomId);
        return { success: true, song };
      }

      // ------------------------------------------------------------- playback
      case "toggle_playback": {
        if (!this.isActiveEo(session, roomId)) return SKIP;
        const isPlaying = Boolean(data.isPlaying);
        this.setMeta(roomId, "isPlaying", String(isPlaying));
        const playback = { ...this.playback(roomId), isPlaying, updatedAt: Date.now() };
        this.setMeta(roomId, "playback", JSON.stringify(playback));
        this.broadcast(roomId, "playback_updated", { isPlaying });
        return SKIP;
      }

      case "sync_playback": {
        if (!this.isActiveEo(session, roomId)) return SKIP;
        const playback = {
          currentTime: Number(data.currentTime ?? 0),
          duration: Number(data.duration ?? 0),
          isPlaying: Boolean(data.isPlaying),
          updatedAt: Date.now(),
        };
        this.setMeta(roomId, "playback", JSON.stringify(playback));
        this.broadcast(roomId, "playback_sync", playback);
        return SKIP;
      }

      case "eo_track_ended": {
        if (!this.isActiveEo(session, roomId)) {
          return { success: false, error: "Unauthorized. You are not the active playback controller." };
        }
        const key = str("idempotencyKey") || crypto.randomUUID();
        const seen = this.getMeta(roomId, "lastTransition");
        if (seen === key) return { success: true };

        const transition = this.transition(roomId);
        this.setMeta(roomId, "lastTransition", key);
        this.broadcast(roomId, "track_transitioned", transition);
        this.broadcast(roomId, "now_playing_updated", transition.nextTrack);
        if (transition.nextTrack) {
          this.broadcast(roomId, "song_removed_from_queue", { songId: transition.nextTrack.id });
        }
        this.broadcastQueue(roomId);
        return { success: true, ...transition };
      }

      case "previous_track": {
        if (!this.isActiveEo(session, roomId)) return { success: false, error: "Unauthorized" };
        const result = this.previous(roomId);
        if (!result) return { success: false, error: "No previous track" };
        this.broadcast(roomId, "now_playing_updated", result.previousTrack);
        if (result.returnedTrack) this.broadcast(roomId, "song_approved", result.returnedTrack);
        this.broadcastQueue(roomId);
        return { success: true, previousTrack: result.previousTrack, hasPrevious: result.hasPrevious };
      }

      default:
        return { success: false, error: `Unhandled event: ${event}` };
    }
  }

  // ------------------------------------------------------------------- sql ---

  private sql(query: string, ...params: (string | number | null)[]) {
    return this.ctx.storage.sql.exec(query, ...params);
  }

  private roomById(roomId: string) {
    return this.ctx.storage.sql
      .exec("SELECT id, passkey, owner_id, mode FROM rooms WHERE id = ?", roomId)
      .toArray()[0] as { id: string; passkey: string; owner_id: string | null; mode: string } | undefined;
  }

  private roomList() {
    return this.ctx.storage.sql.exec("SELECT id FROM rooms").toArray();
  }

  private createRoom(roomId: string, adminToken: string, mode = "approval") {
    const passkey = this.newPasskey();
    this.sql(
      "INSERT INTO rooms (id, passkey, owner_id, mode, created_at) VALUES (?, ?, ?, ?, ?)",
      roomId,
      passkey,
      this.sessionAdmin(adminToken),
      mode === "party" ? "party" : "approval",
      Date.now(),
    );
    return passkey;
  }

  private newPasskey() {
    for (;;) {
      const bytes = crypto.getRandomValues(new Uint8Array(4));
      const value = String(10_000 + (new DataView(bytes.buffer).getUint32(0) % 90_000));
      const taken = this.ctx.storage.sql.exec("SELECT 1 FROM rooms WHERE passkey = ?", value).toArray();
      if (taken.length === 0) return value;
    }
  }

  private getMeta(roomId: string, key: string): string | null {
    const row = this.ctx.storage.sql
      .exec("SELECT value FROM meta WHERE room_id = ? AND key = ?", roomId, key)
      .toArray()[0] as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setMeta(roomId: string, key: string, value: string) {
    this.sql(
      "INSERT INTO meta (room_id, key, value) VALUES (?, ?, ?) ON CONFLICT(room_id, key) DO UPDATE SET value = excluded.value",
      roomId,
      key,
      value,
    );
  }

  private sessionAdmin(token: string): string | null {
    if (!token) return null;
    const row = this.ctx.storage.sql
      .exec("SELECT admin_id, expires_at FROM sessions WHERE token = ?", token)
      .toArray()[0] as { admin_id: string; expires_at: number } | undefined;
    if (!row) return null;
    if (row.expires_at < Date.now()) {
      this.sql("DELETE FROM sessions WHERE token = ?", token);
      return null;
    }
    return row.admin_id;
  }

  private requireSuperAdmin(token: string): string | null {
    const adminId = this.sessionAdmin(token);
    if (!adminId) return null;
    const row = this.ctx.storage.sql
      .exec("SELECT role FROM admins WHERE id = ?", adminId)
      .toArray()[0] as { role: string } | undefined;
    return row?.role === "super_admin" ? adminId : null;
  }

  /** Admin authority comes from the socket's own join, never from the payload. */
  private isAdminOf(session: Session, roomId: string): boolean {
    if (session.room !== roomId || session.role !== "admin") return false;
    const room = this.roomById(roomId);
    return Boolean(room?.owner_id);
  }

  private isActiveEo(session: Session, roomId: string): boolean {
    if (session.room !== roomId) return false;
    const active = this.getMeta(roomId, "eo_socket");
    if (!active) return session.role === "eo" || session.role === "admin";
    return active === session.sid;
  }

  private playback(roomId: string) {
    const raw = this.getMeta(roomId, "playback");
    return raw ? (JSON.parse(raw) as { currentTime: number; duration: number; isPlaying: boolean; updatedAt: number }) : { currentTime: 0, duration: 0, isPlaying: false, updatedAt: 0 };
  }

  // ----------------------------------------------------------------- songs ---

  private songById(songId: string): Song | null {
    return (this.ctx.storage.sql.exec(SONG_COLUMNS + " WHERE id = ?", songId).toArray()[0] as Song) ?? null;
  }

  private mutateSong(roomId: string, songId: string, mutate: (song: Song) => Song | null): Song | null {
    const song = this.songById(songId);
    if (!song) return null;
    return mutate(song);
  }

  private insertSong(
    roomId: string,
    input: { youtubeId: string; title: string; author: string; submittedBy: string; status: "pending" | "approved" },
  ): Song {
    const max = this.ctx.storage.sql
      .exec("SELECT COALESCE(MAX(position), 0) AS max FROM songs WHERE room_id = ?", roomId)
      .toArray()[0] as { max: number };
    const song: Song = {
      id: crypto.randomUUID(),
      youtubeId: input.youtubeId,
      title: input.title,
      author: input.author,
      status: input.status,
      submittedBy: input.submittedBy,
      createdAt: Date.now(),
      approvedAt: input.status === "approved" ? Date.now() : null,
      doneAt: null,
      position: max.max + 1,
    };
    this.sql(
      `INSERT INTO songs (id, room_id, youtube_id, title, author, status, submitted_by, created_at, approved_at, done_at, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      song.id,
      roomId,
      song.youtubeId,
      song.title,
      song.author,
      song.status,
      song.submittedBy,
      song.createdAt,
      song.approvedAt,
      null,
      song.position,
    );
    return song;
  }

  private nowPlaying(roomId: string): Song | null {
    const id = this.getMeta(roomId, "nowPlaying");
    if (!id) return null;
    return this.songById(id);
  }

  private queueWindow(roomId: string, role: Role) {
    const rows = this.ctx.storage.sql
      .exec(
        `${SONG_COLUMNS} WHERE room_id = ? AND status IN ('pending','approved') ORDER BY status = 'approved', position LIMIT 50`,
        roomId,
      )
      .toArray() as Song[];
    return role === "admin" ? rows : rows.filter((song) => song.status === "approved");
  }

  private queuePage(roomId: string, status: "pending" | "approved", cursor: number, limit: number) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const rows = this.ctx.storage.sql
      .exec(
        `${SONG_COLUMNS} WHERE room_id = ? AND status = ? ORDER BY position LIMIT ? OFFSET ?`,
        roomId,
        status,
        safeLimit + 1,
        Math.max(0, cursor),
      )
      .toArray() as Song[];
    const total = (
      this.ctx.storage.sql
        .exec("SELECT COUNT(*) AS n FROM songs WHERE room_id = ? AND status = ?", roomId, status)
        .toArray()[0] as { n: number }
    ).n;
    const items = rows.slice(0, safeLimit);
    return { items, total, nextCursor: rows.length > safeLimit ? cursor + items.length : null };
  }

  private transition(roomId: string) {
    const old = this.nowPlaying(roomId);
    const now = Date.now();

    if (old) {
      this.sql("UPDATE songs SET status = 'done', done_at = ? WHERE id = ?", now, old.id);
    }

    const next = this.ctx.storage.sql
      .exec(
        `${SONG_COLUMNS} WHERE room_id = ? AND status = 'approved' ORDER BY position LIMIT 1`,
        roomId,
      )
      .toArray()[0] as Song | undefined;

    if (next) {
      this.sql("UPDATE songs SET status = 'playing', approved_at = ? WHERE id = ?", now, next.id);
      this.setMeta(roomId, "nowPlaying", next.id);
    } else {
      this.setMeta(roomId, "nowPlaying", "");
      this.setMeta(roomId, "isPlaying", "false");
    }

    const upNext = this.ctx.storage.sql
      .exec(`${SONG_COLUMNS} WHERE room_id = ? AND status = 'approved' ORDER BY position LIMIT 1`, roomId)
      .toArray()[0] as Song | undefined;

    return {
      oldTrackId: old?.id ?? null,
      nextTrack: next ? { ...next, status: "playing" as const } : null,
      upNext: upNext ?? null,
    };
  }

  private previous(roomId: string) {
    const current = this.nowPlaying(roomId);
    const lastDone = this.ctx.storage.sql
      .exec(
        `${SONG_COLUMNS} WHERE room_id = ? AND status = 'done' ORDER BY done_at DESC LIMIT 1`,
        roomId,
      )
      .toArray()[0] as Song | undefined;
    if (!lastDone) return null;

    if (current) {
      this.sql("UPDATE songs SET status = 'approved', approved_at = ? WHERE id = ?", Date.now(), current.id);
    }
    this.sql("UPDATE songs SET status = 'playing', done_at = NULL WHERE id = ?", lastDone.id);
    this.setMeta(roomId, "nowPlaying", lastDone.id);

    const hasPrevious =
      this.ctx.storage.sql
        .exec("SELECT 1 FROM songs WHERE room_id = ? AND status = 'done' LIMIT 1", roomId)
        .toArray().length > 0;

    return {
      previousTrack: { ...lastDone, status: "playing" as const },
      returnedTrack: current ? { ...current, status: "approved" as const } : null,
      hasPrevious,
    };
  }

  private topTracks() {
    return this.ctx.storage.sql
      .exec(
        `SELECT youtube_id AS youtubeId, title, author, COUNT(*) AS requests
         FROM songs
         WHERE status IN ('approved','playing','done') AND created_at > ?
         GROUP BY youtube_id
         ORDER BY requests DESC, MAX(created_at) DESC
         LIMIT 10`,
        Date.now() - 7 * 86_400_000,
      )
      .toArray();
  }

  // ------------------------------------------------------------- broadcast ---

  private send(ws: WebSocket, event: string, payload: unknown) {
    try {
      ws.send(`42${JSON.stringify([event, payload])}`);
    } catch {
      // Socket closed between two sends; nothing to do.
    }
  }

  private inRoom(roomId: string, role?: Role): WebSocket[] {
    const sockets: WebSocket[] = [];
    for (const [ws, session] of this.sockets) {
      if (session.room !== roomId) continue;
      if (role && session.role !== role) continue;
      sockets.push(ws);
    }
    return sockets;
  }

  private broadcast(roomId: string, event: string, payload: unknown) {
    for (const ws of this.inRoom(roomId)) this.send(ws, event, payload);
  }

  private broadcastRole(roomId: string, role: Role, event: string, payload: unknown) {
    for (const ws of this.inRoom(roomId, role)) this.send(ws, event, payload);
  }

  /**
   * The queue snapshot after a change.
   *
   * Admins need the pending rows to moderate; everyone else only ever renders the
   * approved ones, and `applyQueueSnapshot` throws the rest away. Sending the
   * admin window to the whole room meant every listener received the titles of
   * other people's unapproved requests on every change.
   */
  private broadcastQueue(roomId: string) {
    const adminWindow = this.queueWindow(roomId, "admin");
    const approved = adminWindow.filter((song) => (song as { status?: string }).status !== "pending");
    this.broadcastRole(roomId, "admin", "queue_updated", adminWindow);
    this.broadcastRole(roomId, "participant", "queue_updated", approved);
    this.broadcastRole(roomId, "eo", "queue_updated", approved);
  }

  /** Sliding-window limiter. State lives in memory; losing it on eviction is fine. */
  private rate(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const hits = (this.rateLimits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (hits.length >= limit) {
      this.rateLimits.set(key, hits);
      return false;
    }
    hits.push(now);
    this.rateLimits.set(key, hits);
    return true;
  }

  /**
   * Drops rate-limit keys whose window has emptied.
   *
   * Keys are per socket (`submit:<sid>`, `search:<sid>`), so without this the map
   * kept one entry for every socket that ever connected. A new hit on an expired
   * key starts a fresh array anyway, so removing it loses nothing.
   */
  private pruneRateLimits(): void {
    const now = Date.now();
    for (const [key, hits] of this.rateLimits) {
      if (hits.length === 0 || now - hits[hits.length - 1] > RATE_KEY_TTL_MS) {
        this.rateLimits.delete(key);
      }
    }
  }
}

/** Every song read, so a row reaches the client with the names it expects. */
const SONG_COLUMNS =
  "SELECT id, youtube_id AS youtubeId, title, author, status, submitted_by AS submittedBy, " +
  "created_at AS createdAt, approved_at AS approvedAt, done_at AS doneAt, position FROM songs";

const SKIP = Symbol("skip");
