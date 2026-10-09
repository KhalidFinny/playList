import { RoomDO } from "./room-do";

export { RoomDO };

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
  ASSETS: Fetcher;
}

/**
 * Worker entry.
 *
 * `/socket.io` goes to the room's Durable Object; everything else is the built
 * SPA. The room has to be known **before** the WebSocket is accepted, because a
 * Durable Object is chosen by name — hence the `?roomId=` query parameter. That
 * is the one client-side change the port needs (see issue 02).
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/socket.io")) {
      const roomId = url.searchParams.get("roomId") ?? "lobby";
      return env.ROOM.get(env.ROOM.idFromName(roomId)).fetch(req);
    }

    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
