"""Reproducible local encrypted restore rehearsal for the reviewed recovery profile.

Zero production credentials, zero database URL arguments, synthetic data only.
Exercises the same CLI dump split, recovery_contract.py gates, real age v1.3.1
encryption/decryption, five fail-closed negative tamper controls, pinned image
verification, internal-only target isolation (restored_authorization.py and
lifecycle_fixture_rehearsal.py), 20/20 cell-for-cell content parity before and
after pgTAP rollback, and bidirectional Docker inventory cleanup verification.

This is local synthetic verification, NOT a hosted GitHub Actions or production
backup proof.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

import recovery_contract as rc
import restored_authorization as gate
from prepare_cli_versions import prepare as prepare_cli_versions
from verify_image_identity import verify as verify_image_identity

ROOT = Path(__file__).resolve().parents[2]
DRILL_WORKFLOW = ROOT / ".github/workflows/backup-restore-drill.yml"
EXPECTED_BUNDLE_FILES = (
    "roles.sql",
    "schema.sql",
    "managed-schema.sql",
    "data.sql",
    "history_schema.sql",
    "history_data.sql",
    "expected-migrations.txt",
    "expected-counts.txt",
)
PINNED_SERVICES = ("POSTGRES", "AUTH", "STORAGE", "REALTIME")
EXTRA_PGTAP_SUITES = (
    ("telegram_media_consent_boundaries.test.sql", 346),
    ("retention_concurrency.test.sql", 13),
)

SYNTHETIC_SEED_SQL = """
-- 1. admin_allowlist (inserted before auth.users so signup trigger grants admin in user_roles)
INSERT INTO public.admin_allowlist (email)
VALUES ('synthetic-enc38-admin@example.invalid');

-- 2. auth.users (confirmed; fires on_auth_user_created_role -> populates 3. public.user_roles)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'synthetic-enc38-admin@example.invalid',
  '$2a$10$syntheticplaceholderhashonly000000000000000000000000000',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

-- 4. public.entities
INSERT INTO public.entities (
  id, entity_type, entity_hash, display_mask, risk_level, moderation_status, report_count
) VALUES (
  '33333333-3333-4333-8333-333333333331',
  'url',
  repeat('a', 64),
  'enc38-sentinel.invalid',
  'high_risk',
  'confirmed',
  1
);

-- 5. public.reports
INSERT INTO public.reports (
  id, entity_type, entity_hash, redacted_value, description, status, language
) VALUES (
  '33333333-3333-4333-8333-333333333332',
  'url',
  repeat('a', 64),
  'enc38-sentinel.invalid',
  'Synthetic enc38 sentinel report body',
  'confirmed',
  'ru'
);

-- 6. public.admin_actions
INSERT INTO public.admin_actions (
  id, admin_user_id, action, target_type, target_id, reason
) VALUES (
  '33333333-3333-4333-8333-333333333339',
  '11111111-1111-4111-8111-111111111111',
  'confirm_report',
  'report',
  '33333333-3333-4333-8333-333333333332',
  'Synthetic enc38 audit sentinel'
);

-- 7. public.checks
INSERT INTO public.checks (
  id, input_type, input_hash, redacted_input, risk_level, risk_score, reason_codes, language
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'url',
  repeat('b', 64),
  'enc38-check.invalid',
  'high_risk',
  88,
  ARRAY['known_reported'],
  'ru'
);

-- 8. public.reputation_appeals
INSERT INTO public.reputation_appeals (
  id, target_type, target_hash, target_display, reason, status
) VALUES (
  '33333333-3333-4333-8333-333333333334',
  'url',
  repeat('c', 64),
  'enc38-appeal.invalid',
  'Synthetic enc38 appeal sentinel',
  'new'
);

-- 9. public.embed_origin_events
INSERT INTO public.embed_origin_events (
  id, event_type, partner, referrer_origin, referrer_host, language, input_type, risk_level, reason_count
) VALUES (
  '33333333-3333-4333-8333-333333333335',
  'check_result',
  'enc38_partner',
  'https://enc38.example.invalid',
  'enc38.example.invalid',
  'ru',
  'url',
  'high_risk',
  2
);

-- 10. public.rate_limit_buckets
INSERT INTO public.rate_limit_buckets (
  scope, key_hash, bucket_start, window_seconds, count, expires_at
) VALUES (
  'check',
  repeat('d', 64),
  '2026-11-27 10:00:00+00'::timestamptz,
  60,
  3,
  '2026-11-27 10:06:00+00'::timestamptz
);

-- 11. public.telegram_reputation_targets
INSERT INTO public.telegram_reputation_targets (
  id, target_hash, target_type, display_hint, moderation_status, risk_level, source_type
) VALUES (
  '33333333-3333-4333-8333-333333333336',
  repeat('e', 64),
  'public_username',
  '@enc38_sentinel',
  'confirmed',
  'high_risk',
  'user_submitted_unverified'
);

-- 12. public.telegram_family_shield
INSERT INTO public.telegram_family_shield (
  id, guardian_telegram_user_id, trusted_telegram_user_id, trusted_chat_id,
  invite_code_hash, status, accepted_at, guardian_auto_alerts_enabled, trusted_auto_alerts_enabled
) VALUES (
  '33333333-3333-4333-8333-333333333337',
  88000011,
  88000012,
  88000012,
  repeat('1', 64),
  'active',
  now(),
  true,
  true
);

-- 13. public.telegram_sessions
INSERT INTO public.telegram_sessions (
  telegram_user_id, lang, scenario, scenario_step, scenario_data
) VALUES (
  88000011,
  'ru',
  'none',
  0,
  '{"sentinel":"enc38"}'::jsonb
);

-- 14. public.telegram_webhook_updates
INSERT INTO public.telegram_webhook_updates (
  update_id, status, completed_at
) VALUES (
  88000101,
  'completed',
  now()
);

-- 15. private.telegram_family_notification_claims
INSERT INTO private.telegram_family_notification_claims (
  id, family_id, idempotency_key, mode, status, completed_at
) VALUES (
  '33333333-3333-4333-8333-333333333338',
  '33333333-3333-4333-8333-333333333337',
  'enc38-sentinel-claim-key-00000001',
  'manual',
  'delivered',
  now()
);

-- 16. private.telegram_update_leaders
INSERT INTO private.telegram_update_leaders (
  name, lease_token, fence, lease_expires_at
) VALUES (
  'telegram_updates',
  '44444444-4444-4444-8444-444444444441',
  7,
  now() + interval '1 hour'
);

-- 17. private.telegram_media_provider_consents (future expiry keeps retention_concurrency cutoff exact)
INSERT INTO private.telegram_media_provider_consents (
  telegram_user_id, chat_id, chat_type, media_kind, prompt_message_id,
  requested_at, expires_at, last_update_id
) VALUES (
  88000011,
  88000011,
  'private',
  'image',
  777,
  now(),
  now() + interval '10 minutes',
  88000101
);

-- 18. private.web_ocr_ticket_claims
INSERT INTO private.web_ocr_ticket_claims (
  ticket_id, issued_at_ms, expires_at_ms
) VALUES (
  '55555555-5555-4555-8555-555555555551',
  1795700000000,
  1795700600000
);

-- 19. storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('enc38-sentinel-bucket', 'enc38-sentinel-bucket', false);

-- 20. storage.objects (metadata only; binary bucket files are outside SQL dumps)
INSERT INTO storage.objects (id, bucket_id, name)
VALUES (
  '66666666-6666-4666-8666-666666666661',
  'enc38-sentinel-bucket',
  'synthetic/enc38-sentinel.txt'
);
"""


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse_workflow_pins(workflow_text=None):
    """Read immutable CLI and image pins directly from backup-restore-drill.yml."""
    if workflow_text is None:
        workflow_text = DRILL_WORKFLOW.read_text(encoding="utf-8")
    normalized = workflow_text.replace("\r\n", "\n")
    values = {}
    for match in re.finditer(r'^  ([A-Z0-9_]+): "([^"]+)"$', normalized, re.M):
        values[match.group(1)] = match.group(2)
    required = ["SUPABASE_CLI_VERSION", "AGE_VERSION", "TARGET_POSTGRES_MAJOR"]
    for svc in PINNED_SERVICES:
        required += [
            f"SUPABASE_{svc}_IMAGE",
            f"SUPABASE_{svc}_INDEX_DIGEST",
            f"SUPABASE_{svc}_AMD64_IMAGE_ID",
        ]
    missing = [key for key in required if key not in values]
    if missing:
        raise ValueError("missing required workflow pins: " + ", ".join(missing))
    return values


def extract_drill_catalog_sql(workflow_text=None):
    """Extract the literal catalog invariant DO block from backup-restore-drill.yml."""
    if workflow_text is None:
        workflow_text = DRILL_WORKFLOW.read_text(encoding="utf-8")
    normalized = workflow_text.replace("\r\n", "\n")
    marker = "psql --dbname postgres --set ON_ERROR_STOP=1 > /dev/null <<'SQL'\n"
    if normalized.count(marker) != 1:
        raise ValueError("catalog SQL block marker is not unique")
    after = normalized.split(marker, 1)[1]
    end = "\n          SQL\n"
    if end not in after:
        raise ValueError("catalog SQL block terminator missing")
    block = after.split(end, 1)[0]
    return "\n".join(
        line[10:] if line.startswith("          ") else line
        for line in block.split("\n")
    ) + "\n"


def rewrite_roles_idempotent(roles_sql):
    """Wrap CREATE ROLE statements behind pg_roles existence checks."""
    pattern = re.compile(r'^CREATE ROLE ("?)((?:[^"]|"")+)\1(?: WITH .+)?;$')
    transformed = []
    for line in roles_sql.splitlines():
        trimmed = line.strip()
        match = pattern.match(trimmed)
        if match is None:
            transformed.append(line)
            continue
        name = match.group(2).replace('""', '"').replace("'", "''")
        statement = trimmed.replace("'", "''")
        transformed.append(
            "DO $role$ BEGIN\n"
            f"  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{name}') THEN\n"
            f"    EXECUTE '{statement}';\n"
            "  END IF;\n"
            "END $role$;"
        )
    return "\n".join(transformed) + "\n"


def diff_inventory(before, after):
    """Compare Docker resource inventories bidirectionally (added and removed)."""
    added = {}
    removed = {}
    for kind in ("containers", "volumes", "networks"):
        b_set = set(before[kind])
        a_set = set(after[kind])
        added[kind] = sorted(a_set - b_set)
        removed[kind] = sorted(b_set - a_set)
    exact = all(not added[k] and not removed[k] for k in ("containers", "volumes", "networks"))
    return {"added": added, "removed": removed, "exactMatch": exact}


def run_cmd(args, *, text_input=None, env=None, timeout=180, check=True, cwd=None):
    merged_env = {**os.environ, **(env or {})}
    result = subprocess.run(
        args,
        input=text_input,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=merged_env,
        timeout=timeout,
        cwd=cwd,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"command failed (exit={result.returncode}): {args[0]}\n"
            f"stderr: {(result.stderr or '').strip()[-800:]}"
        )
    return result


def docker_snapshot():
    def items(args):
        out = run_cmd(["docker", *args], timeout=30).stdout
        return sorted(line.strip() for line in out.splitlines() if line.strip())

    return {
        "containers": items(["ps", "-a", "--format", "{{.Names}}"]),
        "volumes": items(["volume", "ls", "-q"]),
        "networks": items(["network", "ls", "--format", "{{.Name}}"]),
    }


def psql_exec(container, sql_text, *, user="postgres", extra_args=()):
    return run_cmd(
        [
            "docker", "exec", "--user", "postgres", "-i", container,
            "psql", "-X", "-Atq", "--no-password", "-h", "/var/run/postgresql",
            "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1", *extra_args,
        ],
        text_input=sql_text,
        timeout=180,
    ).stdout.strip()


def ensure_pinned_images(pins):
    """Ensure all 4 workflow-pinned images exist locally and pass verify_image_identity."""
    verified = {}
    for svc in PINNED_SERVICES:
        image = pins[f"SUPABASE_{svc}_IMAGE"]
        digest = pins[f"SUPABASE_{svc}_INDEX_DIGEST"]
        config_id = pins[f"SUPABASE_{svc}_AMD64_IMAGE_ID"]
        candidates = [
            image,
            f"{image.split(':', 1)[0]}@{digest}",
            f"public.ecr.aws/{image}",
            digest,
        ]
        matched_ref = None
        representation = None
        for ref in candidates:
            probe = run_cmd(["docker", "image", "inspect", ref], check=False, timeout=30)
            if probe.returncode != 0:
                continue
            records = json.loads(probe.stdout)
            if len(records) != 1:
                continue
            try:
                representation = verify_image_identity(records[0], digest, config_id)
                matched_ref = ref
                break
            except ValueError:
                continue
        if matched_ref is None:
            run_cmd(["docker", "pull", f"{image}@{digest}"], timeout=600)
            matched_ref = f"{image}@{digest}"
        if matched_ref != image:
            run_cmd(["docker", "tag", matched_ref, image], timeout=30)
        final_record = json.loads(run_cmd(["docker", "image", "inspect", image], timeout=30).stdout)[0]
        representation = verify_image_identity(final_record, digest, config_id)
        verified[svc.lower()] = {"image": image, "representation": representation}
    return verified


def patch_supabase_config(config_path, project_id, db_port, major_version):
    lines = config_path.read_text(encoding="utf-8").splitlines()
    section = ""
    project_set = port_set = major_set = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            section = stripped
        elif line.startswith("project_id = "):
            lines[index] = f'project_id = "{project_id}"'
            project_set = True
        elif section == "[db]" and line.startswith("port = "):
            lines[index] = f"port = {db_port}"
            port_set = True
        elif section == "[db]" and line.startswith("major_version = "):
            lines[index] = f"major_version = {major_version}"
            major_set = True
    if not (project_set and port_set and major_set):
        raise ValueError("generated Supabase config does not contain required keys")
    config_path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def capture_relation_parity(container, relations):
    counts = {}
    digests = {}
    for relation in relations:
        schema, table = relation.split(".", 1)
        count = int(psql_exec(container, f'SELECT count(*) FROM "{schema}"."{table}";'))
        canonical = psql_exec(
            container,
            f'SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), \'[]\'::jsonb)::text FROM "{schema}"."{table}" t;',
        )
        counts[relation] = count
        digests[relation] = sha256_text(canonical)
    return counts, digests


def has_native_age_v131():
    if not all(shutil.which(cmd) for cmd in ("age", "age-keygen", "sha256sum")):
        return False
    probe = run_cmd(["age", "--version"], check=False, timeout=15)
    return probe.returncode == 0 and probe.stdout.strip() == "v1.3.1"


def run_crypto_bash(crypto_dir, script, *, use_native, check=True):
    if use_native:
        return run_cmd(
            ["bash", "-ceu", script],
            env={"CRYPTO_DIR": str(crypto_dir), "LC_ALL": "C", "TZ": "UTC"},
            timeout=120,
            check=check,
        )
    mount_src = str(Path(crypto_dir).resolve()).replace("\\", "/")
    return run_cmd(
        [
            "docker", "run", "--rm", "--network", "none", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges", "--entrypoint", "/bin/bash",
            "--mount", f"type=bind,source={mount_src},target=/work/crypto",
            "-e", "CRYPTO_DIR=/work/crypto",
            "ishonch-recovery-gates:local", "-ceu", script,
        ],
        timeout=120,
        check=check,
    )


def stop_and_remove_project(workdir, project_id, extra_networks=()):
    if workdir and Path(workdir).exists():
        run_cmd(["supabase", "stop", "--workdir", str(workdir), "--no-backup"], check=False, timeout=90)
    for filter_arg in (f"label=com.supabase.cli.project={project_id}", f"name={project_id}"):
        containers = run_cmd(["docker", "ps", "-aq", "--filter", filter_arg], check=False, timeout=30).stdout.split()
        if containers:
            run_cmd(["docker", "rm", "-f", *containers], check=False, timeout=30)
        volumes = run_cmd(["docker", "volume", "ls", "-q", "--filter", filter_arg], check=False, timeout=30).stdout.split()
        if volumes:
            run_cmd(["docker", "volume", "rm", *volumes], check=False, timeout=30)
        networks = run_cmd(["docker", "network", "ls", "-q", "--filter", filter_arg], check=False, timeout=30).stdout.split()
        if networks:
            run_cmd(["docker", "network", "rm", *networks], check=False, timeout=30)
    for net in (*extra_networks, f"supabase_network_{project_id}"):
        if run_cmd(["docker", "network", "inspect", net], check=False, timeout=30).returncode == 0:
            run_cmd(["docker", "network", "rm", net], check=False, timeout=30)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, choices=rc.PROFILE_NAMES)
    parser.add_argument("--run-id", default=str(int(time.time()) % 1000000))
    parser.add_argument("--source-port", type=int, default=58422)
    parser.add_argument("--target-port", type=int, default=59422)
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[0-9]{1,10}", args.run_id):
        raise ValueError("run-id must be 1..10 ASCII digits")
    if not (1024 <= args.source_port <= 65535 and 1024 <= args.target_port <= 65535) or args.source_port == args.target_port:
        raise ValueError("source-port and target-port must be distinct non-privileged ports")
    return args


def rehearse(profile_name, run_id, source_port, target_port):
    profile = rc.load_profile(profile_name)
    pins = parse_workflow_pins()
    cli_ver = run_cmd(["supabase", "--version"], timeout=30).stdout.strip()
    if cli_ver != pins["SUPABASE_CLI_VERSION"]:
        raise RuntimeError(f"supabase CLI {cli_ver} != pinned {pins['SUPABASE_CLI_VERSION']}")

    use_native_age = has_native_age_v131()
    if not use_native_age:
        gate_probe = run_cmd(["docker", "image", "inspect", "ishonch-recovery-gates:local"], check=False, timeout=30)
        if gate_probe.returncode != 0:
            run_cmd(
                [
                    "docker", "build", "--platform", "linux/amd64",
                    "--file", str(ROOT / "supabase/recovery/workflow-gates.Dockerfile"),
                    "--tag", "ishonch-recovery-gates:local",
                    str(ROOT / "supabase/recovery"),
                ],
                timeout=300,
            )

    pinned_images = ensure_pinned_images(pins)
    before_docker = docker_snapshot()

    src_project = f"ishonch-src-drill-{run_id}"
    tgt_project = f"ishonch-full-drill-{run_id}"
    tgt_internal_net = f"ishonch-full-internal-{run_id}"
    src_container = f"supabase_db_{src_project}"
    tgt_container = f"supabase_db_{tgt_project}"
    cli_env = {
        "SUPABASE_TELEMETRY_DISABLED": "1",
        "DO_NOT_TRACK": "1",
        "SUPABASE_INTERNAL_IMAGE_REGISTRY": "docker.io",
        **pins,
    }

    report = {
        "platform": sys.platform,
        "profile": profile_name,
        "profileFingerprint": rc.fingerprint(profile),
        "supabaseCli": cli_ver,
        "pinnedImagesVerified": pinned_images,
        "ageRuntime": "native-v1.3.1" if use_native_age else "offline-container-v1.3.1",
        "all20TablesNonEmptyInSource": False,
        "sourceChecks": {
            "verifyManagedSchemaLive": False,
            "scheduleCheckSql": False,
            "migrationsCount": 0,
        },
        "encryption": {
            "ageVersion": None,
            "ciphertextBytes": 0,
            "ciphertextSha256": None,
            "sourcePlaintextDeletedBeforeRestore": False,
        },
        "negativeTamperControls": {
            "wrongKeyNonZeroExit": False,
            "corruptedCiphertextSha256NonZeroExit": False,
            "corruptedCiphertextAgeDecryptNonZeroExit": False,
            "tamperedCountsVerifyNonZeroExit": False,
            "tamperedProfileHashVerifyNonZeroExit": False,
        },
        "restoreVerification": {
            "decryptedManifestVerified": False,
            "recoveryContractVerifyPassed": False,
            "targetLoopbackBindingVerified": False,
            "targetInternalNetworkIsolated": False,
            "targetSafePortsBeforeDataCopy": False,
            "cronLauncherDisabled": False,
            "singleTransactionRestorePassed": False,
            "migrationsExactMatch38": False,
            "countsExactMatch20": False,
            "cellContentDigestsExactMatch20": False,
            "profileSecuritySqlPassed": False,
            "verifyManagedSchemaLiveOnTargetPassed": False,
            "workflowCatalogDoBlockPassed": False,
            "restoredAuthorizationCliPassed": False,
            "restoredAuthorizationAssertions": 0,
            "all10PgtapSuitesPassed": False,
            "all10PgtapAssertions": 0,
            "lifecycleCollisionCliPassed": False,
            "lifecycleCollisionAssertions": 0,
            "postPgtapCellContentDigestsExactMatch20": False,
        },
        "cleanup": {
            "tempDirDeleted": False,
            "bidirectionalDockerDiff": None,
            "exactBeforeAfterMatch": False,
        },
        "productionTouched": False,
        "hostedActions": "NOT RUN",
        "hostFirewall": "NOT RUN",
        "overallPass": False,
    }

    temp_root = Path(tempfile.mkdtemp(prefix=f"ishonch-rehearsal-{run_id}-"))
    os.chmod(temp_root, 0o700)
    src_dir = temp_root / "src"
    tgt_dir = temp_root / "tgt"
    dump_cli_dir = temp_root / "dump-cli"
    export_plain = temp_root / "export-plain"
    crypto_dir = temp_root / "crypto"
    restore_plain = temp_root / "restore-plain"
    neg_dir = temp_root / "negatives"
    fatal_error = None

    try:
        for directory in (src_dir, tgt_dir, dump_cli_dir, export_plain, crypto_dir, restore_plain, neg_dir):
            directory.mkdir(mode=0o700)

        # 1. Start isolated source stack with all 38 migrations and pinned images.
        run_cmd(["supabase", "init", "--workdir", str(src_dir), "--yes"], env=cli_env, timeout=60)
        prepare_cli_versions(src_dir, pins)
        patch_supabase_config(src_dir / "supabase/config.toml", src_project, source_port, pins["TARGET_POSTGRES_MAJOR"])
        shutil.copytree(ROOT / "supabase/migrations", src_dir / "supabase/migrations", dirs_exist_ok=True)
        run_cmd(
            [
                "docker", "network", "create", "--driver", "bridge",
                "--label", f"com.supabase.cli.project={src_project}",
                "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
                f"supabase_network_{src_project}",
            ],
            timeout=30,
        )
        run_cmd(["supabase", "db", "start", "--workdir", str(src_dir), "--yes"], env=cli_env, timeout=240)

        # 2. Seed unique synthetic rows across ALL 20 tables.
        psql_exec(src_container, SYNTHETIC_SEED_SQL)
        src_counts, src_digests = capture_relation_parity(src_container, profile["relations"])
        if not all(src_counts[rel] >= 1 for rel in profile["relations"]):
            raise RuntimeError("not all 20 relations populated in source")
        report["all20TablesNonEmptyInSource"] = True

        # 3. Pre-export read-only checks and official 5-file logical dump.
        psql_exec(
            src_container,
            (ROOT / "supabase/recovery/verify-managed-schema-live.sql").read_text(encoding="utf-8"),
            extra_args=("--single-transaction",),
        )
        report["sourceChecks"]["verifyManagedSchemaLive"] = True
        psql_exec(src_container, rc.schedule_sql(profile, restore=False), extra_args=("--single-transaction",))
        report["sourceChecks"]["scheduleCheckSql"] = True

        run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/recovery_contract.py"),
             "prepare", "--profile", profile_name, "--plain", str(export_plain)],
            timeout=60,
        )
        src_migrations = psql_exec(
            src_container,
            "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;",
        ) + "\n"
        expected_migrations = (export_plain / "expected-migrations.txt").read_text(encoding="ascii")
        if src_migrations != expected_migrations:
            raise RuntimeError("source migrations mismatch expected-migrations.txt")
        report["sourceChecks"]["migrationsCount"] = len(src_migrations.strip().splitlines())

        run_cmd(["supabase", "init", "--workdir", str(dump_cli_dir), "--yes"], env=cli_env, timeout=60)
        prepare_cli_versions(dump_cli_dir, pins, postgres_only=True)
        src_url = f"postgresql://postgres:postgres@127.0.0.1:{source_port}/postgres"
        dump_specs = [
            ["--file", str(export_plain / "roles.sql"), "--role-only", "--keep-comments"],
            ["--file", str(export_plain / "schema.sql"), "--keep-comments"],
            [
                "--file", str(export_plain / "data.sql"), "--data-only", "--use-copy",
                "--exclude", "storage.buckets_vectors",
                "--exclude", "storage.vector_indexes",
                "--exclude", "auth.migrations",
                "--exclude", "storage.migrations",
                "--exclude", "supabase_functions.migrations",
            ],
            ["--file", str(export_plain / "history_schema.sql"), "--schema", "supabase_migrations", "--keep-comments"],
            ["--file", str(export_plain / "history_data.sql"), "--schema", "supabase_migrations", "--data-only", "--use-copy"],
        ]
        for extra in dump_specs:
            run_cmd(["supabase", "db", "dump", "--workdir", str(dump_cli_dir), "--db-url", src_url, *extra], env=cli_env, timeout=180)
        shutil.copy2(ROOT / "supabase/recovery/managed-schema-hooks.sql", export_plain / "managed-schema.sql")

        run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/recovery_contract.py"),
             "counts", "--profile", profile_name, "--plain", str(export_plain)],
            timeout=60,
        )
        manifest = {
            "format": "ishonch-guard-supabase-logical-backup/v4",
            "supabase_cli": pins["SUPABASE_CLI_VERSION"],
            "source_postgres_major": "17",
            "recovery_profile": profile_name,
            "recovery_profile_sha256": rc.fingerprint(profile),
            "provenance": {
                "repository": "local/rehearsal",
                "run_id": run_id,
                "run_attempt": "1",
                "head_sha": "a" * 40,
            },
            "files": {name: sha256_file(export_plain / name) for name in EXPECTED_BUNDLE_FILES},
        }
        (export_plain / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8", newline="\n")

        # Pack deterministic tar and encrypt with real age v1.3.1.
        bundle_tar = crypto_dir / "backup.tar"
        with tarfile.open(bundle_tar, mode="w") as archive:
            for name in sorted([*EXPECTED_BUNDLE_FILES, "manifest.json"]):
                file_path = export_plain / name
                info = tarfile.TarInfo(name=name)
                info.size = file_path.stat().st_size
                info.uid = 0
                info.gid = 0
                info.uname = ""
                info.gname = ""
                info.mtime = 0
                with file_path.open("rb") as fh:
                    archive.addfile(info, fh)

        enc_meta = run_crypto_bash(
            crypto_dir,
            """
            umask 077
            age_ver="$(age --version)"
            test "$age_ver" = "v1.3.1"
            age-keygen -o "$CRYPTO_DIR/identity.txt" 2>/dev/null
            age-keygen -o "$CRYPTO_DIR/wrong-identity.txt" 2>/dev/null
            recipient="$(age-keygen -y "$CRYPTO_DIR/identity.txt")"
            age --encrypt --recipient "$recipient" \
              --output "$CRYPTO_DIR/supabase-backup.tar.age" \
              "$CRYPTO_DIR/backup.tar"
            sha256sum "$CRYPTO_DIR/supabase-backup.tar.age" | cut -d' ' -f1 > "$CRYPTO_DIR/supabase-backup.tar.age.sha256"
            rm -f "$CRYPTO_DIR/backup.tar"
            printf '%s\t%s\t%s\n' "$age_ver" "$(stat -c %s "$CRYPTO_DIR/supabase-backup.tar.age")" "$(cat "$CRYPTO_DIR/supabase-backup.tar.age.sha256")"
            """,
            use_native=use_native_age,
        ).stdout.strip()
        age_ver, cipher_bytes, cipher_sha = enc_meta.split("\t")
        report["encryption"]["ageVersion"] = age_ver
        report["encryption"]["ciphertextBytes"] = int(cipher_bytes)
        report["encryption"]["ciphertextSha256"] = cipher_sha

        # Delete ALL source plaintext and stop/remove source stack BEFORE negative tests & restore.
        shutil.rmtree(export_plain)
        if export_plain.exists() or bundle_tar.exists():
            raise RuntimeError("source plaintext was not deleted before restore")
        report["encryption"]["sourcePlaintextDeletedBeforeRestore"] = True
        stop_and_remove_project(src_dir, src_project)
        shutil.rmtree(src_dir, ignore_errors=True)

        # 4. Negative fail-closed tamper controls (all as real non-zero command exits).
        wrong_key = run_crypto_bash(
            crypto_dir,
            'age --decrypt --identity "$CRYPTO_DIR/wrong-identity.txt" --output "$CRYPTO_DIR/bad-wrong.tar" "$CRYPTO_DIR/supabase-backup.tar.age"',
            use_native=use_native_age,
            check=False,
        )
        if wrong_key.returncode == 0:
            raise RuntimeError("wrong age key unexpectedly decrypted bundle")
        (crypto_dir / "bad-wrong.tar").unlink(missing_ok=True)
        report["negativeTamperControls"]["wrongKeyNonZeroExit"] = True

        corrupted = bytearray((crypto_dir / "supabase-backup.tar.age").read_bytes())
        corrupted[-1] ^= 0x01
        (crypto_dir / "corrupted.tar.age").write_bytes(bytes(corrupted))
        corrupt_sha_check = run_crypto_bash(
            crypto_dir,
            'printf "%s  %s\\n" "$(cat "$CRYPTO_DIR/supabase-backup.tar.age.sha256")" "$CRYPTO_DIR/corrupted.tar.age" | sha256sum --check --status',
            use_native=use_native_age,
            check=False,
        )
        if corrupt_sha_check.returncode == 0:
            raise RuntimeError("sha256sum --check unexpectedly accepted corrupted ciphertext")
        report["negativeTamperControls"]["corruptedCiphertextSha256NonZeroExit"] = True

        corrupt_age_check = run_crypto_bash(
            crypto_dir,
            'age --decrypt --identity "$CRYPTO_DIR/identity.txt" --output "$CRYPTO_DIR/bad-corrupt.tar" "$CRYPTO_DIR/corrupted.tar.age"',
            use_native=use_native_age,
            check=False,
        )
        if corrupt_age_check.returncode == 0:
            raise RuntimeError("age --decrypt unexpectedly accepted corrupted ciphertext")
        (crypto_dir / "corrupted.tar.age").unlink(missing_ok=True)
        (crypto_dir / "bad-corrupt.tar").unlink(missing_ok=True)
        report["negativeTamperControls"]["corruptedCiphertextAgeDecryptNonZeroExit"] = True

        # 5. Positive checksum verification + age decrypt + strict tar allowlist extraction.
        run_crypto_bash(
            crypto_dir,
            """
            umask 077
            printf '%s  %s\n' "$(cat "$CRYPTO_DIR/supabase-backup.tar.age.sha256")" "$CRYPTO_DIR/supabase-backup.tar.age" \
              | sha256sum --check --status
            age --decrypt --identity "$CRYPTO_DIR/identity.txt" \
              --output "$CRYPTO_DIR/decrypted.tar" \
              "$CRYPTO_DIR/supabase-backup.tar.age"
            """,
            use_native=use_native_age,
        )
        decrypted_tar = crypto_dir / "decrypted.tar"
        expected_members = sorted([*EXPECTED_BUNDLE_FILES, "manifest.json"])
        with tarfile.open(decrypted_tar, mode="r:") as archive:
            members = archive.getmembers()
            if sorted(m.name for m in members) != expected_members:
                raise RuntimeError("decrypted archive member allowlist mismatch")
            if any(not m.isfile() for m in members):
                raise RuntimeError("decrypted archive contains non-regular member")
            for member in members:
                src_stream = archive.extractfile(member)
                if src_stream is None:
                    raise RuntimeError("unreadable tar member")
                with (restore_plain / member.name).open("xb") as out_fh:
                    shutil.copyfileobj(src_stream, out_fh)
        decrypted_tar.unlink()

        restored_manifest = json.loads((restore_plain / "manifest.json").read_text(encoding="utf-8"))
        if (
            restored_manifest.get("format") != "ishonch-guard-supabase-logical-backup/v4"
            or restored_manifest.get("recovery_profile") != profile_name
            or restored_manifest.get("recovery_profile_sha256") != rc.fingerprint(profile)
        ):
            raise RuntimeError("restored manifest header mismatch")
        for name in EXPECTED_BUNDLE_FILES:
            if sha256_file(restore_plain / name) != restored_manifest["files"][name]:
                raise RuntimeError(f"restored member SHA-256 mismatch: {name}")
        report["restoreVerification"]["decryptedManifestVerified"] = True

        run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/recovery_contract.py"),
             "verify", "--profile", profile_name, "--plain", str(restore_plain)],
            timeout=60,
        )
        report["restoreVerification"]["recoveryContractVerifyPassed"] = True

        # Remaining 2 negative controls against recovery_contract.py verify.
        bad_counts_dir = neg_dir / "bad-counts"
        shutil.copytree(restore_plain, bad_counts_dir)
        (bad_counts_dir / "expected-counts.txt").write_text(
            (bad_counts_dir / "expected-counts.txt").read_text(encoding="ascii").replace("auth.users\t1", "auth.users\t2", 1),
            encoding="ascii",
            newline="\n",
        )
        if run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/recovery_contract.py"),
             "verify", "--profile", profile_name, "--plain", str(bad_counts_dir)],
            check=False,
            timeout=60,
        ).returncode == 0:
            raise RuntimeError("tampered expected-counts.txt unexpectedly passed verify")
        report["negativeTamperControls"]["tamperedCountsVerifyNonZeroExit"] = True

        bad_manifest_dir = neg_dir / "bad-manifest"
        shutil.copytree(restore_plain, bad_manifest_dir)
        bad_manifest = json.loads((bad_manifest_dir / "manifest.json").read_text(encoding="utf-8"))
        bad_manifest["recovery_profile_sha256"] = "0" * 64
        (bad_manifest_dir / "manifest.json").write_text(json.dumps(bad_manifest) + "\n", encoding="utf-8", newline="\n")
        if run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/recovery_contract.py"),
             "verify", "--profile", profile_name, "--plain", str(bad_manifest_dir)],
            check=False,
            timeout=60,
        ).returncode == 0:
            raise RuntimeError("tampered recovery_profile_sha256 unexpectedly passed verify")
        report["negativeTamperControls"]["tamperedProfileHashVerifyNonZeroExit"] = True

        # 6. Start clean empty isolated target with exact workflow loopback + internal-network isolation.
        cli_bridge = f"supabase_network_{tgt_project}"
        run_cmd(
            [
                "docker", "network", "create", "--driver", "bridge",
                "--label", f"com.supabase.cli.project={tgt_project}",
                "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
                cli_bridge,
            ],
            timeout=30,
        )
        run_cmd(["supabase", "init", "--workdir", str(tgt_dir), "--yes"], env=cli_env, timeout=60)
        prepare_cli_versions(tgt_dir, pins)
        patch_supabase_config(tgt_dir / "supabase/config.toml", tgt_project, target_port, pins["TARGET_POSTGRES_MAJOR"])
        run_cmd(["supabase", "db", "start", "--workdir", str(tgt_dir), "--yes"], env=cli_env, timeout=240)

        target_info = json.loads(run_cmd(["docker", "inspect", tgt_container], timeout=30).stdout)[0]
        if target_info["Config"]["Image"] != pins["SUPABASE_POSTGRES_IMAGE"]:
            raise RuntimeError("target container image tag mismatch")
        port_map = target_info["NetworkSettings"]["Ports"].get("5432/tcp") or []
        if len(port_map) != 1 or port_map[0].get("HostIp") != "127.0.0.1" or port_map[0].get("HostPort") != str(target_port):
            raise RuntimeError(f"target container 5432/tcp binding is not loopback-only: {port_map}")
        report["restoreVerification"]["targetLoopbackBindingVerified"] = True

        # Move empty target container to internal-only Docker network and detach
        # the CLI NAT bridge BEFORE copying any decrypted data into the container.
        run_cmd(["docker", "network", "create", "--internal", tgt_internal_net], timeout=30)
        run_cmd(["docker", "network", "connect", tgt_internal_net, tgt_container], timeout=30)
        for old_net in list(target_info["NetworkSettings"]["Networks"].keys()):
            if old_net != tgt_internal_net:
                run_cmd(["docker", "network", "disconnect", old_net, tgt_container], timeout=30)
        isolated_info = json.loads(run_cmd(["docker", "inspect", tgt_container], timeout=30).stdout)[0]
        isolated_nets = list(isolated_info["NetworkSettings"]["Networks"].keys())
        if isolated_nets != [tgt_internal_net]:
            raise RuntimeError(f"target not isolated to internal network: {isolated_nets}")
        report["restoreVerification"]["targetInternalNetworkIsolated"] = True

        isolated_ports = isolated_info["NetworkSettings"].get("Ports")
        safe_ports = isolated_ports in (
            {"5432/tcp": None},
            {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(target_port)}]},
        )
        if not safe_ports:
            raise RuntimeError(f"isolated target still exposes unsafe ports: {isolated_ports}")
        report["restoreVerification"]["targetSafePortsBeforeDataCopy"] = True

        # Disable pg_cron launcher before restoring schedules.
        psql_exec(
            tgt_container,
            "ALTER SYSTEM SET cron.launch_active_jobs = 'off'; SELECT pg_reload_conf();",
            user="supabase_admin",
        )
        cron_state = ""
        for _ in range(10):
            cron_state = psql_exec(tgt_container, "SELECT current_setting('cron.launch_active_jobs');")
            if cron_state == "off":
                break
            time.sleep(0.5)
        if cron_state != "off":
            raise RuntimeError(f"cron.launch_active_jobs remained {cron_state!r}")
        report["restoreVerification"]["cronLauncherDisabled"] = True

        # 7. Replay single-transaction restore on isolated target.
        (restore_plain / "roles-idempotent.sql").write_text(
            rewrite_roles_idempotent((restore_plain / "roles.sql").read_text(encoding="utf-8")),
            encoding="utf-8",
            newline="\n",
        )
        shutil.copy2(ROOT / "supabase/recovery/prepare-isolated-target.sql", restore_plain / "prepare-isolated-target.sql")
        (restore_plain / "profile-security.sql").write_text(rc.security_sql(profile), encoding="utf-8", newline="\n")
        (restore_plain / "profile-schedules.sql").write_text(rc.schedule_sql(profile, restore=True), encoding="utf-8", newline="\n")

        run_cmd(["docker", "exec", tgt_container, "install", "-d", "-m", "0700", "-o", "postgres", "-g", "postgres", "/tmp/restore"], timeout=30)
        run_cmd(["docker", "cp", f"{restore_plain}/.", f"{tgt_container}:/tmp/restore/"], timeout=60)
        run_cmd(["docker", "exec", tgt_container, "chown", "-R", "postgres:postgres", "/tmp/restore"], timeout=30)

        run_cmd(
            [
                "docker", "exec", "--user", "postgres", tgt_container,
                "psql", "--dbname", "postgres", "--single-transaction", "--set", "ON_ERROR_STOP=1",
                "--file", "/tmp/restore/roles-idempotent.sql",
                "--file", "/tmp/restore/prepare-isolated-target.sql",
                "--file", "/tmp/restore/schema.sql",
                "--file", "/tmp/restore/managed-schema.sql",
                "--command", "SET session_replication_role = replica",
                "--file", "/tmp/restore/data.sql",
                "--command", "SET session_replication_role = origin",
                "--command", "DROP SCHEMA IF EXISTS supabase_migrations CASCADE",
                "--file", "/tmp/restore/history_schema.sql",
                "--file", "/tmp/restore/history_data.sql",
                "--file", "/tmp/restore/profile-schedules.sql",
            ],
            timeout=180,
        )
        report["restoreVerification"]["singleTransactionRestorePassed"] = True

        # 8. Assert migrations, 20/20 counts & cell-for-cell digests, security-sql, catalog, CLI auth & collision gates.
        tgt_migrations = psql_exec(
            tgt_container,
            "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;",
        ) + "\n"
        if tgt_migrations != expected_migrations or len(tgt_migrations.strip().splitlines()) != 38:
            raise RuntimeError("restored migration history mismatch")
        report["restoreVerification"]["migrationsExactMatch38"] = True

        tgt_counts, tgt_digests = capture_relation_parity(tgt_container, profile["relations"])
        expected_counts_text = (restore_plain / "expected-counts.txt").read_text(encoding="ascii")
        actual_counts_text = "".join(f"{rel}\t{tgt_counts[rel]}\n" for rel in profile["relations"])
        if actual_counts_text != expected_counts_text:
            raise RuntimeError("restored state counts mismatch expected-counts.txt")
        report["restoreVerification"]["countsExactMatch20"] = True

        if tgt_digests != src_digests:
            mismatched = [r for r in profile["relations"] if tgt_digests[r] != src_digests[r]]
            raise RuntimeError("cell-for-cell content digest mismatch: " + ", ".join(mismatched))
        report["restoreVerification"]["cellContentDigestsExactMatch20"] = True

        run_cmd(
            [
                "docker", "exec", "--user", "postgres", tgt_container,
                "psql", "--no-psqlrc", "--dbname", "postgres", "--single-transaction",
                "--set", "ON_ERROR_STOP=1", "--file", "/tmp/restore/profile-security.sql",
            ],
            timeout=120,
        )
        report["restoreVerification"]["profileSecuritySqlPassed"] = True

        psql_exec(
            tgt_container,
            (ROOT / "supabase/recovery/verify-managed-schema-live.sql").read_text(encoding="utf-8"),
            extra_args=("--single-transaction",),
        )
        report["restoreVerification"]["verifyManagedSchemaLiveOnTargetPassed"] = True

        psql_exec(tgt_container, extract_drill_catalog_sql())
        report["restoreVerification"]["workflowCatalogDoBlockPassed"] = True

        # Execute the REAL workflow CLI gates with full verify_isolation().
        drill_env = {
            "DRILL_PROJECT_ID": tgt_project,
            "DRILL_INTERNAL_NETWORK": tgt_internal_net,
            "DRILL_DB_PORT": str(target_port),
            "SUPABASE_POSTGRES_AMD64_IMAGE_ID": pins["SUPABASE_POSTGRES_AMD64_IMAGE_ID"],
            "SUPABASE_POSTGRES_INDEX_DIGEST": pins["SUPABASE_POSTGRES_INDEX_DIGEST"],
        }
        auth_cli_out = run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/restored_authorization.py"), "--profile", profile_name],
            env=drill_env,
            timeout=240,
        ).stdout.strip()
        auth_match = re.search(r"PASS \((\d+) assertions; fixtures rolled back\)", auth_cli_out)
        if not auth_match or int(auth_match.group(1)) != 302:
            raise RuntimeError(f"unexpected restored_authorization.py output: {auth_cli_out}")
        report["restoreVerification"]["restoredAuthorizationCliPassed"] = True
        report["restoreVerification"]["restoredAuthorizationAssertions"] = int(auth_match.group(1))

        # Run remaining 2 pgTAP suites (346 + 13 = 359 -> 661 total).
        extra_tests = [
            ((ROOT / "supabase/tests" / fname).read_text(encoding="utf-8"), expected)
            for fname, expected in EXTRA_PGTAP_SUITES
        ]
        extra_passed = gate.run_tests(tgt_container, extra_tests)
        total_pgtap = report["restoreVerification"]["restoredAuthorizationAssertions"] + extra_passed
        if total_pgtap != 661:
            raise RuntimeError(f"expected 661 total pgTAP assertions, got {total_pgtap}")
        report["restoreVerification"]["all10PgtapSuitesPassed"] = True
        report["restoreVerification"]["all10PgtapAssertions"] = total_pgtap

        # Execute the REAL 7-case P2 collision matrix CLI with full verify_isolation().
        lfr_out = run_cmd(
            [sys.executable, "-B", str(ROOT / "supabase/recovery/lifecycle_fixture_rehearsal.py")],
            env=drill_env,
            timeout=240,
        ).stdout.strip()
        lfr_match = re.search(r"PASS \(7 cases; (\d+) assertions; rows preserved\)", lfr_out)
        if not lfr_match or int(lfr_match.group(1)) != 287:
            raise RuntimeError(f"unexpected lifecycle_fixture_rehearsal.py output: {lfr_out}")
        report["restoreVerification"]["lifecycleCollisionCliPassed"] = True
        report["restoreVerification"]["lifecycleCollisionAssertions"] = int(lfr_match.group(1))

        # Re-verify ALL 20 tables' cell-for-cell SHA-256 digests AFTER every pgTAP & collision rollback.
        _, post_digests = capture_relation_parity(tgt_container, profile["relations"])
        if post_digests != src_digests:
            mismatched = [r for r in profile["relations"] if post_digests[r] != src_digests[r]]
            raise RuntimeError("post-pgTAP cell-for-cell digest drift: " + ", ".join(mismatched))
        report["restoreVerification"]["postPgtapCellContentDigestsExactMatch20"] = True
    except Exception as exc:
        fatal_error = str(exc)
    finally:
        stop_and_remove_project(src_dir, src_project)
        stop_and_remove_project(tgt_dir, tgt_project, extra_networks=(tgt_internal_net,))
        shutil.rmtree(temp_root, ignore_errors=True)
        report["cleanup"]["tempDirDeleted"] = not temp_root.exists()
        after_docker = docker_snapshot()
        inv_diff = diff_inventory(before_docker, after_docker)
        report["cleanup"]["bidirectionalDockerDiff"] = inv_diff
        report["cleanup"]["exactBeforeAfterMatch"] = report["cleanup"]["tempDirDeleted"] and inv_diff["exactMatch"]
        report["overallPass"] = (
            fatal_error is None
            and report["all20TablesNonEmptyInSource"]
            and all(report["negativeTamperControls"].values())
            and all(v for v in report["restoreVerification"].values() if isinstance(v, bool))
            and report["cleanup"]["exactBeforeAfterMatch"]
        )
        print(json.dumps(report, indent=2))
        if fatal_error is not None:
            print("Rehearsal error: " + fatal_error, file=sys.stderr)
    return 0 if report["overallPass"] else 1


def main():
    args = parse_args()
    return rehearse(args.profile, args.run_id, args.source_port, args.target_port)


if __name__ == "__main__":
    raise SystemExit(main())
