import { Server, Socket } from "socket.io";
import ytsort from "yt-search";
import { countPendingSongs, submitSong } from "../services/liveQueue/index";
import { normalizeSearchQuery, TtlLruCache } from "./searchCache";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_SIZE = 250;
const SUGGESTION_CACHE_TTL_MS = 60 * 1000;
const SUGGESTION_CACHE_MAX_SIZE = 200;

const searchCache = new TtlLruCache<any[]>(SEARCH_CACHE_TTL_MS, SEARCH_CACHE_MAX_SIZE);
const suggestionCache = new TtlLruCache<string[]>(SUGGESTION_CACHE_TTL_MS, SUGGESTION_CACHE_MAX_SIZE);

const cacheCleanupTimer = setInterval(() => {
  const now = Date.now();
  searchCache.deleteExpired(now);
  suggestionCache.deleteExpired(now);
}, 60_000);
cacheCleanupTimer.unref?.();

// --- Spam protection ---

// Per-user rate limit: only one request every N ms
const USER_COOLDOWN_MS = 3000;
const lastRequestTime = new Map<string, number>();

// Search rate limit: per-socket; client debounce handles normal typing.
const SEARCH_COOLDOWN_MS = 750;
const SUGGESTION_COOLDOWN_MS = 350;
const lastSearchTime = new Map<string, number>();
const lastSuggestionTime = new Map<string, number>();

// Duplicate detection: same user + same video within 60s
const DUPLICATE_WINDOW_MS = 60_000;
const recentSubmissions = new Map<string, { videoId: string; at: number }[]>();

// Max pending requests per user per room
const MAX_PENDING_PER_USER = 5;

// Max total pending songs per room
const MAX_PENDING_PER_ROOM = 200;

// Per-room global flood protection: max 10 requests per 10s
const ROOM_FLOOD_WINDOW_MS = 10_000;
const ROOM_FLOOD_MAX = 10;
const roomRequestLog = new Map<string, number[]>();

// Soft-ban: 5 violations within 60s → blocked for 60s
const SOFTBAN_THRESHOLD = 5;
const SOFTBAN_WINDOW_MS = 60_000;
const SOFTBAN_DURATION_MS = 60_000;
const violationLog = new Map<string, { count: number; at: number }>();
const softbannedUsers = new Map<string, number>();

function isSoftBanned(userId: string): boolean {
  const until = softbannedUsers.get(userId);
  if (until) {
    if (Date.now() < until) return true;
    softbannedUsers.delete(userId);
  }
  return false;
}

function recordViolation(userId: string) {
  const now = Date.now();
  const record = violationLog.get(userId) || { count: 0, at: now };
  // Reset if window expired
  if (now - record.at > SOFTBAN_WINDOW_MS) {
    record.count = 0;
    record.at = now;
  }
  record.count++;
  violationLog.set(userId, record);

  if (record.count >= SOFTBAN_THRESHOLD) {
    softbannedUsers.set(userId, now + SOFTBAN_DURATION_MS);
    violationLog.delete(userId);
    console.log(`[SPAM] User ${userId} soft-banned for ${SOFTBAN_DURATION_MS / 1000}s`);
  }
}

function isUserRateLimited(userId: string): boolean {
  const last = lastRequestTime.get(userId);
  if (last && Date.now() - last < USER_COOLDOWN_MS) return true;
  lastRequestTime.set(userId, Date.now());
  return false;
}

function isSearchRateLimited(socketId: string): boolean {
  const last = lastSearchTime.get(socketId);
  if (last && Date.now() - last < SEARCH_COOLDOWN_MS) return true;
  lastSearchTime.set(socketId, Date.now());
  return false;
}

function isSuggestionRateLimited(socketId: string): boolean {
  const last = lastSuggestionTime.get(socketId);
  if (last && Date.now() - last < SUGGESTION_COOLDOWN_MS) return true;
  lastSuggestionTime.set(socketId, Date.now());
  return false;
}

function isDuplicate(userId: string, videoId: string): boolean {
  const userSubs = recentSubmissions.get(userId) || [];
  const now = Date.now();
  const fresh = userSubs.filter(s => now - s.at < DUPLICATE_WINDOW_MS);
  const dup = fresh.some(s => s.videoId === videoId);
  fresh.push({ videoId, at: now });
  recentSubmissions.set(userId, fresh);
  return dup;
}

function isRoomFlooded(roomId: string): boolean {
  const now = Date.now();
  const log = roomRequestLog.get(roomId) || [];
  const fresh = log.filter(t => now - t < ROOM_FLOOD_WINDOW_MS);
  if (fresh.length >= ROOM_FLOOD_MAX) return true;
  fresh.push(now);
  roomRequestLog.set(roomId, fresh);
  return false;
}

export function handleParticipantEvents(io: Server, socket: Socket) {
  // Search for songs on YouTube
  socket.on("search_songs", async (data: { query: string }, callback) => {
    const normalizedQuery = normalizeSearchQuery(data.query ?? "");
    if (normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
      if (callback) callback({ success: true, results: [] });
      return;
    }

    const cached = searchCache.get(normalizedQuery);
    if (cached) {
      console.log(`Cache Hit for: "${normalizedQuery}"`);
      return callback({ success: true, results: cached });
    }

    // Rate limit searches per socket after cache lookup, so repeated cached queries stay cheap.
    if (isSearchRateLimited(socket.id)) {
      if (callback) callback({ success: false, error: "Please wait before searching again" });
      return;
    }

    try {
      const refinedQuery = `${normalizedQuery} official audio`;
      console.log(`Searching YouTube via yt-search for: "${refinedQuery}"`);
      const r = await ytsort(refinedQuery);

      const tracks = r.videos.slice(0, 15).map((item: any) => ({
        id: item.videoId,
        youtubeId: item.videoId,
        title: item.title,
        thumbnail: item.thumbnail || item.image,
        duration: item.duration.timestamp,
        author: item.author?.name,
      }));

      searchCache.set(normalizedQuery, tracks);

      console.log(`Found ${tracks.length} videos via yt-search for "${normalizedQuery}"`);

      if (tracks.length === 0) {
        return callback({
          success: false,
          error: "No results found on YouTube",
        });
      }

      callback({ success: true, results: tracks });
    } catch (err) {
      console.error("Search error details:", err);
      callback({
        success: false,
        error: "YouTube search is currently unavailable",
      });
    }
  });

  // Get fast search suggestions (YouTube Autocomplete)
  socket.on(
    "get_search_suggestions",
    async (data: { query: string }, callback) => {
      const normalizedQuery = normalizeSearchQuery(data.query ?? "");
      if (normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
        if (callback) callback({ success: true, suggestions: [] });
        return;
      }

      const cached = suggestionCache.get(normalizedQuery);
      if (cached) {
        callback({ success: true, suggestions: cached });
        return;
      }

      if (isSuggestionRateLimited(socket.id)) {
        callback({ success: true, suggestions: [] });
        return;
      }

      try {
        const url = `http://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(normalizedQuery)}`;
        const response = await fetch(url);
        const text = await response.text();

        // YouTube returns a weird JSON-ish format: window.google.ac.h(["query",[["suggestion1",0],["suggestion2",0],...]])
        // But with client=youtube it's usually: ["query",["suggestion1","suggestion2",...]]
        const json = JSON.parse(text.replace(/^[^(]*\(|\)[^)]*$/g, ""));
        const rawSuggestions = json[1] || [];
        const suggestions = rawSuggestions.map((item: any) =>
          Array.isArray(item) ? item[0] : item,
        );

        const limitedSuggestions = suggestions.slice(0, 8);
        suggestionCache.set(normalizedQuery, limitedSuggestions);
        callback({ success: true, suggestions: limitedSuggestions });
      } catch (err) {
        callback({ success: false, suggestions: [] });
      }
    },
  );

  // Submit song request
  socket.on(
    "submit_song",
    async (
      data: {
        roomId: string;
        youtubeId: string;
        title: string;
        author: string;
        userId: string;
      },
      callback,
    ) => {
      const { roomId, youtubeId, title, author, userId } = data;

      if (!roomId || !youtubeId || !title || !userId) {
        if (callback) callback({ success: false, error: "Missing fields" });
        return;
      }

      // --- Spam checks ---

      // 1. Soft-ban check
      if (isSoftBanned(userId)) {
        if (callback) callback({ success: false, error: "You are temporarily blocked. Please try again later." });
        return;
      }

      // 2. Per-user rate limit
      if (isUserRateLimited(userId)) {
        recordViolation(userId);
        if (callback) callback({ success: false, error: "Please wait a moment before submitting again" });
        return;
      }

      // 3. Duplicate detection (same user, same video)
      if (isDuplicate(userId, youtubeId)) {
        if (callback) callback({ success: false, error: "You already requested this song recently" });
        return;
      }

      // 4. Max pending requests per user
      try {
        const pendingCount = await countPendingSongs(roomId, userId);
        if (pendingCount >= MAX_PENDING_PER_USER) {
          if (callback) callback({ success: false, error: `You can only have ${MAX_PENDING_PER_USER} pending requests at a time` });
          return;
        }
      } catch (err) {
        console.error(err);
        if (callback) callback({ success: false, error: "Database error" });
        return;
      }

      // 5. Max total pending songs in room
      try {
        const totalPending = await countPendingSongs(roomId);
        if (totalPending >= MAX_PENDING_PER_ROOM) {
          if (callback) callback({ success: false, error: "This room's request queue is full right now" });
          return;
        }
      } catch (err) {
        console.error(err);
        if (callback) callback({ success: false, error: "Database error" });
        return;
      }

      // 6. Per-room flood protection
      if (isRoomFlooded(roomId)) {
        if (callback) callback({ success: false, error: "Too many requests in this room, please slow down" });
        return;
      }

      try {
        const newSong = await submitSong(roomId, {
          id: crypto.randomUUID(),
          youtubeId,
          title,
          author: author || "",
          submittedBy: userId,
          createdAt: new Date().toISOString(),
        });

        console.log(`[QUEUE] New song submitted for room ${roomId}: ${newSong.title}`);

        io.to(`${roomId}:admin`).emit("new_pending_song", newSong);

        if (callback) callback({ success: true, message: "Request submitted" });
      } catch (err) {
        console.error(err);
        if (callback) callback({ success: false, error: "Database error" });
      }
    },
  );
}
