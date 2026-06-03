import { afterEach, describe, expect, it, vi } from "vitest";
import { hashIdentifier } from "./hash";

const ORIGINAL_PEPPER = process.env.HASH_PEPPER_SECRET;

afterEach(() => {
  if (ORIGINAL_PEPPER === undefined) delete process.env.HASH_PEPPER_SECRET;
  else process.env.HASH_PEPPER_SECRET = ORIGINAL_PEPPER;
  vi.unstubAllEnvs();
});

describe("hashIdentifier", () => {
  it("returns a stable HMAC hash for the same normalized identifier", async () => {
    vi.stubEnv("HASH_PEPPER_SECRET", "stable-test-pepper");

    const a = await hashIdentifier(" @ScamCheck_bot ");
    const b = await hashIdentifier("@scamcheck_bot");

    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
  });

  it("fails closed when HASH_PEPPER_SECRET is missing", async () => {
    vi.stubEnv("HASH_PEPPER_SECRET", "");

    await expect(hashIdentifier("+998901234567")).rejects.toThrow("HASH_PEPPER_SECRET is required");
  });
});
