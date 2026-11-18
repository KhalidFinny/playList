import { sql } from "../db/client";

export type RoomMode = "approval" | "party";

/**
 * How a room treats incoming requests. Unknown or missing rows resolve to the
 * default so a deleted room can never turn into an open queue.
 */
export async function getRoomMode(roomId: string): Promise<RoomMode> {
  const rows = await sql`SELECT mode FROM rooms WHERE id = ${roomId}`;
  return rows[0]?.mode === "party" ? "party" : "approval";
}

export function normalizeRoomMode(value: unknown): RoomMode {
  return value === "party" ? "party" : "approval";
}
