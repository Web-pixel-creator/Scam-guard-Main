import type { Factor } from "@supabase/supabase-js";
import type { AdminAuthPolicy } from "@/lib/admin-auth.functions";

export const ADMIN_TOTP_FRIENDLY_NAME = "Ishonch Guard admin";

export function normalizeTotpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidTotpCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function preferredVerifiedTotpFactor(
  factors: readonly Factor[],
): Factor<"totp", "verified"> | null {
  const verified = factors.filter(
    (factor): factor is Factor<"totp", "verified"> =>
      factor.factor_type === "totp" && factor.status === "verified",
  );

  return (
    verified.sort((left, right) => {
      const rightTime = Date.parse(right.last_challenged_at ?? right.updated_at);
      const leftTime = Date.parse(left.last_challenged_at ?? left.updated_at);
      return rightTime - leftTime;
    })[0] ?? null
  );
}

export function staleIshonchTotpFactors(factors: readonly Factor[]): Factor<"totp">[] {
  return factors.filter(
    (factor): factor is Factor<"totp"> =>
      factor.factor_type === "totp" &&
      factor.status === "unverified" &&
      factor.friendly_name === ADMIN_TOTP_FRIENDLY_NAME,
  );
}

export function adminSessionDestination(policy: AdminAuthPolicy): "/admin" | "/admin-mfa" {
  return policy.isAdmin && policy.requireMfaAal2 && policy.currentAal !== "aal2"
    ? "/admin-mfa"
    : "/admin";
}

export function friendlyAdminMfaError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/expired|session|jwt|token/i.test(message)) {
    return "Сессия входа истекла. Войдите ещё раз и повторите проверку.";
  }
  if (/invalid|code|challenge|verify/i.test(message)) {
    return "Код не подошёл или успел устареть. Дождитесь нового кода в приложении и попробуйте ещё раз.";
  }
  if (/factor.*exist|already.*factor/i.test(message)) {
    return "Для аккаунта уже начата настройка MFA. Обновите страницу и продолжите с актуальным фактором.";
  }
  return "Не удалось проверить MFA. Повторите попытку; если ошибка сохраняется, выйдите и обратитесь ко второму владельцу проекта.";
}
