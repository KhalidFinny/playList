import { Server } from "socket.io";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { join, normalize, resolve, sep } from "path";
import { setupDatabase } from "./src/db/schema";
import { getAudioStream } from "./src/services/preview";
import { isValidVideoId, proxyAudioStream } from "./src/services/preview/proxy";
import { getTopTracks } from "./src/services/topTracks";
import { handleConnection } from "./src/socket/connectionHandler";
import { handleParticipantEvents } from "./src/socket/participantHandler";
import { handleAdminEvents } from "./src/socket/adminHandler";
import { handleEOEvents } from "./src/socket/eoHandler";
import { handleAuthEvents } from "./src/socket/authHandler";
import { startDbPersistenceWorker } from "./src/workers/dbEvents";
import { startMaintenance } from "./src/workers/maintenance";
import { assignActorId } from "./src/lib/actor";
import { startPruning } from "./src/lib/prune";
import { metrics } from "./src/lib/metrics";

// Verify environment before starting
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

// Create HTTP server so we can add custom API routes alongside Socket.IO
const httpServer = createServer();

// Built Vite client (SPA). Served from this same origin in production so the
// app, Socket.IO, and the preview API all live behind one Cloudflare host.
const CLIENT_DIST = process.env.CLIENT_DIST || resolve(import.meta.dir, "../client/dist");
const CLIENT_INDEX = join(CLIENT_DIST, "index.html");

async function serveClient(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }

  const sendFile = async (filePath: string, cacheControl: string) => {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return false;

    const body = Buffer.from(await file.arrayBuffer());
    res.writeHead(200, {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": body.byteLength,
      "Cache-Control": cacheControl,
    });
    if (req.method === "HEAD") res.end();
    else res.end(body);
    return true;
  };

  const candidate = normalize(join(CLIENT_DIST, pathname));
  if (candidate === CLIENT_DIST || candidate.startsWith(CLIENT_DIST + sep)) {
    const cacheControl = pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    if (await sendFile(candidate, cacheControl)) return true;
  }

  // SPA fallback: let the client router handle unknown paths.
  return sendFile(CLIENT_INDEX, "no-cache");
}

httpServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Time every HTTP response. `finish` fires once the body is flushed, so this
  // measures what the client actually waited for.
  const startedAt = performance.now();
  res.on("finish", () => {
    metrics.count("http.requests");
    metrics.count(`http.status.${Math.floor(res.statusCode / 100)}xx`);
    metrics.observe("http.ms", performance.now() - startedAt);
  });

  // CORS headers for all API responses
  const setCORS = () => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  // Metrics. **Fail closed**: with no METRICS_TOKEN configured the route does
  // not exist, so an unconfigured production process cannot leak load shape.
  // A loopback check is not enough here — the Cloudflare tunnel connects to this
  // server over localhost, so every public request also arrives from 127.0.0.1.
  if (url.pathname === "/api/metrics") {
    const token = process.env.METRICS_TOKEN;
    const provided =
      url.searchParams.get("token") ??
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    if (provided !== token) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const wantsPrometheus = (req.headers.accept || "").includes("text/plain");
    res.writeHead(200, {
      "Content-Type": wantsPrometheus ? "text/plain; charset=utf-8" : "application/json",
      "Cache-Control": "no-store",
    });
    res.end(wantsPrometheus ? metrics.renderPrometheus() : JSON.stringify(metrics.snapshot()));
    return;
  }

  // Preview audio. The client fetches a URL and plays it in an <audio> element
  // with setSinkId(). We hand back a SAME-ORIGIN stream URL rather than the raw
  // googlevideo URL: that URL is IP-locked to this server and sends no CORS
  // header, so the browser could neither play it nor route it to a speaker.
  if (url.pathname.startsWith("/api/preview/")) {
    const [videoId = "", action] = url.pathname.slice("/api/preview/".length).split("/");

    if (!isValidVideoId(videoId)) {
      setCORS();
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid video ID" }));
      return;
    }

    try {
      if (action === "stream") {
        await proxyAudioStream(videoId, req, res);
        return;
      }

      const stream = await getAudioStream(videoId);
      setCORS();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          url: `/api/preview/${videoId}/stream`,
          mimeType: stream.mimeType,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[PREVIEW] Failed for ${videoId}:`, message);
      // Headers are already sent once streaming has started.
      if (!res.headersSent) {
        setCORS();
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to get audio stream" }));
      } else if (!res.writableEnded) {
        res.end();
      }
    }
    return;
  }

  // Socket.IO owns its own path.
  if (url.pathname.startsWith("/socket.io/")) return;

  // The week's most-played tracks. Public and identical for everyone: it is a
  // chart, so it carries no per-user or per-room state.
  if (url.pathname === "/api/top-tracks") {
    try {
      const tracks = await getTopTracks();
      setCORS();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tracks }));
    } catch (err) {
      console.error("[TOP-TRACKS] Failed:", err instanceof Error ? err.message : err);
      setCORS();
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to load top tracks" }));
    }
    return;
  }

  // Unknown API routes should 404 rather than fall back to the SPA.
  if (url.pathname.startsWith("/api/")) {
    setCORS();
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Serve the built SPA (with history fallback) when a build is present.
  if (await serveClient(req, res)) return;

  // Let all other requests pass through to Socket.IO
});

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://playlist.fiinnyy.my.id,http://localhost:5173,http://localhost:21010"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
  },
});

// Every Engine.IO packet the server RECEIVES becomes one Durable Object request
// once this runs on Workers — the heartbeat included. That is why inbound
// packets are counted on their own: the free-plan verdict turns on this number,
// not on the application events.
io.engine.on("connection", (rawSocket) => {
  metrics.gauge("ws.connections", io.engine.clientsCount);
  rawSocket.on("packet", (packet: { type: string }) => {
    metrics.count("ws.inbound_packets");
    metrics.count(`ws.inbound.${packet.type}`);
  });
});

// CPU and memory, sampled. `cpuUsage` is cumulative, so the delta over the
// interval is the live figure.
let lastCpu = process.cpuUsage();
let lastSampleAt = Date.now();
const sampleTimer = setInterval(() => {
  const now = Date.now();
  const cpu = process.cpuUsage(lastCpu);
  const elapsedMs = now - lastSampleAt;
  if (elapsedMs > 0) {
    metrics.gauge("process.cpu_percent", Number((((cpu.user + cpu.system) / 1000 / elapsedMs) * 100).toFixed(1)));
  }
  lastCpu = process.cpuUsage();
  lastSampleAt = now;
  metrics.gauge("process.rss_bytes", process.memoryUsage().rss);
  metrics.gauge("ws.connections", io.engine.clientsCount);
}, 5000);
sampleTimer.unref?.();

io.on("connection", (socket) => {
  // Server-assigned identity for this connection. Set before any handler so the
  // rate limits never have to fall back to a client-supplied id.
  assignActorId(socket);

  // Time and count every handler by event name. Wrapping the registration
  // covers all 24 handlers at once; wrapping each call site would rot.
  const register = socket.on.bind(socket);
  socket.on = ((event: string, handler: (...args: unknown[]) => unknown) =>
    register(event, (...args: unknown[]) => {
      metrics.count(`socket.${event}`);
      const start = performance.now();
      let result: unknown;
      try {
        result = handler(...args);
      } catch (err) {
        metrics.count(`socket.${event}.error`);
        metrics.observe("socket.ms", performance.now() - start);
        throw err;
      }
      if (result instanceof Promise) {
        return result.then(
          (value) => {
            metrics.observe("socket.ms", performance.now() - start);
            return value;
          },
          (err) => {
            metrics.count(`socket.${event}.error`);
            metrics.observe("socket.ms", performance.now() - start);
            throw err;
          },
        );
      }
      metrics.observe("socket.ms", performance.now() - start);
      return result;
    })) as typeof socket.on;

  // 1. Connection & room joining logic
  handleConnection(io, socket);

  // 2. Role-specific logic
  handleAuthEvents(io, socket);
  handleParticipantEvents(io, socket);
  handleAdminEvents(io, socket);
  handleEOEvents(io, socket);
});

const PORT = Number(process.env.PORT) || 3001;

// Setup database then start server
setupDatabase()
  .then(() => {
    startDbPersistenceWorker();
    startMaintenance();
    startPruning();
    httpServer.listen(PORT);
    console.log(`🎵 Music Queue Server running on http://localhost:${PORT}`);
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
