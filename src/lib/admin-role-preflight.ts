export interface AdminRolePreflightUser {
  id: string;
  email?: string | null;
  emailConfirmedAt?: string | null;
}

export interface AdminRolePreflightSummary {
  totalAuthUserCount: number;
  currentAdminRoleCount: number;
  currentEligibleAdminCount: number;
  staleAdminRoleCount: number;
  missingAdminRoleCount: number;
}

export interface CountedPage<T> {
  rows: readonly T[];
  totalCount: number | null;
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Reads a PostgREST collection without trusting a server-side max-row cap.
 * The exact count must stay stable for the whole read or the preflight fails
 * closed instead of returning an incomplete, falsely green result.
 */
export async function collectCountedPages<T>(
  fetchPage: (from: number, to: number) => Promise<CountedPage<T>>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("invalid_page_size");
  }

  const rows: T[] = [];
  let expectedCount: number | null = null;

  while (expectedCount === null || rows.length < expectedCount) {
    const page = await fetchPage(rows.length, rows.length + pageSize - 1);
    const totalCount = page.totalCount;
    if (typeof totalCount !== "number" || !Number.isInteger(totalCount) || totalCount < 0) {
      throw new Error("paged_source_count_missing");
    }
    if (expectedCount === null) expectedCount = totalCount;
    if (totalCount !== expectedCount) throw new Error("paged_source_count_changed");
    if (expectedCount === 0) return [];
    if (page.rows.length === 0) throw new Error("paged_source_incomplete");

    rows.push(...page.rows);
    if (rows.length > expectedCount) throw new Error("paged_source_count_exceeded");
  }

  return rows;
}

/**
 * Produces count-only entitlement drift evidence. No identifier or email is
 * returned, so callers can log the summary without exposing admin identities.
 */
export function summarizeAdminRoleDrift(
  users: readonly AdminRolePreflightUser[],
  allowlistEmails: readonly string[],
  adminUserIds: readonly string[],
): AdminRolePreflightSummary {
  const allowlist = new Set(allowlistEmails.map(normalizeEmail).filter(Boolean));
  const eligible = new Set(
    users
      .filter((user) => Boolean(user.emailConfirmedAt) && allowlist.has(normalizeEmail(user.email)))
      .map((user) => user.id),
  );
  const admins = new Set(adminUserIds);

  return {
    totalAuthUserCount: users.length,
    currentAdminRoleCount: admins.size,
    currentEligibleAdminCount: eligible.size,
    staleAdminRoleCount: [...admins].filter((id) => !eligible.has(id)).length,
    missingAdminRoleCount: [...eligible].filter((id) => !admins.has(id)).length,
  };
}
