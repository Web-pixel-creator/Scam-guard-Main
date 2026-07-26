import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAdminMfaAal2 } from "@/lib/admin-mfa.server";
import { getRequireAdminMfaAal2 } from "@/lib/config.server";

const ORIGINAL_REQUIRE_ADMIN_MFA_AAL2 = process.env.REQUIRE_ADMIN_MFA_AAL2;

afterEach(() => {
  vi.unstubAllEnvs();
  if (ORIGINAL_REQUIRE_ADMIN_MFA_AAL2 === undefined) {
    delete process.env.REQUIRE_ADMIN_MFA_AAL2;
  } else {
    process.env.REQUIRE_ADMIN_MFA_AAL2 = ORIGINAL_REQUIRE_ADMIN_MFA_AAL2;
  }
});

describe("getRequireAdminMfaAal2", () => {
  it("keeps enforcement disabled when the flag is unset or blank", () => {
    delete process.env.REQUIRE_ADMIN_MFA_AAL2;
    expect(getRequireAdminMfaAal2()).toBe(false);

    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "  ");
    expect(getRequireAdminMfaAal2()).toBe(false);
  });

  it("accepts explicit true and false values case-insensitively", () => {
    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", " TRUE ");
    expect(getRequireAdminMfaAal2()).toBe(true);

    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "False");
    expect(getRequireAdminMfaAal2()).toBe(false);
  });

  it("fails closed on an unsupported explicit value", () => {
    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "sometimes");

    expect(() => getRequireAdminMfaAal2()).toThrow(
      'Invalid REQUIRE_ADMIN_MFA_AAL2: expected "true" or "false"',
    );
  });
});

describe("assertAdminMfaAal2", () => {
  it("does not change the current admin flow while enforcement is disabled", () => {
    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "false");

    expect(() => assertAdminMfaAal2(undefined)).not.toThrow();
    expect(() => assertAdminMfaAal2({ aal: "aal1" })).not.toThrow();
  });

  it("allows only a verified aal2 claim when enforcement is enabled", () => {
    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "true");

    expect(() => assertAdminMfaAal2({ aal: "aal2" })).not.toThrow();
    expect(() => assertAdminMfaAal2({ aal: "aal1" })).toThrow("Forbidden: MFA required");
    expect(() => assertAdminMfaAal2({})).toThrow("Forbidden: MFA required");
    expect(() => assertAdminMfaAal2(null)).toThrow("Forbidden: MFA required");
    expect(() => assertAdminMfaAal2([])).toThrow("Forbidden: MFA required");
  });
});
