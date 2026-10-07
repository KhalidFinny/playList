import type { Socket } from "socket.io";

// A server-assigned identity for the connection. The client's `userId` comes
// from localStorage and is trivially rotated, so it must never key a limit.
//
// socket.io types `socket.data` as `any` by default; this reads it back with a
// runtime check rather than widening the Server generics across the codebase.
export function assignActorId(socket: Socket): string {
  const actorId = crypto.randomUUID();
  socket.data.actorId = actorId;
  return actorId;
}

export function actorIdOf(socket: Socket): string {
  const actorId: unknown = socket.data?.actorId;
  if (typeof actorId === "string" && actorId.length > 0) return actorId;
  // Handlers only run after assignActorId, so this is a defensive fallback.
  return socket.id;
}
