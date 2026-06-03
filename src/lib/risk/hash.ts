// Cryptographic identifier hashing with HMAC-SHA256 + secret pepper.
//
// Why HMAC instead of plain SHA-256: phone numbers and Telegram usernames have
// a small brute-force space. If an attacker obtains the hashes (DB leak), plain
// SHA-256 can be reversed by hashing all possible phone numbers. HMAC with a
// secret pepper makes this infeasible without the pepper.
//
// The pepper is read from HASH_PEPPER_SECRET env var (per-request, server-only).
// If the pepper is not configured, hashing FAILS CLOSED by throwing. We never
// fall back to a weak or unstable hash.

/**
 * HMAC-SHA256 hash of a normalized identifier using the secret pepper.
 * Returns a hex string. Fails closed if pepper or crypto is unavailable —
 * never stores a weak/reversible hash.
 */
export async function hashIdentifier(value: string): Promise<string> {
  const v = value.trim().toLowerCase();
  const pepper = process.env.HASH_PEPPER_SECRET;

  if (!pepper) {
    throw new Error("HASH_PEPPER_SECRET is required for identifier hashing");
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(v));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    throw new Error(
      `hashIdentifier failed: ${e instanceof Error ? e.message : "crypto unavailable"}`,
    );
  }
}
