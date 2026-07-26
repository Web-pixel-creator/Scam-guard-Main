import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequireAdminMfaAal2 } from "@/lib/config.server";

export type AdminAuthPolicy = {
  isAdmin: boolean;
  requireMfaAal2: boolean;
  currentAal: "aal1" | "aal2" | null;
};

export function currentAuthenticatorAssuranceLevel(claims: unknown): AdminAuthPolicy["currentAal"] {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
  const aal = (claims as Record<string, unknown>).aal;
  return aal === "aal1" || aal === "aal2" ? aal : null;
}

export async function loadAdminAuthPolicy(
  userId: string,
  claims: unknown,
): Promise<AdminAuthPolicy> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    throw new Error("Unable to verify admin access");
  }

  return {
    isAdmin: Boolean(data),
    requireMfaAal2: getRequireAdminMfaAal2(),
    currentAal: currentAuthenticatorAssuranceLevel(claims),
  };
}

/**
 * Authenticated rollout policy used before loading protected admin data.
 *
 * This endpoint intentionally does not require AAL2 itself: an AAL1 admin must
 * be able to learn that a challenge is required and reach the MFA flow.
 */
export const getAdminAuthPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadAdminAuthPolicy(context.userId, context.claims));
