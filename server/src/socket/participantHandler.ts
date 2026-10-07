import { Server, Socket } from "socket.io";
import ytsort from "yt-search";
import { countPendingSongs, submitSong } from "../services/liveQueue/index";
import { normalizeSearchQuery, TtlLruCache } from "./searchCache";
import { actorIdOf } from "../lib/actor";
import { clientIpOf } from "../lib/clientIp";
import { RateLimiter } from "../lib/rateLimit";
import { registerPrunable } from "../lib/prune";

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_SIZE = 250;
const SUGGESTION_CACHE_TTL_MS = 60 * 1000;
const SUGGESTION_CACHE_MAX_SIZE = 200;

const searchCache = new TtlLruCache<any[]>(SEARCH_CACHE_TTL_MS, SEARCH_CACHE_MAX_SIZE);
const suggestionCache = new TtlLruCache<string[]>(SUGGESTION_CACHE_TTL_MS, SUGGESTION_CACHE_MAX_SIZE);

// --- Spam protection ---
//
// Every key here is server-derived. `actorId` is assigned per connection and
// `clientIp` comes from the Cloudflare header; neither can be rotated by the
// client. The client-supplied `userId` is used for attribution and for the
// pending-per-user guardrail only, never as the basis of a limit.
//
// Everything is a RateLimiter or TtlLruCache so one shared interval can prune
// it — the previous plain Maps grew forever.

const USER_COOLDOWN_MS = 3000;
const userCooldown = new RateLimiter(1, USER_COOLDOWN_MS);

// Search rate limits: per connection; the client debounce handles normal typing.
const SEARCH_COOLDOWN_MS = 750;
const SUGGESTION_COOLDOWN_MS = 350;
const searchCooldown = new RateLimiter(1, SEARCH_COOLDOWN_MS);
const suggestionCooldown = new RateLimiter(1, SUGGESTION_COOLDOWN_MS);

// Duplicate detection: same connection + same video within 60s.
const DUPLICATE_WINDOW_MS = 60_000;
const recentSubmissions = new TtlLruCache<{ videoId: string; at: number }[]>(DUPLICATE_WINDOW_MS, 500);

// Max pending requests per user per room (guardrail; backstopped by the IP limit).
const MAX_PENDING_PER_USER = 5;

// Max total pending songs per room.
const MAX_PENDING_PER_ROOM = 200;

// Per-room flood protection: max 10 requests per 10s.
const ROOM_FLOOD_WINDOW_MS = 10_000;
const ROOM_FLOOD_MAX = 10;
const roomFlood = new RateLimiter(ROOM_FLOOD_MAX, ROOM_FLOOD_WINDOW_MS);

// Per-IP submission limit: the durable backstop, unaffected by reconnecting or
// rotating the client-supplied userId.
const IP_SUBMIT_WINDOW_MS = 60_000;
const IP_SUBMIT_MAX = 12;
const ipSubmissions = new RateLimiter(IP_SUBMIT_MAX, IP_SUBMIT_WINDOW_MS);

// Soft-ban: 5 violations within 60s → blocked for 60s.
const SOFTBAN_THRESHOLD = 5;
const SOFTBAN_WINDOW_MS = 60_000;
const SOFTBAN_DURATION_MS = 60_000;
const violations = new TtlLruCache<{ count: number; at: number }>(SOFTBAN_WINDOW_MS, 500);
const softBans = new TtlLruCache<number>(SOFTBAN_DURATION_MS, 500);

registerPrunable(searchCache);
registerPrunable(suggestionCache);
registerPrunable(userCooldown);
registerPrunable(searchCooldown);
registerPrunable(suggestionCooldown);
registerPrunable(recentSubmissions);
registerPrunable(roomFlood);
registerPrunable(ipSubmissions);
registerPrunable(violations);
registerPrunable(softBans);

function isSoftBanned(clientIp: string): boolean {
  const until = softBans.get(clientIp);
  return until !== null && Date.now() < until;
}

function recordViolation(clientIp: string) {
  const now = Date.now();
  const record = violations.get(clientIp) ?? { count: 0, at: now };
  if (now - record.at > SOFTBAN_WINDOW_MS) {
    record.count = 0;
    record.at = now;
  }
  record.count++;
  violations.set(clientIp, record);

  if (record.count >= SOFTBAN_THRESHOLD) {
    softBans.set(clientIp, now + SOFTBAN_DURATION_MS);
    violations.set(clientIp, { count: 0, at: now });
    console.log(`[SPAM] IP ${clientIp} soft-banned for ${SOFTBAN_DURATION_MS / 1000}s`);
  }
}

function isDuplicate(actorId: string, videoId: string): boolean {
  const now = Date.now();
  const fresh = (recentSubmissions.get(actorId) ?? []).filter((s) => now - s.at < DUPLICATE_WINDOW_MS);
  const duplicate = fresh.some((s) => s.videoId === videoId);
  fresh.push({ videoId, at: now });
  recentSubmissions.set(actorId, fresh);
  return duplicate;
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

    // Rate limit searches per connection after cache lookup, so repeated cached queries stay cheap.
    if (!searchCooldown.take(actorIdOf(socket))) {
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

      if (!suggestionCooldown.take(actorIdOf(socket))) {
        callback({ success: true, suggestions: [] });
        return;
      }

      try {
        const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(normalizedQuery)}`;
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

      // --- Spam checks (all keyed on server-derived identity) ---

      const actorId = actorIdOf(socket);
      const clientIp = clientIpOf(socket);

      // 1. Soft-ban check (per IP — survives reconnect)
      if (isSoftBanned(clientIp)) {
        if (callback) callback({ success: false, error: "You are temporarily blocked. Please try again later." });
        return;
      }

      // 2. Per-IP submission limit — the durable backstop
      if (!ipSubmissions.take(clientIp)) {
        recordViolation(clientIp);
        if (callback) callback({ success: false, error: "Too many requests. Please slow down." });
        return;
      }

      // 3. Per-connection cooldown
      if (!userCooldown.take(actorId)) {
        recordViolation(clientIp);
        if (callback) callback({ success: false, error: "Please wait a moment before submitting again" });
        return;
      }

      // 4. Duplicate detection (same connection, same video)
      if (isDuplicate(actorId, youtubeId)) {
        if (callback) callback({ success: false, error: "You already requested this song recently" });
        return;
      }

      // 5. Max pending requests per user (guardrail; the client-supplied id is
      //    display metadata, so the IP limit above is the real enforcement)
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

      // 6. Max total pending songs in room
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

      // 7. Per-room flood protection
      if (!roomFlood.take(roomId)) {
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
