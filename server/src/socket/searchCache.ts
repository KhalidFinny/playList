export const normalizeSearchQuery = (query: string) => query.toLowerCase().trim().replace(/\s+/g, " ");

export class TtlLruCache<T> {
  private readonly entries = new Map<string, { value: T; expires: number }>();

  public constructor(
    private readonly ttlMs: number,
    private readonly maxSize: number,
  ) {}

  public get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });

    while (this.entries.size > this.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }

  public deleteExpired(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(key);
    }
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size() {
    return this.entries.size;
  }
}
