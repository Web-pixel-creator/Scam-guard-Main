"""Execute real workflow Bash/jq/age gates with synthetic data on Linux.

No Docker socket, database, cloud credentials or real gh client is used. Run in
an offline Linux container after provisioning checksum-verified age 1.3.1 and
jq. This is component evidence, NOT a hosted Actions or firewall/DB proof.
"""
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import textwrap

import recovery_contract as rc

ROOT = Path(__file__).resolve().parents[2]
BACKUP = "backup.yml"
DRILL = "backup-restore-drill.yml"
NOW = 1792065600  # 2026-10-15T12:00:00Z; deterministic freshness boundaries.
SHA = "a" * 40
REPO = "synthetic-owner/synthetic-recovery"
FILES = ["roles.sql", "schema.sql", "managed-schema.sql", "data.sql",
         "history_schema.sql", "history_data.sql", "expected-migrations.txt",
         "expected-counts.txt"]


def step(workflow, name):
    """Extract one literal run block, fail on missing/ambiguous/layout drift."""
    text = (ROOT / ".github/workflows" / workflow).read_text(encoding="utf-8")
    marker = "      - name: " + name + "\n"
    if text.count(marker) != 1:
        raise ValueError("workflow step is not unique: " + name)
    section = text.split(marker, 1)[1].split("\n      - name:", 1)[0]
    block = section.split("        run: |\n", 1)[1]
    lines = []
    for line in block.splitlines():
        if line and not line.startswith("          "):
            break
        lines.append(line[10:])
    if not lines or not lines[0].startswith("set "):
        raise ValueError("unexpected workflow run layout")
    return "\n".join(lines) + "\n"


def executable(path, text):
    path.write_text(text, encoding="utf-8")
    path.chmod(0o700)


def main():
    if sys.platform != "linux":
        raise SystemExit("Linux is required; Windows/Git Bash is not equivalent")
    for command in ("bash", "jq", "age", "age-keygen", "date", "sha256sum"):
        if not shutil.which(command):
            raise SystemExit("missing prerequisite: " + command)
    if Path("/var/run/docker.sock").exists():
        raise SystemExit("this offline harness must not have a Docker socket")
    if subprocess.check_output(["age", "--version"], text=True).strip() != "v1.3.1":
        raise SystemExit("unreviewed age version")
    results = []
    clean_env = {"PATH": os.environ["PATH"], "LC_ALL": "C", "TZ": "UTC",
                 "PYTHONDONTWRITEBYTECODE": "1"}

    def run(script, env):
        return subprocess.run(["bash", "-c", script], cwd=ROOT,
                              env={**clean_env, **env}, capture_output=True,
                              text=True, timeout=30)

    def record(name, process, success):
        ok = (process.returncode == 0) == success
        results.append({"case": name, "pass": ok})
        # Never print decrypted records, keys, process environment or raw logs.
        if not ok:
            print("FAIL: " + name, file=sys.stderr)

    with tempfile.TemporaryDirectory(prefix="ishonch-linux-gates-") as temporary:
        base = Path(temporary)
        tools = base / "bin"
        tools.mkdir()
        executable(tools / "date", "#!/bin/bash\n"
                   'if [[ "$*" == "--utc +%s" ]]; then echo ' + str(NOW) +
                   '; else exec /usr/bin/date "$@"; fi\n')
        executable(tools / "gh", textwrap.dedent('''\
            #!/bin/bash
            set -eu
            [[ "$*" == "run list --repo synthetic-owner/synthetic-recovery --workflow backup.yml --branch main --status success --limit 1 --json databaseId,createdAt,attempt,event,headBranch,headSha --jq first" ]] || exit 97
            printf 'fixture-read\n' >> "$GH_CALLS"
            [[ "${GH_FAIL:-0}" == 0 ]] || exit 1
            cat "$GH_FIXTURE"
            '''))
        def iso(age):
            return dt.datetime.fromtimestamp(NOW - age, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        fresh = {"databaseId": 123456, "createdAt": iso(3600), "attempt": 1,
                 "event": "workflow_dispatch", "headBranch": "main", "headSha": SHA}
        freshness = [("fresh", {}, True), ("exact-36h", {"createdAt": iso(129600)}, True),
                     ("stale", {"createdAt": iso(129601)}, False),
                     ("future-300s", {"createdAt": iso(-300)}, True),
                     ("future-301s", {"createdAt": iso(-301)}, False),
                     ("schedule", {"event": "schedule"}, True),
                     ("blank-date", {"createdAt": ""}, False),
                     ("null-date", {"createdAt": None}, False),
                     ("relative-date", {"createdAt": "today"}, False),
                     ("invalid-date", {"createdAt": "2026-02-30T12:00:00Z"}, False),
                     ("zero-id", {"databaseId": 0}, False),
                     ("negative-id", {"databaseId": -1}, False),
                     ("fraction-id", {"databaseId": 1.2}, False),
                     ("string-id", {"databaseId": "123456"}, False),
                     ("zero-attempt", {"attempt": 0}, False),
                     ("wrong-branch", {"headBranch": "untrusted"}, False),
                     ("pull-request", {"event": "pull_request"}, False),
                     ("bad-sha", {"headSha": "x" * 40}, False)]
        for name, change, expected in freshness:
            fixture = base / "run.json"
            fixture.write_text(json.dumps({**fresh, **change}), encoding="utf-8")
            output = base / "gh-output"
            output.unlink(missing_ok=True)
            proc = run(step(DRILL, "Find latest successful main-branch backup"), {
                "PATH": str(tools) + ":" + clean_env["PATH"], "GH_FIXTURE": str(fixture),
                "GH_CALLS": str(base / "gh-calls"), "GITHUB_REPOSITORY": REPO,
                "GITHUB_OUTPUT": str(output)})
            record("freshness/" + name, proc, expected)
            if expected and proc.returncode == 0:
                assert output.read_text() == f"run_id=123456\nrun_attempt=1\nhead_sha={SHA}\n"
            if not expected and proc.returncode != 0:
                assert not output.exists(), "failed metadata must not emit trusted outputs"

        identity = base / "identity.txt"
        wrong = base / "wrong.txt"
        for target in (identity, wrong):
            subprocess.run(["age-keygen", "-o", str(target)], check=True, capture_output=True)
        recipient = subprocess.check_output(["age-keygen", "-y", str(identity)], text=True).strip()
        crypto_count = 0
        for profile_name in rc.PROFILE_NAMES:
            profile = rc.load_profile(profile_name)
            for workflow, step_name, root_var in (
                (BACKUP, "Verify authenticated decryptability and manifest", "READBACK_DIR"),
                (DRILL, "Authenticate, decrypt and validate bundle", "DRILL_ROOT")):
                for mutation in ("valid", "repository", "run_id", "run_attempt", "head_sha",
                                 "source-major", "cli", "profile", "profile-hash", "member-hash",
                                 "wrong-key", "tamper", "cipher-checksum", "traversal", "symlink",
                                 "duplicate", "missing"):
                    crypto_count += 1
                    case = base / f"crypto-{crypto_count}"
                    download = case / "download"
                    download.mkdir(parents=True)
                    payload = {name: b"-- synthetic only, not pg_dump\n" for name in FILES}
                    payload["data.sql"] = ("\n".join(f"COPY {name} (id) FROM stdin;\nsynthetic\n\\."
                                          for name in profile["relations"]) + "\n").encode()
                    payload["expected-counts.txt"] = rc.copy_counts(profile, payload["data.sql"].decode()).encode()
                    payload["expected-migrations.txt"] = rc.versions(profile).encode()
                    manifest = {"format": "ishonch-guard-supabase-logical-backup/v4",
                                "supabase_cli": "2.104.0", "source_postgres_major": "17",
                                "recovery_profile": profile_name, "recovery_profile_sha256": rc.fingerprint(profile),
                                "provenance": {"repository": REPO, "run_id": "123456", "run_attempt": "1", "head_sha": SHA},
                                "files": {n: hashlib.sha256(payload[n]).hexdigest() for n in FILES}}
                    if mutation in manifest["provenance"]:
                        manifest["provenance"][mutation] = "untrusted"
                    if mutation == "source-major": manifest["source_postgres_major"] = "18"
                    if mutation == "cli": manifest["supabase_cli"] = "0.0.0"
                    if mutation == "profile": manifest["recovery_profile"] = "candidate-38" if profile_name == "production-33" else "production-33"
                    if mutation == "profile-hash": manifest["recovery_profile_sha256"] = "0" * 64
                    if mutation == "member-hash": payload["roles.sql"] += b"-- changed\n"
                    payload["manifest.json"] = json.dumps(manifest).encode()
                    if mutation == "missing": del payload["roles.sql"]
                    if mutation == "traversal": payload["../outside.sql"] = b"blocked"
                    if mutation == "symlink": del payload["roles.sql"]
                    archive = case / "fixture.tar"
                    with tarfile.open(archive, "w") as target:
                        for name, content in payload.items():
                            member = tarfile.TarInfo(name)
                            member.size = len(content)
                            target.addfile(member, io.BytesIO(content))
                        if mutation in ("symlink", "duplicate"):
                            member = tarfile.TarInfo("roles.sql")
                            if mutation == "symlink":
                                member.type, member.linkname = tarfile.SYMTYPE, "../outside.sql"
                            target.addfile(member)
                    cipher = download / "supabase-backup.tar.age"
                    subprocess.run(["age", "-r", recipient, "-o", str(cipher), str(archive)], check=True, capture_output=True)
                    if mutation == "tamper":
                        content = bytearray(cipher.read_bytes())
                        content[-1] ^= 1
                        cipher.write_bytes(content)
                    checksum = hashlib.sha256(cipher.read_bytes()).hexdigest()
                    if mutation == "cipher-checksum": checksum = "0" * 64
                    (download / "supabase-backup.tar.age.sha256").write_text(checksum + "\n", encoding="ascii")
                    proc = run(step(workflow, step_name), {
                        root_var: str(case), "BACKUP_AGE_IDENTITY": (wrong if mutation == "wrong-key" else identity).read_text(),
                        "RECOVERY_PROFILE": profile_name, "SUPABASE_CLI_VERSION": "2.104.0",
                        "GITHUB_REPOSITORY": REPO, "GITHUB_RUN_ID": "123456", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": SHA,
                        "EXPECTED_RUN_ID": "123456", "EXPECTED_RUN_ATTEMPT": "1", "EXPECTED_HEAD_SHA": SHA,
                        "GITHUB_STEP_SUMMARY": str(case / "summary")})
                    record(f"{workflow}/{profile_name}/{mutation}", proc, mutation == "valid")
                    assert "AGE-SECRET-KEY-" not in proc.stdout + proc.stderr, "key leaked into process logs"
                    assert not (case / "outside.sql").exists(), "archive traversal"
                    if mutation != "cipher-checksum":
                        assert not (case / "identity.txt").exists(), "identity not cleaned on decrypt path"

        for name, variable in (("Cleanup transient plaintext and ciphertext", "BACKUP_DIR"),
                               ("Cleanup decrypted material", "READBACK_DIR")):
            for failure in (False, True):
                directory = base / "cleanup-owned"
                directory.mkdir()
                (directory / "synthetic-private").write_text("synthetic")
                env = {variable: str(directory)}
                if failure:
                    executable(tools / "rm", "#!/bin/bash\nexit 1\n")
                    env["PATH"] = str(tools) + ":" + clean_env["PATH"]
                proc = run(step(BACKUP, name), env)
                record(name + ("/injected-failure" if failure else "/success"), proc, not failure)
                assert directory.exists() == failure
                if failure: shutil.rmtree(directory)
        gh_calls = (base / "gh-calls").read_text().splitlines()
        assert len(gh_calls) == len(freshness)
    assert not base.exists(), "temporary synthetic keys/plaintext retained"
    summary = {"cases": len(results), "passed": sum(case["pass"] for case in results),
               "failed": [case["case"] for case in results if not case["pass"]],
               "realWorkflowBashJqAge": True, "githubMetadata": "local fixture only",
               "temporaryKeysAndPlaintextRemoved": True, "databaseRestore": "NOT RUN",
               "hostFirewall": "NOT RUN", "hostedActions": "NOT RUN", "productionTouched": False}
    print(json.dumps(summary, indent=2))
    return 0 if summary["passed"] == summary["cases"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
