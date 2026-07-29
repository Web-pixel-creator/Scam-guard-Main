// Hosted Auth/MFA restore-drill smoke for the isolated staging project.
//
// Creates one confirmed example.invalid user without sending email, proves the
// allowlist-to-admin projection, enrolls and verifies a staging-only TOTP
// factor, validates the AAL1 denial and AAL2 admin gate, then removes every
// synthetic Auth and application row.
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  currentAuthenticatorAssuranceLevel,
  loadAdminAuthPolicy,
} from "@/lib/admin-auth.functions";
import { ADMIN_TOTP_FRIENDLY_NAME } from "@/lib/admin-mfa-flow";
import { assertAdminMfaAal2 } from "@/lib/admin-mfa.server";

const APPROVED_PROJECT_REF = "gwwcooupkmhihaigympb";
const APPROVED_ORIGIN = `https://${APPROVED_PROJECT_REF}.supabase.co`;

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function adminClient(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function assertIsolationContract(): {
  publishableKey: string;
  serviceRoleKey: string;
} {
  assert(
    requiredEnv("HOSTED_STAGING_PROJECT_REF") === APPROVED_PROJECT_REF,
    "staging project ref is not approved",
  );
  assert(
    requiredEnv("SUPABASE_URL").replace(/\/+$/, "") === APPROVED_ORIGIN,
    "Supabase URL is not the approved staging origin",
  );
  assert(
    process.env.REQUIRE_ADMIN_MFA_AAL2?.trim().toLowerCase() === "true",
    "MFA AAL2 enforcement must be enabled",
  );
  assert(
    process.env.TELEGRAM_UPDATE_DELIVERY_MODE?.trim().toLowerCase() === "disabled",
    "Telegram delivery must be disabled",
  );

  return {
    publishableKey: requiredEnv("SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function decodeJwtClaims(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split(".")[1];
  assert(payload, "access token payload is missing");
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    assert(parsed && typeof parsed === "object" && !Array.isArray(parsed), "invalid JWT claims");
    return parsed as Record<string, unknown>;
  } catch {
    return fail("access token claims could not be decoded");
  }
}

type ProtectedReadResult = {
  count: number | null;
  error: { code?: string } | null;
};

function assertAal1ProtectedReadDenied(result: ProtectedReadResult): void {
  if (result.error) {
    assert(
      result.error.code === "42501",
      `AAL1 protected read failed unexpectedly: ${result.error.code ?? "unknown"}`,
    );
    return;
  }
  assert(result.count === 0, "AAL1 user client could read the protected fixture");
}

function decodeBase32(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of value.replace(/=+$/u, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    assert(index >= 0, "TOTP secret contains an invalid base32 character");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, timestamp = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function exactCount(table: string): Promise<number> {
  const { count, error } = await adminClient().from(table).select("*", {
    count: "exact",
    head: true,
  });
  if (error) {
    fail(`count failed for ${table}: ${error.code ?? "unknown"} ${error.message}`);
  }
  return count ?? 0;
}

async function authUserCount(): Promise<number> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) fail(`Auth user count failed: ${error.code ?? "unknown"}`);
  return data.users.length;
}

async function verifyBaseline(label: string): Promise<void> {
  const [users, allowlist, roles] = await Promise.all([
    authUserCount(),
    exactCount("admin_allowlist"),
    exactCount("user_roles"),
  ]);
  assert(users === 2, `${label} Auth user count changed`);
  assert(allowlist === 2, `${label} allowlist count changed`);
  assert(roles === 4, `${label} user-role count changed`);
}

async function main(): Promise<void> {
  const { publishableKey } = assertIsolationContract();
  await verifyBaseline("initial");

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`.toLowerCase();
  const email = `restore-drill-${suffix}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}Aa7!`;
  const protectedCheckId = randomUUID();
  const protectedCheckHash = randomBytes(32).toString("hex");
  let userId: string | null = null;
  let factorId: string | null = null;
  let userClient: SupabaseClient | null = null;
  let primaryError: unknown = null;

  try {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { purpose: "hosted-staging-mfa-smoke" },
    });
    if (createError) fail(`synthetic Auth user creation failed: ${createError.code ?? "unknown"}`);
    userId = created.user.id;
    console.log("OK synthetic confirmed Auth user created without email delivery");

    const { error: allowlistError } = await adminClient().from("admin_allowlist").insert({ email });
    if (allowlistError) {
      fail(`synthetic allowlist insert failed: ${allowlistError.code ?? "unknown"}`);
    }

    const { data: roles, error: rolesError } = await adminClient()
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesError) fail(`synthetic role lookup failed: ${rolesError.code ?? "unknown"}`);
    const roleNames = new Set((roles ?? []).map((row) => String(row.role)));
    assert(roleNames.has("user") && roleNames.has("admin"), "allowlist admin projection failed");
    console.log("OK confirmed allowlist projected user and admin roles");

    const { error: fixtureError } = await adminClient().from("checks").insert({
      id: protectedCheckId,
      input_type: "text",
      redacted_input: "[hosted staging MFA smoke fixture]",
      input_hash: protectedCheckHash,
      risk_level: "unknown",
      risk_score: 0,
      reason_codes: [],
      language: "en",
    });
    if (fixtureError) {
      fail(`protected fixture creation failed: ${fixtureError.code ?? "unknown"}`);
    }

    userClient = createClient(APPROVED_ORIGIN, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) fail(`synthetic sign-in failed: ${signInError.code ?? "unknown"}`);
    assert(signIn.session, "synthetic AAL1 session is missing");

    const aal1Claims = decodeJwtClaims(signIn.session.access_token);
    assert(
      currentAuthenticatorAssuranceLevel(aal1Claims) === "aal1",
      "initial session is not AAL1",
    );
    let aal1Denied = false;
    try {
      assertAdminMfaAal2(aal1Claims);
    } catch {
      aal1Denied = true;
    }
    assert(aal1Denied, "protected admin gate did not reject AAL1");

    const aal1ProtectedRead = await userClient
      .from("checks")
      .select("id", { count: "exact", head: true })
      .eq("id", protectedCheckId);
    assertAal1ProtectedReadDenied(aal1ProtectedRead);

    const { data: enrollment, error: enrollmentError } = await userClient.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: ADMIN_TOTP_FRIENDLY_NAME,
      issuer: "Ishonch Guard",
    });
    if (enrollmentError) fail(`TOTP enrollment failed: ${enrollmentError.code ?? "unknown"}`);
    factorId = enrollment.id;

    let verifyError: { code?: string } | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const verification = await userClient.auth.mfa.challengeAndVerify({
        factorId,
        code: totpCode(enrollment.totp.secret),
      });
      verifyError = verification.error;
      if (!verifyError) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (verifyError) fail(`TOTP verification failed: ${verifyError.code ?? "unknown"}`);

    const { data: assurance, error: assuranceError } =
      await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) fail(`AAL lookup failed: ${assuranceError.code ?? "unknown"}`);
    assert(assurance.currentLevel === "aal2", "TOTP did not upgrade the session to AAL2");

    const { data: currentSession, error: sessionError } = await userClient.auth.getSession();
    if (sessionError) fail(`AAL2 session lookup failed: ${sessionError.code ?? "unknown"}`);
    assert(currentSession.session, "AAL2 session is missing");
    const aal2Claims = decodeJwtClaims(currentSession.session.access_token);
    assertAdminMfaAal2(aal2Claims);

    const policy = await loadAdminAuthPolicy(userId, aal2Claims);
    assert(policy.isAdmin, "AAL2 user is not recognized as admin");
    assert(policy.requireMfaAal2, "admin MFA policy is not enabled");
    assert(policy.currentAal === "aal2", "admin policy did not observe AAL2");

    const aal2ProtectedRead = await userClient
      .from("checks")
      .select("id", { count: "exact", head: true })
      .eq("id", protectedCheckId);
    if (aal2ProtectedRead.error) {
      fail(`AAL2 user-client protected read failed: ${aal2ProtectedRead.error.code ?? "unknown"}`);
    }
    assert(aal2ProtectedRead.count === 1, "AAL2 user client could not read the protected fixture");
    console.log("OK TOTP verified, AAL1 user-client read denied, AAL2 user-client read allowed");
  } catch (error) {
    primaryError = error;
  } finally {
    const cleanupErrors: string[] = [];

    if (userClient && factorId) {
      const { error } = await userClient.auth.mfa.unenroll({ factorId });
      if (error) cleanupErrors.push(`factor:${error.code ?? "unknown"}`);
    }
    if (userClient) {
      await userClient.auth.signOut();
    }

    const { error: fixtureDeleteError } = await adminClient()
      .from("checks")
      .delete()
      .eq("id", protectedCheckId);
    if (fixtureDeleteError) {
      cleanupErrors.push(`protected-fixture:${fixtureDeleteError.code ?? "unknown"}`);
    }

    const { error: allowlistDeleteError } = await adminClient()
      .from("admin_allowlist")
      .delete()
      .eq("email", email);
    if (allowlistDeleteError) {
      cleanupErrors.push(`allowlist:${allowlistDeleteError.code ?? "unknown"}`);
    }

    if (userId) {
      const { error: userDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (userDeleteError) cleanupErrors.push(`user:${userDeleteError.code ?? "unknown"}`);
    }

    const [remainingAllowlist, remainingRoles, remainingProtectedChecks] = await Promise.all([
      adminClient()
        .from("admin_allowlist")
        .select("email", { count: "exact", head: true })
        .eq("email", email),
      userId
        ? adminClient()
            .from("user_roles")
            .select("role", { count: "exact", head: true })
            .eq("user_id", userId)
        : Promise.resolve({ count: 0, error: null }),
      adminClient()
        .from("checks")
        .select("id", { count: "exact", head: true })
        .eq("id", protectedCheckId),
    ]);

    if (remainingAllowlist.error) {
      cleanupErrors.push(`allowlist:verify:${remainingAllowlist.error.code ?? "unknown"}`);
    } else if ((remainingAllowlist.count ?? 0) !== 0) {
      cleanupErrors.push("allowlist:remaining");
    }
    if (remainingRoles.error) {
      cleanupErrors.push(`roles:verify:${remainingRoles.error.code ?? "unknown"}`);
    } else if ((remainingRoles.count ?? 0) !== 0) {
      cleanupErrors.push("roles:remaining");
    }
    if (remainingProtectedChecks.error) {
      cleanupErrors.push(
        `protected-fixture:verify:${remainingProtectedChecks.error.code ?? "unknown"}`,
      );
    } else if ((remainingProtectedChecks.count ?? 0) !== 0) {
      cleanupErrors.push("protected-fixture:remaining");
    }

    if (cleanupErrors.length > 0) {
      fail(`synthetic MFA cleanup failed: ${cleanupErrors.join(",")}`);
    }
  }

  if (primaryError) throw primaryError;
  await verifyBaseline("final");
  console.log("OK synthetic Auth, factor, allowlist, and roles cleanup");
  console.log("OK hosted staging MFA smoke passed");
}

main().catch((error) => {
  console.error(
    "FAIL hosted staging MFA smoke:",
    error instanceof Error ? error.message : "unknown",
  );
  process.exitCode = 1;
});
