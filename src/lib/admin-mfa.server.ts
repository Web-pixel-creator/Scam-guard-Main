import { getRequireAdminMfaAal2 } from "@/lib/config.server";

/**
 * Enforces the current Supabase Auth assurance level for admin server actions.
 *
 * The environment gate is intentionally disabled when unset so adding this
 * server-side foundation cannot lock out the existing admin flow before the
 * enrollment/challenge UI is ready. Once explicitly enabled, anything other
 * than a verified `aal2` JWT fails closed.
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
