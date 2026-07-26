import { describe, expect, it } from "vitest";
import type { Factor } from "@supabase/supabase-js";
import {
  ADMIN_TOTP_FRIENDLY_NAME,
  adminSessionDestination,
  friendlyAdminMfaError,
  isValidTotpCode,
  normalizeTotpCode,
  preferredVerifiedTotpFactor,
  staleIshonchTotpFactors,
} from "@/lib/admin-mfa-flow";

function factor(overrides: Partial<Factor> & Pick<Factor, "id">): Factor {
  return {
    factor_type: "totp",
    status: "verified",
    friendly_name: ADMIN_TOTP_FRIENDLY_NAME,
    created_at: "2026-07-24T10:00:00.000Z",
    updated_at: "2026-07-24T10:00:00.000Z",
    ...overrides,
  };
}

describe("TOTP input", () => {
  it("keeps only six ASCII digits", () => {
    expect(normalizeTotpCode("12 3a-4567")).toBe("123456");
    expect(isValidTotpCode("123456")).toBe(true);
    expect(isValidTotpCode("12345")).toBe(false);
    expect(isValidTotpCode("12345a")).toBe(false);
  });
});

describe("factor selection", () => {
  it("prefers the most recently challenged verified TOTP factor", () => {
    const chosen = preferredVerifiedTotpFactor([
      factor({ id: "older", last_challenged_at: "2026-07-24T11:00:00.000Z" }),
      factor({ id: "phone", factor_type: "phone" }),
      factor({ id: "newer", last_challenged_at: "2026-07-24T12:00:00.000Z" }),
      factor({ id: "pending", status: "unverified" }),
    ]);

    expect(chosen?.id).toBe("newer");
  });

  it("cleans only this app's unverified TOTP enrollment attempts", () => {
    const stale = staleIshonchTotpFactors([
      factor({ id: "ours", status: "unverified" }),
      factor({ id: "verified" }),
      factor({ id: "other", status: "unverified", friendly_name: "Another app" }),
      factor({ id: "phone", factor_type: "phone", status: "unverified" }),
    ]);

    expect(stale.map((item) => item.id)).toEqual(["ours"]);
  });
});

describe("admin MFA rollout", () => {
  it("routes to MFA only when the authoritative policy requires AAL2", () => {
    expect(
      adminSessionDestination({
        isAdmin: true,
        requireMfaAal2: true,
        currentAal: "aal1",
      }),
    ).toBe("/admin-mfa");
    expect(
      adminSessionDestination({
        isAdmin: true,
        requireMfaAal2: true,
        currentAal: "aal2",
      }),
    ).toBe("/admin");
    expect(
      adminSessionDestination({
        isAdmin: true,
        requireMfaAal2: false,
        currentAal: "aal1",
      }),
    ).toBe("/admin");
    expect(
      adminSessionDestination({
        isAdmin: false,
        requireMfaAal2: true,
        currentAal: "aal1",
      }),
    ).toBe("/admin");
  });

  it("never echoes a provider error to the operator", () => {
    const providerMessage = "challenge failed for factor secret-factor-id";
    const friendly = friendlyAdminMfaError(new Error(providerMessage));

    expect(friendly).not.toContain(providerMessage);
    expect(friendly).not.toContain("secret-factor-id");
  });
});
