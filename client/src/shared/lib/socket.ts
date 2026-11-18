import { io, type Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

// Singleton socket instance
// Socket.IO over WebSocket only: the Cloudflare Worker speaks the protocol in a
// Durable Object and has no HTTP long-polling transport to upgrade from.
export const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || "", {
  autoConnect: false,
  transports: ["websocket"],
});

// User Identity Persistence
export const getUserId = () => {
  let userId = localStorage.getItem("music_queue_user_id");
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem("music_queue_user_id", userId);
  }
  return userId;
};
