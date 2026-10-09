import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
  ASSETS: Fetcher;
}

/** Session state, kept on the WebSocket itself so it survives hibernation. */
type Session = {
  sid: string;
  room: string | null;
  role: "participant" | "admin" | "eo" | null;
};

/**
 * The Engine.IO heartbeat interval. Socket.IO's default, kept because it also
 * serves as the keepalive for Cloudflare's ~100s idle WebSocket close.
 */
const PING_INTERVAL_MS = 25_000;

/** The literal Engine.IO frames for the heartbeat. */
const EIO_PING = "2";
const EIO_PONG = "3";

/**
 * One room: its WebSockets, and (once issue 04 lands) its queue in SQLite.
 *
 * **Built on the Hibernation API, and that is not an optimisation.** A Durable
 * Object is billed for wall-clock time while it is in memory and not eligible to
 * hibernate — 86,400s × 128 MB/GB = 10,800 GB-s for a single room held for a day,
 * against a 13,000 GB-s/day free allowance. Two un-hibernated rooms exhaust it.
 * With hibernation an idle object is not billed at all.
 *
 * Three things make that work, and all three have to stay:
 *
 *   1. `ctx.acceptWebSocket()`, not `ws.accept()`, and the
 *      `webSocketMessage`/`webSocketClose`/`webSocketError` handlers, not
 *      `addEventListener`. Retrofitting these is a rewrite, so they are here from
 *      the start.
 *   2. Connection state on the socket via `serializeAttachment()`, rebuilt in the
 *      constructor with `ctx.getWebSockets()`, because the object is destroyed
 *      while its sockets live on.
 *   3. `setWebSocketAutoResponse()` for the heartbeat, so a ping does not wake the
 *      object at all.
 */
export class RoomDO extends DurableObject<Env> {
  /** Live sessions, rebuilt from the sockets on every wake. */
  private sessions = new Map<WebSocket, Session>();

  /**
   * Counts frames that reached `webSocketMessage`. Exposed on `/stats` so a test
   * can prove the heartbeat is answered by the runtime and never arrives here.
   */
  private messagesHandled = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // The object can be evicted while its WebSockets stay open, so the session
    // map is rebuilt from the attachments the runtime kept.
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Session | null;
      if (attachment) this.sessions.set(ws, attachment);
    }

    // Engine.IO's ping is the literal frame "2" and its pong is "3". Answering it
    // here means the heartbeat costs no compute and does not wake the object.
    // Pricing footnote 3: auto-response messages "will not incur additional
    // wall-clock time, and so they will not be charged."
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(EIO_PING, EIO_PONG));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Verification surface: proves the heartbeat never reaches this object.
    if (url.pathname.endsWith("/stats")) {
      return Response.json({
        messagesHandled: this.messagesHandled,
        connections: this.ctx.getWebSockets().length,
        sessions: this.sessions.size,
      });
    }

    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernatable accept. The runtime keeps this socket alive across eviction.
    this.ctx.acceptWebSocket(server);

    const session: Session = { sid: crypto.randomUUID(), room: null, role: null };
    server.serializeAttachment(session);
    this.sessions.set(server, session);

    // Engine.IO open. `upgrades` is empty because this server is websocket-only.
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

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    this.messagesHandled++;
    const frame = typeof raw === "string" ? raw : new TextDecoder().decode(raw);

    // Socket.IO frames are 4 (message) + a sub-type: 40 CONNECT, 41 DISCONNECT,
    // 42 EVENT, 43 ACK. Parsing only the first character lumps them together.
    const prefix = frame.slice(0, 2);

    if (prefix === "40") {
      const session = this.sessions.get(ws);
      ws.send(`40${JSON.stringify({ sid: session?.sid ?? "" })}`);
      return;
    }

    if (prefix === "41") {
      ws.close(1000, "client disconnect");
      return;
    }

    if (prefix === "42") {
      this.handleEvent(ws, frame.slice(2));
    }
  }

  /**
   * `421["join_room",{...}]` — a Socket.IO EVENT with ack id 1. The ack is
   * `431[<result>]`. Only `join_room` is implemented here: this is the scaffold
   * that proves the protocol and the hibernation shape, not the handler port.
   */
  private handleEvent(ws: WebSocket, body: string): void {
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

    const ack = (result: unknown) => {
      if (ackId) ws.send(`43${ackId}[${JSON.stringify(result)}]`);
    };

    if (event === "join_room") {
      const session = this.sessions.get(ws);
      const roomId = typeof data.roomId === "string" ? data.roomId : null;
      if (session && roomId) {
        session.room = roomId;
        session.role = (data.role as Session["role"]) ?? null;
        ws.serializeAttachment(session);
      }
      ack({ success: Boolean(roomId) });
      return;
    }

    ack({ success: false, error: `Unhandled event: ${event}` });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
    ws.close(1000, "closed");
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }
}
