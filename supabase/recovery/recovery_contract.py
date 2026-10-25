"""Reviewed recovery profiles. Standard library only; never opens a connection.

The caller supplies an explicit profile, never a guessed count/head. Profile
data comes from this checkout, not from a decrypted archive. CLI failures are
bounded and never print dump contents, paths, row counts or identifiers.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROFILE_NAMES = ("production-33",)


def load_profile(name):
    if name not in PROFILE_NAMES:
        raise ValueError("unreviewed recovery profile")
    document = json.loads((HERE / "baselines.json").read_text(encoding="utf-8"))
    if document["format"] != "ishonch-recovery-profiles/v1":
        raise ValueError("unsupported recovery profile format")
    profile = document["profiles"][name]
    relations = profile["relations"]
    if relations != sorted(set(relations)) or not all(re.fullmatch(r"[a-z_]+\.[a-z_]+", x) for x in relations):
        raise ValueError("invalid reviewed relation inventory")
    identities = [item["name"][:14] for item in profile["migrations"]]
    if identities != sorted(set(identities)) or len(identities) != int(name.split("-")[-1]):
        raise ValueError("invalid reviewed migration inventory")
    return profile


def fingerprint(profile):
    canonical = json.dumps(profile, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()


def versions(profile):
    return "".join(item["name"][:14] + "\n" for item in profile["migrations"])


def check_history(profile, text):
    if text != versions(profile):
        raise ValueError("exact migration history mismatch")


def check_sources(profile, directory):
    for item in profile["migrations"]:
        if not re.fullmatch(r"[0-9]{14}_[a-zA-Z0-9_-]+\.sql", item["name"]):
            raise ValueError("invalid migration filename")
        file = directory / item["name"]
        if not file.is_file():
            raise ValueError("reviewed migration source missing")
        # Git LF versus Windows CRLF is not schema drift.
        digest = hashlib.sha256(file.read_text(encoding="utf-8").encode("utf-8")).hexdigest()
        if digest != item["sha256"]:
            raise ValueError("reviewed migration source changed")


def copy_counts(profile, text):
    counts = {name: None for name in profile["relations"]}
    header = re.compile(r'^COPY (?:(?:"([^"]+)")|([a-z_][a-z0-9_]*))\.(?:(?:"([^"]+)")|([a-z_][a-z0-9_]*)) \(.+\) FROM stdin;$')
    in_copy, active = False, None
    # pg_dump COPY records use physical LF, not Unicode line separators.
    # Values may contain U+0085/U+2028/U+2029 without starting another row.
    for line in text.split("\n"):
        if in_copy:
            if line == r"\.":
                in_copy, active = False, None
            elif active is not None:
                counts[active] += 1
            continue
        match = header.fullmatch(line)
        if not match:
            if line.startswith("COPY "):
                raise ValueError("unsupported COPY header")
            continue
        schema = match.group(1) or match.group(2)
        relation = schema + "." + (match.group(3) or match.group(4))
        in_copy = True
        if relation not in counts:
            if schema in ("public", "private"):
                raise ValueError("unreviewed application relation in snapshot")
            continue
        if counts[relation] is not None:
            raise ValueError("duplicate state relation in COPY snapshot")
        counts[relation], active = 0, relation
    if in_copy or any(count is None for count in counts.values()):
        raise ValueError("state relation inventory missing from COPY snapshot")
    return "".join(f"{name}\t{counts[name]}\n" for name in profile["relations"])


def check_counts(profile, text):
    names = []
    for line in text.splitlines():
        match = re.fullmatch(r"([a-z_]+\.[a-z_]+)\t(0|[1-9][0-9]*)", line)
        if not match:
            raise ValueError("invalid count inventory format")
        names.append(match.group(1))
    if names != profile["relations"]:
        raise ValueError("state count inventory relation mismatch")


def security_sql(profile):
    def literal(value):
        return "'" + value.replace("'", "''") + "'"

    assertions = []
    for relation in profile["relations"]:
        assertions.append(f"IF to_regclass({literal(relation)}) IS NULL THEN RAISE EXCEPTION 'profile relation missing'; END IF;")
        if relation.startswith(("public.", "private.")):
            assertions.append(f"IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass({literal(relation)})) THEN RAISE EXCEPTION 'profile RLS missing'; END IF;")
    for relation, grants in profile["restricted_tables"].items():
        for role in ("anon", "authenticated", "service_role"):
            for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"):
                expected = str(role == "service_role" and privilege in grants).lower()
                check = f"IF has_table_privilege('{role}', {literal(relation)}, '{privilege}') IS DISTINCT FROM {expected} THEN RAISE EXCEPTION 'profile table privilege mismatch'; END IF;"
                if privilege == "MAINTAIN":
                    # Added in PG17. Older servers reject the privilege name;
                    # a nested PL/pgSQL IF prevents evaluating it on PG15/16.
                    check = "IF current_setting('server_version_num')::integer >= 170000 THEN " + check + " END IF;"
                assertions.append(check)
        assertions.append(f"IF EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a WHERE c.oid = to_regclass({literal(relation)}) AND a.grantee = 0) THEN RAISE EXCEPTION 'profile PUBLIC table privilege'; END IF;")
    for rpc in profile["rpc"]:
        signature = literal(rpc["signature"])
        assertions.append(f"IF to_regprocedure({signature}) IS NULL THEN RAISE EXCEPTION 'profile RPC missing'; END IF;")
        mode = str(rpc["security_definer"]).lower()
        path_config = literal("search_path=" + rpc["search_path"])
        assertions.append(f"IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure({signature}) AND prosecdef = {mode} AND coalesce(proconfig, ARRAY[]::text[]) @> ARRAY[{path_config}]) THEN RAISE EXCEPTION 'profile RPC security mode mismatch'; END IF;")
        for role in ("anon", "authenticated", "service_role"):
            expected = str((role == "service_role" and rpc["service_execute"])
                           or (role == "authenticated" and rpc.get("authenticated_execute", False))).lower()
            assertions.append(f"IF has_function_privilege('{role}', {signature}, 'EXECUTE') IS DISTINCT FROM {expected} THEN RAISE EXCEPTION 'profile RPC privilege mismatch'; END IF;")
        assertions.append(f"IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = to_regprocedure({signature}) AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN RAISE EXCEPTION 'profile PUBLIC RPC privilege'; END IF;")
    return "SET TRANSACTION READ ONLY;\nDO $recovery$ BEGIN\n" + "\n".join(assertions) + "\nEND $recovery$;\n" + schedule_sql(profile).removeprefix("SET TRANSACTION READ ONLY;\n")


def schedule_sql(profile, restore=False):
    """Rebuild only trusted migration-defined jobs; never execute their commands."""
    def literal(value):
        return "'" + value.replace("'", "''") + "'"

    jobs = profile["schedules"]
    values = ",".join("(" + ",".join(literal(job[key]) for key in ("name", "schedule", "command")) + ")" for job in jobs)
    expected = f"(VALUES {values}) AS expected(name,schedule,command)"
    match = "actual.jobname = expected.name AND actual.schedule = expected.schedule AND actual.command = expected.command AND actual.active AND actual.username = 'postgres' AND actual.database = current_database() AND actual.nodename = 'localhost' AND actual.nodeport = current_setting('port')::integer"
    preamble = ["IF to_regclass('cron.job') IS NULL THEN RAISE EXCEPTION 'profile scheduler missing'; END IF;"]
    if restore:
        preamble.append("IF current_user <> 'postgres' OR current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN RAISE EXCEPTION 'schedule restore requires isolated disabled launcher'; END IF;")
        preamble.append(f"IF EXISTS (SELECT 1 FROM cron.job actual WHERE NOT EXISTS (SELECT 1 FROM {expected} WHERE {match})) THEN RAISE EXCEPTION 'profile unexpected or changed scheduled job'; END IF;")
        for job in jobs:
            preamble.append(f"IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = {literal(job['name'])}) THEN PERFORM cron.schedule({literal(job['name'])}, {literal(job['schedule'])}, {literal(job['command'])}); END IF;")
    preamble.append(f"IF (SELECT count(*) FROM cron.job) <> {len(jobs)} OR EXISTS (SELECT 1 FROM {expected} WHERE (SELECT count(*) FROM cron.job actual WHERE {match}) <> 1) THEN RAISE EXCEPTION 'profile scheduled job mismatch'; END IF;")
    return ("" if restore else "SET TRANSACTION READ ONLY;\n") + "DO $schedules$ BEGIN\n" + "\n".join(preamble) + "\nEND $schedules$;\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "counts", "verify", "security-sql", "schedule-check-sql", "schedule-restore-sql", "fingerprint"))
    parser.add_argument("--profile", required=True, choices=PROFILE_NAMES)
    parser.add_argument("--plain", type=Path)
    parser.add_argument("--migrations", type=Path, default=HERE.parent / "migrations")
    args = parser.parse_args()
    profile = load_profile(args.profile)
    if args.mode == "fingerprint":
        print(fingerprint(profile))
        return
    if args.mode == "security-sql":
        print(security_sql(profile), end="")
        return
    if args.mode in ("schedule-check-sql", "schedule-restore-sql"):
        print(schedule_sql(profile, restore=args.mode == "schedule-restore-sql"), end="")
        return
    if args.plain is None:
        raise ValueError("private workspace is required")
    plain = args.plain
    if args.mode == "prepare":
        check_sources(profile, args.migrations)
        (plain / "expected-migrations.txt").write_text(versions(profile), encoding="ascii", newline="\n")
    elif args.mode == "counts":
        counts = copy_counts(profile, (plain / "data.sql").read_text(encoding="utf-8"))
        (plain / "expected-counts.txt").write_text(counts, encoding="ascii", newline="\n")
    elif args.mode == "verify":
        manifest = json.loads((plain / "manifest.json").read_text(encoding="utf-8"))
        if manifest.get("recovery_profile") != args.profile or manifest.get("recovery_profile_sha256") != fingerprint(profile):
            raise ValueError("authenticated recovery profile mismatch")
        check_history(profile, (plain / "expected-migrations.txt").read_text(encoding="ascii"))
        counts = (plain / "expected-counts.txt").read_text(encoding="ascii")
        check_counts(profile, counts)
        if counts != copy_counts(profile, (plain / "data.sql").read_text(encoding="utf-8")):
            raise ValueError("COPY snapshot count mismatch")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError):
        print("Recovery profile contract failed; inspect only private local diagnostics.", file=sys.stderr)
        sys.exit(1)
