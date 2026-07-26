import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashIdentifier,
  hashIdentifierCandidates,
  hashIdentifierVersioned,
  isHashPepperConfigured,
} from "./hash";

const ORIGINAL_PEPPER = process.env.HASH_PEPPER_SECRET;
const ORIGINAL_ACTIVE_VERSION = process.env.HASH_PEPPER_ACTIVE_VERSION;
const ORIGINAL_ACTIVE_SECRET = process.env.HASH_PEPPER_ACTIVE_SECRET;
const ORIGINAL_PREVIOUS_VERSION = process.env.HASH_PEPPER_PREVIOUS_VERSION;
const ORIGINAL_PREVIOUS_SECRET = process.env.HASH_PEPPER_PREVIOUS_SECRET;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  vi.unstubAllEnvs();
  restoreEnv("HASH_PEPPER_SECRET", ORIGINAL_PEPPER);
  restoreEnv("HASH_PEPPER_ACTIVE_VERSION", ORIGINAL_ACTIVE_VERSION);
  restoreEnv("HASH_PEPPER_ACTIVE_SECRET", ORIGINAL_ACTIVE_SECRET);
  restoreEnv("HASH_PEPPER_PREVIOUS_VERSION", ORIGINAL_PREVIOUS_VERSION);
  restoreEnv("HASH_PEPPER_PREVIOUS_SECRET", ORIGINAL_PREVIOUS_SECRET);
});

describe("hashIdentifier", () => {
  it("returns a stable legacy HMAC for the same normalized identifier", async () => {
    vi.stubEnv("HASH_PEPPER_SECRET", "stable-test-pepper");

    const a = await hashIdentifier(" @ScamCheck_bot ");
    const b = await hashIdentifier("@scamcheck_bot");

    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
    await expect(hashIdentifierVersioned("@scamcheck_bot")).resolves.toEqual({
      hash: a,
      version: "legacy",
    });
    expect(isHashPepperConfigured()).toBe(true);
  });

  it("fails closed when HASH_PEPPER_SECRET is missing", async () => {
    vi.stubEnv("HASH_PEPPER_SECRET", "");

    await expect(hashIdentifier("+998901234567")).rejects.toThrow("HASH_PEPPER_SECRET is required");
    expect(isHashPepperConfigured()).toBe(false);
  });

  it("writes with the active version and keeps the legacy pepper for bounded dual-read", async () => {
    vi.stubEnv("HASH_PEPPER_SECRET", "old-legacy-test-pepper");
    vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", "V2");
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "new-active-test-pepper");

    const candidates = await hashIdentifierCandidates("+998901234567");

    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.version)).toEqual(["v2", "legacy"]);
    expect(candidates[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(candidates[1]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(candidates[0]?.hash).not.toBe(candidates[1]?.hash);
    await expect(hashIdentifier("+998901234567")).resolves.toBe(candidates[0]?.hash);
  });

  it("supports an explicit previous version after the legacy variable is retired", async () => {
    vi.stubEnv("HASH_PEPPER_SECRET", "");
    vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", "v3");
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "third-active-test-pepper");
    vi.stubEnv("HASH_PEPPER_PREVIOUS_VERSION", "v2");
    vi.stubEnv("HASH_PEPPER_PREVIOUS_SECRET", "second-previous-test-pepper");

    await expect(hashIdentifierCandidates("@target")).resolves.toMatchObject([
      { version: "v3" },
      { version: "v2" },
    ]);
  });

  it.each([
    {
      activeVersion: "bad-version!",
      activeSecret: "new-active-test-pepper",
      previousVersion: "",
      previousSecret: "",
      legacy: "",
    },
    {
      activeVersion: "v2",
      activeSecret: "",
      previousVersion: "",
      previousSecret: "",
      legacy: "old-legacy-test-pepper",
    },
    {
      activeVersion: "v2",
      activeSecret: "same-test-pepper",
      previousVersion: "v1",
      previousSecret: "same-test-pepper",
      legacy: "",
    },
    {
      activeVersion: "v2",
      activeSecret: "new-active-test-pepper",
      previousVersion: "v1",
      previousSecret: "old-explicit-test-pepper",
      legacy: "old-legacy-test-pepper",
    },
  ])("fails closed for incomplete or ambiguous versioned configuration", async (configuration) => {
    vi.stubEnv("HASH_PEPPER_SECRET", configuration.legacy);
    vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", configuration.activeVersion);
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", configuration.activeSecret);
    vi.stubEnv("HASH_PEPPER_PREVIOUS_VERSION", configuration.previousVersion);
    vi.stubEnv("HASH_PEPPER_PREVIOUS_SECRET", configuration.previousSecret);

    await expect(hashIdentifier("target")).rejects.toThrow();
    expect(isHashPepperConfigured()).toBe(false);
  });
});
