// Cryptographic identifier hashing with HMAC-SHA256 + secret pepper.
//
// Why HMAC instead of plain SHA-256: phone numbers and Telegram usernames have
// a small brute-force space. If an attacker obtains the hashes (DB leak), plain
// SHA-256 can be reversed by hashing all possible phone numbers. HMAC with a
// secret pepper makes this infeasible without the pepper.
//
// The pepper is read from HASH_PEPPER_SECRET env var (per-request, server-only).
// If the pepper is not configured, hashing FAILS CLOSED: returns a random
// placeholder that won't match anything. We never fall back to a weak hash.

/**
 * HMAC-SHA256 hash of a normalized identifier using the secret pepper.
 * Returns a hex string. Fails closed (random value) if pepper is missing
 * or crypto is unavailable — never stores a weak/reversible hash.
 */
export async function hashIdentifier(value: string): Promise<string> {
  const v = value.trim().toLowerCase();
  const pepper = process.env.HASH_PEPPER_SECRET;

  if (!pepper) {
    // Fail closed: no pepper = no meaningful hash. Return a random value
    // that won't collide with real hashes. This prevents storing weak hashes.
    console.error("HASH_PEPPER_SECRET not set — using random placeholder hash");
    return `no-pepper-${crypto.randomUUID()}`;
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
    return [...new Uint8Array(signature)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    // Crypto API unavailable — fail closed, don't store a weak hash.
    console.error("hashIdentifier: crypto unavailable", e instanceof Error ? e.message : "");
    return `no-crypto-${crypto.randomUUID()}`;
  }
}
