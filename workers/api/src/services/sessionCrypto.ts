// Guest session cookie crypto (CLAUDE.md §5 "signed/secure session cookie").
// Cookie value = `<id>.<hex HMAC-SHA256(id, secret)>` — tampered or forged
// values fail verification before any database lookup.

const ID_BYTES = 32; // 256-bit opaque session id
const ENCODER = new TextEncoder();

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, ENCODER.encode(value)));
}

/** Opaque, unguessable guest session id (§5: "random unguessable identifier"). */
export function generateGuestSessionId(): string {
  return randomHex(ID_BYTES);
}

/** Cryptographically random hex string of `bytes` random bytes. */
export function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Unpeppered SHA-256 — used to hash session/auth tokens before storage. */
export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", ENCODER.encode(value)));
}

/** Build the signed cookie value for a session id. */
export async function signGuestCookie(id: string, secret: string): Promise<string> {
  return `${id}.${await hmacHex(id, secret)}`;
}

/** Constant-time equality over equal-length hex strings. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a cookie value and return the session id, or null when the value is
 * malformed, signed with a different secret, or otherwise tampered with.
 */
export async function verifyGuestCookie(value: string, secret: string): Promise<string | null> {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = await hmacHex(id, secret);
  if (!constantTimeEqual(signature, expected)) return null;
  return id;
}

/** Peppered SHA-256 for rate-limit keys / ip_hash — never store raw IPs (§5). */
export async function pepperedHash(value: string, secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", ENCODER.encode(`${value}:${secret}`));
  return toHex(digest);
}
