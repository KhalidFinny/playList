import { sql } from "../db/client";

const PASSKEY_MIN = 10000;
const PASSKEY_MAX = 99999;
const PASSKEY_RANGE = PASSKEY_MAX - PASSKEY_MIN + 1;
const MAX_ATTEMPTS = 10;

// A 5-digit room code. Uses the CSPRNG rather than Math.random, whose output is
// predictable from previous values. The modulo bias is ~1e-5 and not meaningful
// at this range.
export function generatePasskey(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const [value = 0] = bytes;
  return String(PASSKEY_MIN + (value % PASSKEY_RANGE));
}

export async function generateUniquePasskey(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generatePasskey();
    const existing = await sql`SELECT 1 FROM rooms WHERE passkey = ${candidate} LIMIT 1`;
    if (existing.length === 0) return candidate;
  }

  throw new Error("Could not allocate a unique room passkey");
}
