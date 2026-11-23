import type { Server } from "socket.io";

import { getQueueWindow, type QueueSong } from "../services/liveQueue/index";

/**
 * The queue snapshot after a change.
 *
 * Admins need the pending rows to moderate. Everyone else only ever renders the
 * approved ones: `applyQueueSnapshot` on the client filters everything else out.
 * Broadcasting the admin window to the whole room meant every listener received
 * the titles of other people's unapproved requests on every change, and paid the
 * payload for rows it discarded.
 *
 * One Redis read, then two payloads from it, rather than reading the window twice.
 */
export async function broadcastQueue(io: Server, roomId: string): Promise<void> {
  const adminWindow = await getQueueWindow(roomId, "admin");
  const approved = adminWindow.filter((song: QueueSong) => song.status !== "pending");

  io.to(`${roomId}:admin`).emit("queue_updated", adminWindow);
  io.to(`${roomId}:participant`).emit("queue_updated", approved);
  io.to(`${roomId}:eo`).emit("queue_updated", approved);
}
