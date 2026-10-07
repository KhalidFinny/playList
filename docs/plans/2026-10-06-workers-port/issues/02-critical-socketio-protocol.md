# 02 — Socket.IO / Engine.IO protocol layer

**Severity:** critical

## Current Problem

The client uses `socket.io-client` (94 call sites across 8 files) with
`socket.emit(event, payload, ack)`. There is no Socket.IO server that runs on
Workers. Rewriting the client is the obvious fix and the wrong one: it touches
every feature file and collides with the active M3 UI thread.

## Target

Implement the Engine.IO v4 + Socket.IO v5 wire protocol over WebSocket inside the
Durable Object, plus thin `Socket`/`Server`-shaped adapters, so the existing
client and the 24 existing handlers work unchanged.

Pin the client to the websocket transport only (skips polling entirely):

```ts
// client/src/shared/lib/socket.ts — the ONLY client change
export const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || "", {
  autoConnect: false,
  transports: ["websocket"],
});
```

Wire format to implement:

```
Engine.IO:  0 open · 1 close · 2 ping · 3 pong · 4 message
Socket.IO:  0 CONNECT · 1 DISCONNECT · 2 EVENT · 3 ACK
EVENT:      42["join_room",{...}]
EVENT+ack:  421["join_room",{...}]   →  ack 431[{"success":true}]
```

Adapters provide the surface the handlers already use:

```ts
interface SocketLike {
  id: string;
  on(event: string, handler: (data: any, cb?: (res: any) => void) => void): void;
  emit(event: string, payload?: unknown): void;
  join(room: string): void;
  disconnect(): void;
}
interface ServerLike {
  to(room: string): { emit(event: string, payload?: unknown): void };
}
```

`callback(res)` serialises as a Socket.IO ACK for the matching packet id.

## Required Design

- Websocket transport only; no polling, no long-polling upgrade path.
- Server→client ping every 25s so Cloudflare's ~100s idle window never closes
  the socket (Cloudflare closes idle WebSockets on all plans).
- Use `state.acceptWebSocket()` + `webSocketMessage()`/`webSocketClose()`
  (Hibernation API) so idle rooms incur no duration.
- `io.to(roomId).emit(...)` and `socket.emit(...)` must both work; role rooms
  (`${roomId}:admin`, `:participant`, `:eo`) must keep working, including the
  existing cross-role broadcasts in `adminHandler`/`eoHandler`.
- Acks must be delivered exactly once and never leak across sockets.
- Keep packet parsing strict; a malformed frame closes only that socket.

## Tests

Not run by default. Verify with a raw websocket client: connect, receive the
`0{...}` open frame, send `40`, receive `40{"sid":...}`, then emit
`421["join_room",...]` and receive `431[...]`.

## Done Criteria

- [ ] `socket.io-client` connects over websocket and fires `connect`
- [ ] `join_room` with an ack returns `{ success: true }`
- [ ] `io.to(room).emit` reaches every socket in that room and role rooms
- [ ] Server ping keeps the connection alive past 100s idle
- [ ] A malformed frame closes only the offending socket
