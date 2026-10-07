import type { IncomingMessage, ServerResponse } from "http";
import { getAudioStream } from "./index";

// 11-char YouTube ids only — also prevents this from becoming an open proxy.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(videoId: string): boolean {
  return VIDEO_ID_PATTERN.test(videoId);
}

// The signed googlevideo URL is bound to the resolver's IP, so the browser cannot
// fetch it directly (it 403s from any other IP and sends no CORS header).
// Streaming it through our own origin fixes both: same-origin for the browser,
// server IP for the upstream.
export async function proxyAudioStream(
  videoId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const stream = await getAudioStream(videoId);

  const range = req.headers.range;
  const upstream = await fetch(stream.url, {
    headers: range ? { Range: range } : {},
  });

  if (!upstream.ok && upstream.status !== 206) {
    throw new Error(`Upstream audio request failed (${upstream.status})`);
  }

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") || stream.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };

  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  if (contentLength) headers["Content-Length"] = contentLength;
  if (contentRange) headers["Content-Range"] = contentRange;

  res.writeHead(upstream.status, headers);

  if (!upstream.body) {
    res.end();
    return;
  }

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const reader = upstream.body.getReader();
  try {
    while (!closed) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      // Respect backpressure so a slow client cannot buffer the whole track.
      // Resolve on either drain or client disconnect, otherwise a client that
      // goes away mid-stream leaves this promise pending forever.
      if (!res.write(value)) {
        await new Promise<void>((resolve) => {
          const settle = () => {
            res.off("drain", settle);
            req.off("close", settle);
            resolve();
          };
          res.once("drain", settle);
          req.once("close", settle);
        });
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    if (!res.writableEnded) res.end();
  }
}
