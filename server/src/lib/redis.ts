import Redis from "ioredis";
import { metrics } from "./metrics";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

export const redis = new Redis(redisUrl, redisOptions);
export const dbEventRedisReader = new Redis(redisUrl, redisOptions);

// Count Redis commands by name. Every queue transition, room lookup and playback
// sync goes through here, so this is the cheapest place to see the shape of the
// load without touching a call site.
const originalSendCommand = redis.sendCommand.bind(redis);
redis.sendCommand = ((command: { name?: string }) => {
  try {
    const name = String(command?.name ?? "unknown").toLowerCase();
    metrics.count("redis.commands");
    metrics.count(`redis.${name}`);
  } catch {
    /* metrics are best-effort */
  }
  return originalSendCommand(command as never);
}) as typeof redis.sendCommand;

redis.on("connect", () => {
  console.log("🚀 Connected to Redis for high-speed room resolution");
});

dbEventRedisReader.on("connect", () => {
  console.log("🚀 Connected to Redis DB event stream reader");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

dbEventRedisReader.on("error", (err) => {
  console.error("❌ Redis DB event stream reader error:", err);
});

// TTL for room codes (e.g., 24 hours)
export const ROOM_TTL = 24 * 60 * 60;

/**
 * Distributed Room Key Caching Logic
 */
export const redisCache = {
  client: redis,
  // Store room key mapping (both ways for O(1) lookups)
  async setRoomKey(roomId: string, passkey: string) {
    // 1. Check if room already has a key to invalidate the old 'room:key:XXXXX' entry
    const oldPasskey = await this.getPasskeyByRoomId(roomId);
    
    const pipeline = redis.pipeline();
    if (oldPasskey && oldPasskey !== passkey) {
      pipeline.del(`room:key:${oldPasskey}`);
    }

    pipeline.set(`room:key:${passkey}`, roomId, "EX", ROOM_TTL);
    pipeline.set(`room:id:${roomId}`, passkey, "EX", ROOM_TTL);
    await pipeline.exec();
  },

  async getRoomIdByKey(passkey: string): Promise<string | null> {
    return await redis.get(`room:key:${passkey}`);
  },

  async getPasskeyByRoomId(roomId: string): Promise<string | null> {
    return await redis.get(`room:id:${roomId}`);
  },

  async deleteRoom(roomId: string) {
    const passkey = await this.getPasskeyByRoomId(roomId);
    if (passkey) {
      await redis.del(`room:key:${passkey}`, `room:id:${roomId}`);
    }
  }
};
