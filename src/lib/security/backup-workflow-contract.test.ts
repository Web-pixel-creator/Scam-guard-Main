import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (name: string): string =>
  readFileSync(resolve(process.cwd(), ".github", "workflows", name), "utf8");

describe("Supabase backup workflow contract", () => {
  const backup = readWorkflow("backup.yml");
  const restore = readWorkflow("backup-restore-drill.yml");
  const managedHooks = readFileSync(
    resolve(process.cwd(), "supabase", "recovery", "managed-schema-hooks.sql"),
    "utf8",
  );
  const canonicalLifecycleMigration = readFileSync(
    resolve(
      process.cwd(),
      "supabase",
      "migrations",
      "20260712142514_reconcile_admin_role_lifecycle.sql",
    ),
    "utf8",
  );
  const managedLiveVerifier = readFileSync(
    resolve(process.cwd(), "supabase", "recovery", "verify-managed-schema-live.sql"),
    "utf8",
  );
  const codeowners = readFileSync(resolve(process.cwd(), ".github", "CODEOWNERS"), "utf8");

  const normalizeSql = (sql: string): string =>
    sql
      .replace(/^--.*$/gmu, "")
      .replace(/\s+/gu, " ")
      .trim();

  const triggerBlock = (sql: string, triggerName: string): string => {
    const escapedName = triggerName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const match = sql.match(
      new RegExp(
        `DROP TRIGGER IF EXISTS ${escapedName} ON auth\\.users;[\\s\\S]*?EXECUTE FUNCTION [^;]+;`,
        "u",
      ),
    );
    expect(match, `missing canonical ${triggerName} block`).not.toBeNull();
    return match?.[0] ?? "";
  };

  it("uses the official roles/schema/data and migration-history Supabase CLI split", () => {
    expect(backup.match(/run_dump --db-url/gmu)).toHaveLength(5);
    expect(backup).toMatch(/run_dump --db-url[\s\S]*roles\.sql[\s\S]*--role-only/u);
    expect(backup).toMatch(/run_dump --db-url[\s\S]*schema\.sql[\s\S]*--keep-comments/u);
    expect(backup).toMatch(/run_dump --db-url[\s\S]*data\.sql[\s\S]*--data-only --use-copy/u);
    expect(backup).toContain('--exclude "storage.buckets_vectors"');
    expect(backup).toContain('--exclude "storage.vector_indexes"');
    expect(backup).toContain('--exclude "auth.migrations"');
    expect(backup).toContain('--exclude "storage.migrations"');
    expect(backup).toContain('--exclude "supabase_functions.migrations"');
    expect(backup).toMatch(/history_schema\.sql[\s\S]*--schema supabase_migrations/u);
    expect(backup).toMatch(
      /history_data\.sql[\s\S]*--schema supabase_migrations[\s\S]*--data-only --use-copy/u,
    );
    expect(backup).not.toMatch(/(^|\s)pg_dump\s/u);
    expect(backup).not.toContain("RESET ALL;");
    expect(backup).toContain(
      "grep --quiet 'PostgreSQL database dump complete' \"$plain/roles.sql\"",
    );
  });

  it("restores roles idempotently against the pre-provisioned supabase-local stack", () => {
    const restoreStep = restore.slice(restore.indexOf("Restore in one transaction"));
    expect(restoreStep).toContain("roles-idempotent.sql");
    expect(restoreStep).toContain("CREATE ROLE");
    expect(restoreStep).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname =/u);
    expect(restoreStep).toContain("--file /tmp/restore/roles-idempotent.sql");
    expect(restoreStep).not.toMatch(/--file \/tmp\/restore\/roles\.sql(?![^/])/u);
    expect(restoreStep).toContain("SET session_replication_role = replica");
  });

  it("uses authenticated public-key encryption with separated credentials", () => {
    const exportJob = backup.slice(
      backup.indexOf("  encrypted-export:"),
      backup.indexOf("  authenticated-read-back:"),
    );
    const readBackJob = backup.slice(backup.indexOf("  authenticated-read-back:"));

    expect(backup).toContain('AGE_VERSION: "1.3.1"');
    expect(backup).toContain(
      'AGE_LINUX_AMD64_SHA256: "bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377"',
    );
    expect(backup).toContain(
      "FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz",
    );
    expect(exportJob).toContain("BACKUP_AGE_RECIPIENT");
    expect(exportJob).not.toContain("BACKUP_AGE_IDENTITY");
    expect(readBackJob).toContain("BACKUP_AGE_IDENTITY");
    expect(readBackJob).not.toContain("SUPABASE_DB_URL");
    expect(backup).not.toContain("BACKUP_ENCRYPTION_PASSPHRASE");
    expect(backup).not.toMatch(/openssl enc/u);
    expect(backup).toContain('BACKUP_AGE_RECIPIENT: "UNCONFIGURED_REVIEWED_RECIPIENT_REQUIRED"');
    expect(backup).not.toContain("${{ vars.BACKUP_AGE_RECIPIENT }}");
    expect(backup).toContain("Validate reviewed encryption recipient");
  });

  it("scopes each secret domain to selected-main Environments and a ref guard", () => {
    expect(backup).toContain("environment: backup-export");
    expect(backup).toContain("environment: backup-decrypt");
    expect(restore).toContain("environment: backup-decrypt");
    expect(backup.match(/if: github\.ref == 'refs\/heads\/main'/gmu)).toHaveLength(2);
    expect(restore.match(/if: github\.ref == 'refs\/heads\/main'/gmu)).toHaveLength(1);

    const exportJob = backup.slice(
      backup.indexOf("  encrypted-export:"),
      backup.indexOf("  authenticated-read-back:"),
    );
    const readBackJob = backup.slice(backup.indexOf("  authenticated-read-back:"));
    expect(exportJob).toContain("secrets.SUPABASE_DB_URL");
    expect(exportJob).not.toContain("secrets.BACKUP_AGE_IDENTITY");
    expect(readBackJob).toContain("secrets.BACKUP_AGE_IDENTITY");
    expect(readBackJob).not.toContain("secrets.SUPABASE_DB_URL");
    expect(restore).toContain("secrets.BACKUP_AGE_IDENTITY");
    expect(restore).not.toContain("secrets.SUPABASE_DB_URL");
    expect(codeowners).toContain("/.github/CODEOWNERS @Web-pixel-creator");
    expect(codeowners).toContain("/.github/workflows/ @Web-pixel-creator");
  });

  it("installs the pinned Supabase CLI from an official checksum-verified asset", () => {
    for (const workflow of [backup, restore]) {
      expect(workflow).toContain('SUPABASE_CLI_VERSION: "2.104.0"');
      expect(workflow).toContain(
        'SUPABASE_CLI_LINUX_AMD64_SHA256: "5a0d3ed4c44f8dd1520a9f7ed6309aa60ef3bfc6c5483c9b11f70191f9d74cf6"',
      );
      expect(workflow).toContain("supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}");
      expect(workflow).toContain("sha256sum --check --status");
      expect(workflow).toContain('test "$(supabase --version)" = "$SUPABASE_CLI_VERSION"');
      expect(workflow).not.toContain("supabase/setup-cli@");
    }
  });

  it("preloads the exact Supabase Postgres image before either secret-bearing job step", () => {
    for (const workflow of [backup, restore]) {
      expect(workflow).toContain('SUPABASE_INTERNAL_IMAGE_REGISTRY: "docker.io"');
      expect(workflow).toContain('SUPABASE_POSTGRES_IMAGE: "supabase/postgres:17.6.1.132"');
      expect(workflow).toContain(
        'SUPABASE_POSTGRES_INDEX_DIGEST: "sha256:e09e93a61ed1560caf4be79c9eb29401875bea74b12aec4657cb08bf34ea3a13"',
      );
      expect(workflow).toContain(
        'SUPABASE_POSTGRES_AMD64_IMAGE_ID: "sha256:e1939b94b1fd12b8a446404ff49455d7cf2a6a275a77f010abb56a247bfd5377"',
      );
      expect(workflow).toContain(".RepoDigests");
      expect(workflow).not.toContain(
        '"${SUPABASE_POSTGRES_IMAGE%@*}@${SUPABASE_POSTGRES_INDEX_DIGEST}"',
      );
    }
    expect(backup).toContain('"@${SUPABASE_POSTGRES_INDEX_DIGEST}"');
    expect(restore).toContain('"@${digest}"');
    expect(backup).toContain(
      'docker pull "${SUPABASE_POSTGRES_IMAGE}@${SUPABASE_POSTGRES_INDEX_DIGEST}"',
    );
    expect(restore).toContain('docker pull "${image}@${digest}"');

    expect(backup.indexOf("Preload immutable Supabase Postgres image")).toBeLessThan(
      backup.indexOf("SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}"),
    );
    expect(
      restore.indexOf("Preload immutable Supabase database initialization images"),
    ).toBeLessThan(restore.indexOf("BACKUP_AGE_IDENTITY: ${{ secrets.BACKUP_AGE_IDENTITY }}"));
  });

  it("pins every Supabase-local init image before decrypt and reasserts its ID", () => {
    for (const [name, tag, digest, id] of [
      [
        "REALTIME",
        "supabase/realtime:v2.102.1",
        "sha256:2ebc237cc41d2c941683fffb7848aa40a5af662a1fe30fff5d99f58c7164d8d3",
        "sha256:63bd3e50fe0aa66b07c6b48302047df320aa0474f82792d25694484d4ab4566d",
      ],
      [
        "STORAGE",
        "supabase/storage-api:v1.60.2",
        "sha256:a7da87804e977a93dfa7963cc6353aa30d69f5cdd03e35dcd63ccee43c0a21f5",
        "sha256:5ccecb2958f5d19b267a2275e1f046278ea12b0ca11d22ad68925b332a832105",
      ],
      [
        "AUTH",
        "supabase/gotrue:v2.189.0",
        "sha256:385184459f57569c54c25209f51f3b2be99ddd7c4ce9e3555b5d3eea8447b7cf",
        "sha256:369913f15697d0b2f41fd556ce39f6f979512649f40c2e2e1abf4ed03b5591e7",
      ],
    ]) {
      expect(restore).toContain(`SUPABASE_${name}_IMAGE: "${tag}"`);
      expect(restore).toContain(`SUPABASE_${name}_INDEX_DIGEST: "${digest}"`);
      expect(restore).toContain(`SUPABASE_${name}_AMD64_IMAGE_ID: "${id}"`);
      expect(restore).toContain(
        `test "$(docker image inspect "$SUPABASE_${name}_IMAGE" --format '{{.Id}}')"`,
      );
    }
  });

  it("keeps the encrypted manifest privacy-safe and cleans plaintext always", () => {
    expect(backup).toContain("ishonch-guard-supabase-logical-backup/v3");
    expect(backup).not.toMatch(/manifest[\s\S]{0,300}(?:row_count|user_id|project_ref)/iu);
    expect(backup).not.toMatch(/GITHUB_STEP_SUMMARY[\s\S]{0,200}count\(/iu);
    expect(backup).toMatch(/Cleanup transient plaintext and ciphertext[\s\S]*if: always\(\)/u);
    expect(backup).toMatch(/Cleanup decrypted material[\s\S]*if: always\(\)/u);
    expect(backup).not.toContain("${{ runner.temp }}");
    expect(restore).not.toContain("${{ runner.temp }}");
    expect(backup).toContain("expected-migrations.txt");
    expect(backup).toContain("expected-counts.txt");
    expect(backup).toContain("history_schema.sql");
    expect(backup).toContain("history_data.sql");
    expect(backup).toContain("managed-schema.sql");
    expect(backup).toContain("not member.isfile()");
    expect(restore).toContain("not member.isfile()");
    expect(backup).toContain('[[ "$expected_cipher_sha" =~ ^[0-9a-f]{64}$ ]]');
    expect(restore).toContain('[[ "$expected_cipher_sha" =~ ^[0-9a-f]{64}$ ]]');
    expect(backup).toContain('rm -f "$READBACK_DIR/identity.txt"');
    expect(restore).toContain('rm -f "$DRILL_ROOT/identity.txt"');
  });

  it("keeps every database CLI diagnostic private even when URL parsing fails", () => {
    expect(backup).toContain('if ! supabase db dump "$@" >> "$BACKUP_DIR/dump.log" 2>&1; then');
    expect(backup).toContain(
      "Supabase logical export failed; private diagnostics will be deleted.",
    );
    expect(backup).not.toMatch(/(?:cat|tail|head|tee)\s+[^\n]*dump\.log/u);
    expect(backup).toMatch(/Cleanup transient plaintext and ciphertext[\s\S]*rm -rf/u);
    expect(backup.match(/^\s+verify_managed_schema$/gmu)).toHaveLength(2);
    expect(backup).toContain("migrations-before.txt");
    expect(backup).toContain("migrations-after.txt");
  });

  it("restores only into a pinned and isolated Supabase-local target", () => {
    expect(restore).toContain("supabase db start");
    expect(restore).toContain('TARGET_POSTGRES_MAJOR: "17"');
    expect(restore).toContain('.source_postgres_major | test("^(15|17)$")');
    expect(restore).toContain('TARGET_POSTGRES_MAJOR="$TARGET_POSTGRES_MAJOR"');
    expect(restore).toContain("major_version = {os.environ[");
    expect(restore).toContain('test "$server_major" = "$TARGET_POSTGRES_MAJOR"');
    expect(restore).toContain("docker network create --internal");
    expect(restore).toContain("DOCKER-USER");
    expect(restore).toContain("-nL INPUT");
    expect(restore).toContain("com.docker.network.bridge.host_binding_ipv4=127.0.0.1");
    expect(restore).toContain('.HostIp == "127.0.0.1"');
    expect(restore).toContain("--ctorigdstport");
    expect(restore).toContain("--single-transaction --set ON_ERROR_STOP=1");
    expect(restore).toContain("cron.launch_active_jobs = 'off'");
    expect(restore).toContain("current_setting('cron.launch_active_jobs')");
    expect(restore).not.toContain("SUPABASE_DB_URL");
    expect(restore).not.toMatch(/docker run[\s\S]{0,200}(?:^|\s)postgres:/mu);
  });

  it("fails closed on an unsupported source major or stale backup", () => {
    expect(backup).toContain('if [[ ! "$source_major" =~ ^(15|17)$ ]]');
    expect(restore).toContain('.source_postgres_major | test("^(15|17)$")');
    expect(restore).toContain("--json databaseId,createdAt,attempt,event,headBranch,headSha");
    expect(restore).toContain("age_seconds > 129600");
    expect(restore).toContain("36-hour freshness gate");
    expect(restore).toContain('if type == "object"');
    expect(backup).toContain(".provenance.run_id == $run_id");
    expect(restore).toContain(".provenance.head_sha == $head_sha");
  });

  it("bundles the reviewed managed-schema recovery hook and verifies lifecycle bindings", () => {
    const createdRole = triggerBlock(canonicalLifecycleMigration, "on_auth_user_created_role");
    const confirmedRole = triggerBlock(
      canonicalLifecycleMigration,
      "on_auth_user_email_confirmed_role",
    );
    expect(normalizeSql(managedHooks)).toBe(
      normalizeSql(`SET lock_timeout = '5s';\n${createdRole}\n${confirmedRole}`),
    );
    expect(managedLiveVerifier).toContain("auth_users_trigger_count <> 2");
    expect(managedLiveVerifier).toContain("storage_application_trigger_count <> 0");
    expect(managedLiveVerifier).toContain("trigger.tgrelid = 'auth.users'::regclass");
    expect(managedLiveVerifier).toContain("trigger.tgattr::smallint[]");
    expect(managedLiveVerifier).toContain("regexp_replace(");
    expect(managedLiveVerifier).toContain("managed_policy_count <> 0");
    expect(restore).toContain("on_auth_user_created_role");
    expect(restore).toContain("on_auth_user_email_confirmed_role");
    expect(restore).toContain("on_admin_allowlist_role_change");
    expect(restore).toContain("t.tgenabled = 'O'");
    expect(restore).toContain("AND t.tgtype = 29");
  });

  it("guards the complete app catalog and the sensitive direct-write boundary", () => {
    for (const relation of [
      "public.checks",
      "public.reports",
      "public.entities",
      "public.user_roles",
      "public.admin_allowlist",
      "public.telegram_sessions",
      "public.telegram_webhook_updates",
      "public.admin_actions",
      "public.telegram_reputation_targets",
      "public.telegram_family_shield",
      "public.rate_limit_buckets",
      "public.reputation_appeals",
      "public.embed_origin_events",
      "private.telegram_family_notification_claims",
      "private.telegram_update_leaders",
    ]) {
      expect(restore).toContain(`('${relation}')`);
      expect(backup).toContain(`"${relation}"`);
    }
    expect(restore).toContain("application function inventory failed");
    expect(restore).toContain("critical policy inventory failed");
    expect(restore).toContain("sensitive direct-write boundary failed");
    expect(restore).toContain("has_table_privilege('anon', 'public.checks', 'INSERT')");
  });

  it("keeps HOLD schedules disabled and makes cleanup residue fatal", () => {
    expect(backup).not.toMatch(/^\s+schedule:/mu);
    expect(restore).not.toMatch(/^\s+schedule:/mu);
    expect(backup).toContain('cron "17 3 * * *"');
    expect(restore).toContain('cron "23 5 * * 6"');
    expect(restore).toContain("cleanup_failed=0");
    expect(restore).toContain("cleanup left isolated resources behind");
    expect(restore).toContain("for command in iptables ip6tables");
    expect(restore).toContain('sudo "$command" -C INPUT');
    expect(restore).toContain('sudo "$command" -C DOCKER-USER');
    expect(backup).toContain("Backup cleanup left transient material behind");
    expect(backup).toContain("Read-back cleanup left decrypted material behind");
  });

  it("emits PASS/FAIL evidence without real counts or identifiers", () => {
    expect(restore).toContain("State parity and required recovery invariants: PASS");
    expect(restore).not.toMatch(/GITHUB_STEP_SUMMARY[\s\S]{0,200}\$\(.*count/iu);
    expect(restore).not.toMatch(/GITHUB_STEP_SUMMARY[\s\S]{0,200}(?:auth\.users|user_id)/iu);
    expect(restore).toMatch(/Cleanup plaintext, database and network[\s\S]*if: always\(\)/u);
  });
});
