import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_REQUIRE_ADMIN_MFA_AAL2 = process.env.REQUIRE_ADMIN_MFA_AAL2;

const hoisted = vi.hoisted(() => ({
  roleRow: { role: "admin" } as { role: string } | null,
  roleError: null as { message: string } | null,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware() {
        return builder;
      },
      handler(handler: unknown) {
        return handler;
      },
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: async () => undefined,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "user_roles") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: hoisted.roleRow,
                error: hoisted.roleError,
              }),
            }),
          }),
        }),
      };
    },
  },
}));

import {
  currentAuthenticatorAssuranceLevel,
  loadAdminAuthPolicy,
} from "@/lib/admin-auth.functions";

beforeEach(() => {
  hoisted.roleRow = { role: "admin" };
  hoisted.roleError = null;
  vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (ORIGINAL_REQUIRE_ADMIN_MFA_AAL2 === undefined) {
    delete process.env.REQUIRE_ADMIN_MFA_AAL2;
  } else {
    process.env.REQUIRE_ADMIN_MFA_AAL2 = ORIGINAL_REQUIRE_ADMIN_MFA_AAL2;
  }
});

describe("currentAuthenticatorAssuranceLevel", () => {
  it("accepts only the two Supabase Auth AAL values", () => {
    expect(currentAuthenticatorAssuranceLevel({ aal: "aal1" })).toBe("aal1");
    expect(currentAuthenticatorAssuranceLevel({ aal: "aal2" })).toBe("aal2");
    expect(currentAuthenticatorAssuranceLevel({ aal: "aal3" })).toBeNull();
    expect(currentAuthenticatorAssuranceLevel(null)).toBeNull();
    expect(currentAuthenticatorAssuranceLevel([])).toBeNull();
  });
});

describe("loadAdminAuthPolicy", () => {
  it("returns the role, rollout flag and verified JWT assurance level", async () => {
    vi.stubEnv("REQUIRE_ADMIN_MFA_AAL2", "true");

    await expect(loadAdminAuthPolicy("admin-id", { aal: "aal2" })).resolves.toEqual({
      isAdmin: true,
      requireMfaAal2: true,
      currentAal: "aal2",
    });
  });

  it("keeps a non-admin distinguishable without granting access", async () => {
    hoisted.roleRow = null;

    await expect(loadAdminAuthPolicy("user-id", { aal: "aal1" })).resolves.toEqual({
      isAdmin: false,
      requireMfaAal2: false,
      currentAal: "aal1",
    });
  });

  it("fails closed when the authoritative role lookup fails", async () => {
    hoisted.roleError = { message: "database unavailable" };

    await expect(loadAdminAuthPolicy("admin-id", { aal: "aal1" })).rejects.toThrow(
      "Unable to verify admin access",
    );
  });
});
