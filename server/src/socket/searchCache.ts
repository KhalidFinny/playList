export const normalizeSearchQuery = (query: string) => query.toLowerCase().trim().replace(/\s+/g, " ");

export { TtlLruCache } from "../lib/ttlCache";
