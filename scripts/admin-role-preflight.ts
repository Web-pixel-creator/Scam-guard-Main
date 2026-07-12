import { createClient } from "@supabase/supabase-js";
import {
  collectCountedPages,
  summarizeAdminRoleDrift,
  type AdminRolePreflightUser,
} from "@/lib/admin-role-preflight";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("required_supabase_env_missing");

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function requireUnique(values: readonly string[], errorCode: string): void {
  if (new Set(values).size !== values.length) throw new Error(errorCode);
}

async function readAuthUsers(): Promise<AdminRolePreflightUser[]> {
  const users: AdminRolePreflightUser[] = [];
  let expectedAuthUserCount: number | null = null;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("auth_users_read_failed");
    if (!Number.isInteger(data.total) || data.total < 0) {
      throw new Error("auth_users_count_missing");
    }
    if (expectedAuthUserCount === null) expectedAuthUserCount = data.total;
    if (data.total !== expectedAuthUserCount) throw new Error("auth_users_count_changed");
    users.push(
      ...data.users.map((user) => ({
        id: user.id,
        email: user.email,
        emailConfirmedAt: user.email_confirmed_at,
      })),
    );
    if (page >= data.lastPage) break;
  }
  if (users.length !== expectedAuthUserCount) throw new Error("auth_users_read_incomplete");
  requireUnique(
    users.map((user) => user.id),
    "auth_users_paging_duplicate",
  );
  return users;
}

async function readRoleSources(): Promise<{
  allowlistEmails: string[];
  adminUserIds: string[];
}> {
  const [allowlistEmails, adminUserIds] = await Promise.all([
    collectCountedPages(async (from, to) => {
      const { data, error, count } = await client
        .from("admin_allowlist")
        .select("email", { count: "exact" })
        .order("email", { ascending: true })
        .range(from, to);
      if (error) throw new Error("admin_allowlist_read_failed");
      return {
        rows: (data ?? []).map((row) => String(row.email ?? "")),
        totalCount: count,
      };
    }),
    collectCountedPages(async (from, to) => {
      const { data, error, count } = await client
        .from("user_roles")
        .select("user_id", { count: "exact" })
        .eq("role", "admin")
        .order("user_id", { ascending: true })
        .range(from, to);
      if (error) throw new Error("admin_roles_read_failed");
      return {
        rows: (data ?? []).map((row) => String(row.user_id)),
        totalCount: count,
      };
    }),
  ]);
  requireUnique(allowlistEmails, "admin_allowlist_paging_duplicate");
  requireUnique(adminUserIds, "admin_roles_paging_duplicate");
  return { allowlistEmails, adminUserIds };
}

async function readStable<T>(
  read: () => Promise<T>,
  fingerprint: (value: T) => string,
  errorCode: string,
): Promise<T> {
  const first = await read();
  const second = await read();
  if (fingerprint(first) !== fingerprint(second)) throw new Error(errorCode);
  return second;
}

const users = await readStable(
  readAuthUsers,
  (value) =>
    JSON.stringify(
      [...value]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((user) => [user.id, user.email ?? null, Boolean(user.emailConfirmedAt)]),
    ),
  "auth_users_changed_during_preflight",
);
const { allowlistEmails, adminUserIds } = await readStable(
  readRoleSources,
  (value) =>
    JSON.stringify({
      allowlistEmails: [...value.allowlistEmails].sort(),
      adminUserIds: [...value.adminUserIds].sort(),
    }),
  "admin_role_sources_changed_during_preflight",
);

const summary = summarizeAdminRoleDrift(users, allowlistEmails, adminUserIds);

console.log(JSON.stringify(summary));
if (summary.staleAdminRoleCount > 0 || summary.missingAdminRoleCount > 0) {
  process.exitCode = 2;
}
