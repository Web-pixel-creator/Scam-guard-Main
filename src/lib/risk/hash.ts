// Lightweight non-cryptographic hash (sha-256-like via Web Crypto if available, else FNV-1a).
export async function hashIdentifier(value: string): Promise<string> {
  const v = value.trim().toLowerCase();
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* ignore */
  }
  // FNV-1a fallback
  let h = 0x811c9dc5;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}
