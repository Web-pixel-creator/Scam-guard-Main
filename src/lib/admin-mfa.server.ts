import { getRequireAdminMfaAal2 } from "@/lib/config.server";

/**
 * Enforces the current Supabase Auth assurance level for admin server actions.
 *
 * Local development and tests keep the gate disabled when unset. Production
 * and Railway require an explicit rollout value, and an enabled gate accepts
 * only a verified `aal2` JWT.
 */
export function assertAdminMfaAal2(claims: unknown): void {
  if (!getRequireAdminMfaAal2()) return;

  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new Error("Forbidden: MFA required");
  }

  if ((claims as Record<string, unknown>).aal !== "aal2") {
    throw new Error("Forbidden: MFA required");
  }
}
