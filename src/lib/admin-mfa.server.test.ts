import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAdminMfaAal2 } from "@/lib/admin-mfa.server";
import { getRequireAdminMfaAal2 } from "@/lib/config.server";

const ORIGINAL_REQUIRE_ADMIN_MFA_AAL2 = process.env.REQUIRE_ADMIN_MFA_AAL2;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  restoreEnv("REQUIRE_ADMIN_MFA_AAL2", ORIGINAL_REQUIRE_ADMIN_MFA_AAL2);
  restoreEnv("NODE_ENV", ORIGINAL_NODE_ENV);
  restoreEnv("RAILWAY_ENVIRONMENT", ORIGINAL_RAILWAY_ENVIRONMENT);
});

describe("getRequireAdminMfaAal2", () => {
  it("keeps enforcement disabled when the flag is unset or blank outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RAILWAY_ENVIRONMENT", "");
    delete process.env.REQUIRE_ADMIN_MFA_AAL2;
    expect(getRequireAdminMfaAal2()).toBe(false);

    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "  ");
    expect(getRequireAdminMfaAal2()).toBe(false);
  });

  it.each([
    ["production", ""],
    ["test", "production"],
  ])(
    "fails closed when the flag is missing or blank in a protected runtime",
    (nodeEnv, railwayEnvironment) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("RAILWAY_ENVIRONMENT", railwayEnvironment);
      delete process.env.REQUIRE_ADMIN_MFA_AAL2;

      expect(() => getRequireAdminMfaAal2()).toThrow(
        "REQUIRE_ADMIN_MFA_AAL2 is required in production or Railway",
      );

      vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "  ");
      expect(() => getRequireAdminMfaAal2()).toThrow(
        "REQUIRE_ADMIN_MFA_AAL2 is required in production or Railway",
      );
    },
  );

  it("accepts explicit true and false values case-insensitively", () => {
    vi.stubEnv("NODE_ENV", "production");
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
  it("fails closed before evaluating claims when production configuration is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT", "");
    delete process.env.REQUIRE_ADMIN_MFA_AAL2;

    expect(() => assertAdminMfaAal2({ aal: "aal2" })).toThrow(
      "REQUIRE_ADMIN_MFA_AAL2 is required in production or Railway",
    );
  });

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
