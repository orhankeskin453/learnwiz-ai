/**
 * Password hashing (CLAUDE.md §40.10): PBKDF2-HMAC-SHA256 via WebCrypto —
 * Workers-native, no WASM dependency, never a bare fast hash. Storage format is
 * self-describing so the iteration count can rise over time:
 *   pbkdf2$sha256$<iterations>$<salt-hex>$<hash-hex>
 * CPU note (spec D1): ~100k iterations assumes Workers Paid headroom; tune via
 * PASSWORD_HASH_ITERATIONS on constrained plans.
 */
const DEFAULT_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const ENCODER = new TextEncoder();

export function passwordIterations(env: { PASSWORD_HASH_ITERATIONS?: string }): number {
  const raw = Number.parseInt(env.PASSWORD_HASH_ITERATIONS ?? "", 10);
  return Number.isFinite(raw) && raw >= 10_000 && raw <= 1_000_000 ? raw : DEFAULT_ITERATIONS;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", ENCODER.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$sha256$${iterations}$${saltHex}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iterations = Number.parseInt(parts[2] ?? "", 10);
  const saltHex = parts[3] ?? "";
  const expected = parts[4] ?? "";
  if (!Number.isFinite(iterations) || saltHex.length !== SALT_BYTES * 2) return false;

  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((h) => Number.parseInt(h, 16)) ?? []);
  const derived = await derive(password, salt, iterations);
  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
