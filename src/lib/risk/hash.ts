// Cryptographic identifier hashing with HMAC-SHA256 + a server-only pepper.
//
// Why HMAC instead of plain SHA-256: phone numbers and Telegram usernames have
// a small brute-force space. If an attacker obtains the hashes (DB leak), plain
// SHA-256 can be reversed by hashing all possible phone numbers. HMAC with a
// secret pepper makes this infeasible without the pepper.
//
// Legacy deployments read HASH_PEPPER_SECRET. Versioned deployments use one
// active pepper plus at most one previous pepper for bounded dual-read. If the
// configuration is missing or ambiguous, hashing FAILS CLOSED. We never fall
// back to a weak or unstable hash.

export interface IdentifierHash {
  hash: string;
  version: string;
}

interface PepperSlot {
  secret: string;
  version: string;
}

interface PepperConfiguration {
  active: PepperSlot;
  previous: PepperSlot | null;
}

const LEGACY_PEPPER_VERSION = "legacy";
const PEPPER_VERSION_RE = /^[a-z][a-z0-9_]{0,15}$/;

function configuredValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeVersion(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return PEPPER_VERSION_RE.test(normalized) ? normalized : null;
}

function pepperConfiguration(): PepperConfiguration {
  const legacySecret = configuredValue("HASH_PEPPER_SECRET");
  const activeVersionRaw = configuredValue("HASH_PEPPER_ACTIVE_VERSION");
  const activeSecret = configuredValue("HASH_PEPPER_ACTIVE_SECRET");
  const previousVersionRaw = configuredValue("HASH_PEPPER_PREVIOUS_VERSION");
  const previousSecret = configuredValue("HASH_PEPPER_PREVIOUS_SECRET");
  const usesVersionedConfiguration =
    activeVersionRaw !== null ||
    activeSecret !== null ||
    previousVersionRaw !== null ||
    previousSecret !== null;

  if (!usesVersionedConfiguration) {
    if (!legacySecret) {
      throw new Error("HASH_PEPPER_SECRET is required for identifier hashing");
    }
    return {
      active: { version: LEGACY_PEPPER_VERSION, secret: legacySecret },
      previous: null,
    };
  }

  const activeVersion = normalizeVersion(activeVersionRaw);
  if (!activeVersion || !activeSecret) {
    throw new Error("Active versioned hash pepper configuration is incomplete");
  }

  const hasExplicitPrevious = previousVersionRaw !== null || previousSecret !== null;
  let previous: PepperSlot | null = null;
  if (hasExplicitPrevious) {
    const previousVersion = normalizeVersion(previousVersionRaw);
    if (!previousVersion || !previousSecret) {
      throw new Error("Previous versioned hash pepper configuration is incomplete");
    }
    if (legacySecret) {
      throw new Error("Versioned hash pepper configuration is ambiguous");
    }
    previous = { version: previousVersion, secret: previousSecret };
  } else if (legacySecret) {
    previous = { version: LEGACY_PEPPER_VERSION, secret: legacySecret };
  }

  if (previous && (previous.version === activeVersion || previous.secret === activeSecret)) {
    throw new Error("Active and previous hash peppers must be distinct");
  }

  return {
    active: { version: activeVersion, secret: activeSecret },
    previous,
  };
}

async function hmacIdentifier(value: string, pepper: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    throw new Error("hashIdentifier failed: crypto unavailable");
  }
}

export function isHashPepperConfigured(): boolean {
  try {
    pepperConfiguration();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the active write hash followed by the optional previous read hash.
 * The raw identifier and pepper values are never returned or persisted.
 */
export async function hashIdentifierCandidates(value: string): Promise<IdentifierHash[]> {
  const normalized = value.trim().toLowerCase();
  const configuration = pepperConfiguration();
  const slots = [configuration.active, configuration.previous].filter(
    (slot): slot is PepperSlot => slot !== null,
  );

  return Promise.all(
    slots.map(async (slot) => ({
      version: slot.version,
      hash: await hmacIdentifier(normalized, slot.secret),
    })),
  );
}

/** Active-version HMAC used for every new write. */
export async function hashIdentifierVersioned(value: string): Promise<IdentifierHash> {
  const [active] = await hashIdentifierCandidates(value);
  if (!active) throw new Error("Active hash pepper configuration is unavailable");
  return active;
}

/**
 * Backward-compatible active HMAC helper. Existing callers receive the same
 * 64-character lowercase hex format while version-aware callers use the APIs
 * above.
 */
export async function hashIdentifier(value: string): Promise<string> {
  return (await hashIdentifierVersioned(value)).hash;
}
