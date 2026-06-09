import "dotenv/config";
import { Server } from "socket.io";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { execFile } from "child_process";
import { setupDatabase } from "./src/db/schema";
import { handleConnection } from "./src/socket/connectionHandler";
import { handleParticipantEvents } from "./src/socket/participantHandler";
import { handleAdminEvents } from "./src/socket/adminHandler";
import { handleEOEvents } from "./src/socket/eoHandler";
import { handleAuthEvents } from "./src/socket/authHandler";

// Verify environment before starting
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

// Create HTTP server so we can add custom API routes alongside Socket.IO
const httpServer = createServer();

// Preview audio endpoint — returns the direct YouTube audio stream URL
// so the client can play it in an <audio> element with setSinkId()
const YT_DLP_PATH = process.env.YT_DLP_PATH || "./bin/yt-dlp";

// Simple in-memory cache for stream URLs (5 minute TTL)
const streamUrlCache = new Map<string, { url: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

httpServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // CORS headers for all API responses
  const setCORS = () => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  if (url.pathname.startsWith("/api/preview/")) {
    const videoId = url.pathname.split("/api/preview/")[1];
    if (!videoId) {
      setCORS();
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing video ID" }));
      return;
    }

    // Check cache
    const cached = streamUrlCache.get(videoId);
    if (cached && cached.expires > Date.now()) {
      setCORS();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ url: cached.url }));
      return;
    }

    try {
      console.log(`[PREVIEW] Fetching audio URL for video: ${videoId}`);

      // Run yt-dlp to get the direct audio stream URL
      const audioUrl = await new Promise<string>((resolve, reject) => {
        execFile(
          YT_DLP_PATH,
          [
            "--get-url",
            "-f", "bestaudio",
            "--no-check-certificates",
            `https://www.youtube.com/watch?v=${videoId}`,
          ],
          { timeout: 20000, maxBuffer: 1024 * 1024 },
          (err, stdout) => {
            if (err) reject(new Error(`yt-dlp failed: ${err.message}`));
            else resolve(stdout.trim());
          },
        );
      });

      if (!audioUrl) {
        throw new Error("No audio URL returned from yt-dlp");
      }

      // Cache it
      streamUrlCache.set(videoId, { url: audioUrl, expires: Date.now() + CACHE_TTL });

      console.log(`[PREVIEW] Got audio URL for ${videoId}: ${audioUrl.slice(0, 60)}...`);

      setCORS();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ url: audioUrl }));
    } catch (err: any) {
      console.error(`[PREVIEW] Failed for ${videoId}:`, err.message);
      setCORS();
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to get audio stream" }));
    }
    return;
  }

  // Let all other requests pass through to Socket.IO
});

const io = new Server(httpServer, {
  cors: {
    origin: ["https://playlist.fiinnyy.my.id", "http://localhost:5173"],
  },
});

io.on("connection", (socket) => {
  // 1. Connection & room joining logic
  handleConnection(io, socket);

  // 2. Role-specific logic
  handleAuthEvents(io, socket);
  handleParticipantEvents(io, socket);
  handleAdminEvents(io, socket);
  handleEOEvents(io, socket);
});

const PORT = 3001;

// Setup database then start server
setupDatabase()
  .then(() => {
    httpServer.listen(PORT);
    console.log(`🎵 Music Queue Server running on http://localhost:${PORT}`);
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
