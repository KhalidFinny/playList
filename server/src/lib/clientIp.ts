import type { Socket } from "socket.io";

// The server runs behind a Cloudflare Tunnel, so the TCP peer is always
// localhost. The real caller is only visible in the proxy headers, and
// `cf-connecting-ip` is set by Cloudflare itself (not spoofable by the client).
export function clientIpOf(socket: Socket): string {
  const headers = socket.handshake.headers;

  const cfConnectingIp = headers["cf-connecting-ip"];
  if (typeof cfConnectingIp === "string" && cfConnectingIp.length > 0) {
    return cfConnectingIp;
  }

  const forwardedFor = headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return socket.handshake.address || "unknown";
}
