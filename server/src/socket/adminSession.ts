// Which rooms a socket is an authenticated admin of.
//
// `join_room` already validates the admin token and room ownership, but the
// admin mutations (approve/delete/edit) never re-checked it — any socket that
// knew a room id could moderate it. The client does not send a token on those
// events, so the grant is tracked here at join time instead.
//
// Keyed by the socket object in a WeakMap: no cleanup needed, and no `any`.

const adminRoomsBySocket = new WeakMap<object, Set<string>>();

export function grantAdminRoom(socket: object, roomId: string): void {
  const rooms = adminRoomsBySocket.get(socket) ?? new Set<string>();
  rooms.add(roomId);
  adminRoomsBySocket.set(socket, rooms);
}

export function isAdminForRoom(socket: object, roomId: string): boolean {
  return adminRoomsBySocket.get(socket)?.has(roomId) ?? false;
}
