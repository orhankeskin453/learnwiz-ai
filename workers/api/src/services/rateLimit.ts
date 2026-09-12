/**
 * Coarse per-IP throttle for guest session creation (CLAUDE.md §18).
 * KV fixed-window counter — race-tolerant by design (§12.1 "non-critical
 * counters"); strict AI budget protection arrives with the AI step. Fail-open:
 * KV outages must not take down session creation.
 */
import { pepperedHash } from "./sessionCrypto";

const WINDOW_SECONDS = 3600;
const MAX_CREATES_PER_WINDOW = 20;

export const RATE_LIMITED_CODE = "rate_limited";

/** Seconds until the current fixed window ends (for Retry-After). */
export function windowResetInSeconds(now: number = Date.now()): number {
  const epoch = Math.floor(now / 1000);
  return WINDOW_SECONDS - (epoch % WINDOW_SECONDS);
}

/**
 * Returns false when the IP exceeded MAX_CREATES_PER_WINDOW in the current
 * window. Keys embed the window start so stale counters expire on their own.
 */
export async function allowGuestSessionCreation(
  kv: KVNamespace,
  ip: string,
  secret: string,
): Promise<boolean> {
  try {
    const ipHash = await pepperedHash(ip, secret);
    const epoch = Math.floor(Date.now() / 1000);
    const windowStart = epoch - (epoch % WINDOW_SECONDS);
    const key = `rl:guest-create:${ipHash}:${windowStart}`;
    const current = await kv.get(key);
    const next = (current ? Number.parseInt(current, 10) : 0) + 1;
    await kv.put(key, String(next), { expirationTtl: WINDOW_SECONDS * 2 });
    return next <= MAX_CREATES_PER_WINDOW;
  } catch {
    return true; // fail-open (spec D7)
  }
}

export interface WindowLimit {
  bucket: string;
  key: string;
  max: number;
  windowSeconds: number;
}

/** Generic fixed-window counter for auth endpoints (§47.14). Fail-open on KV
 * errors — abuse throttle, not a correctness control (same posture as D7). */
export async function enforceWindow(
  kv: KVNamespace,
  limit: WindowLimit,
  pepper: string,
): Promise<boolean> {
  try {
    const keyHash = await pepperedHash(`${limit.bucket}:${limit.key}`, pepper);
    const epoch = Math.floor(Date.now() / 1000);
    const windowStart = epoch - (epoch % limit.windowSeconds);
    const key = `rl:${limit.bucket}:${keyHash}:${windowStart}`;
    const current = await kv.get(key);
    const next = (current ? Number.parseInt(current, 10) : 0) + 1;
    await kv.put(key, String(next), { expirationTtl: limit.windowSeconds * 2 });
    return next <= limit.max;
  } catch {
    return true;
  }
}
