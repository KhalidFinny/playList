// Fixed-window rate limiter with the same shape as the TtlLruCache in
// `socket/searchCache.ts`, so every limiter can be pruned from one interval.
//
// Keys must be server-derived (actor id, client IP, room id) — never a
// client-supplied identifier, which the caller could rotate at will.

type Window = { count: number; resetAt: number };

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  public constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns false when the key is over its limit. */
  public take(key: string): boolean {
    const now = Date.now();
    const window = this.windows.get(key);

    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (window.count >= this.limit) return false;

    window.count++;
    return true;
  }

  public deleteExpired(now = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }

  public get size() {
    return this.windows.size;
  }
}
