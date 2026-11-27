"""Offline contract tests for the reproducible encrypted restore rehearsal."""
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import rehearse_encrypted_restore as rehearsal


def _ok(stdout=""):
    return subprocess.CompletedProcess(args=["mock"], returncode=0, stdout=stdout, stderr="")


def _fail(returncode=1, stderr="err"):
    return subprocess.CompletedProcess(args=["mock"], returncode=returncode, stdout="", stderr=stderr)


class RehearseEncryptedRestoreTests(unittest.TestCase):
    def test_parse_workflow_pins_reads_exact_four_pinned_images(self):
        pins = rehearsal.parse_workflow_pins()
        self.assertEqual(pins["SUPABASE_CLI_VERSION"], "2.104.0")
        self.assertEqual(pins["AGE_VERSION"], "1.3.1")
        self.assertEqual(pins["TARGET_POSTGRES_MAJOR"], "17")
        for svc in rehearsal.PINNED_SERVICES:
            self.assertRegex(pins[f"SUPABASE_{svc}_INDEX_DIGEST"], r"^sha256:[0-9a-f]{64}$")
            self.assertRegex(pins[f"SUPABASE_{svc}_AMD64_IMAGE_ID"], r"^sha256:[0-9a-f]{64}$")

    def test_resolve_git_head_sha_returns_exact_40_hex_sha_for_checkout(self):
        sha = rehearsal.resolve_git_head_sha(rehearsal.ROOT)
        self.assertIsNotNone(sha)
        self.assertRegex(sha, r"^[0-9a-f]{40}$")

    def test_extract_drill_catalog_sql_handles_lf_and_crlf(self):
        raw = rehearsal.DRILL_WORKFLOW.read_text(encoding="utf-8")
        sql_lf = rehearsal.extract_drill_catalog_sql(raw.replace("\r\n", "\n"))
        sql_crlf = rehearsal.extract_drill_catalog_sql(raw.replace("\r\n", "\n").replace("\n", "\r\n"))
        self.assertEqual(sql_lf, sql_crlf)
        self.assertTrue(sql_lf.startswith("DO $$"))
        self.assertIn("private.web_ocr_ticket_claims", sql_lf)
        self.assertIn("private.telegram_media_provider_consents", sql_lf)

    def test_bidirectional_inventory_diff_detects_added_and_removed_resources(self):
        base = {
            "containers": ["existing-db"],
            "volumes": ["existing-vol"],
            "networks": ["bridge", "existing-net"],
        }
        same = rehearsal.diff_inventory(base, {k: list(v) for k, v in base.items()})
        self.assertTrue(same["exactMatch"])

        added = rehearsal.diff_inventory(
            base,
            {**base, "networks": [*base["networks"], "ishonch-full-internal-1"]},
        )
        self.assertFalse(added["exactMatch"])
        self.assertEqual(added["added"]["networks"], ["ishonch-full-internal-1"])
        self.assertEqual(added["removed"]["networks"], [])

        removed = rehearsal.diff_inventory(
            base,
            {**base, "containers": []},
        )
        self.assertFalse(removed["exactMatch"])
        self.assertEqual(removed["removed"]["containers"], ["existing-db"])
        self.assertEqual(removed["added"]["containers"], [])

    def test_dedicated_engine_guard_rejects_remote_desktop_and_nonempty_engines(self):
        clean_before = {"containers": [], "volumes": [], "networks": ["bridge", "host", "none"]}
        native_linux = {"OSType": "linux", "OperatingSystem": "Debian GNU/Linux 13 (trixie)"}
        local_sock = "unix:///var/run/docker.sock"
        rehearsal.verify_dedicated_docker_engine(local_sock, native_linux, clean_before)

        for remote in (
            "",
            "tcp://10.0.0.5:2376",
            "ssh://ops@prod.example",
            "https://docker.example",
            "npipe:////./pipe/docker_engine",
        ):
            with self.subTest(endpoint=remote), self.assertRaisesRegex(RuntimeError, "local Unix-socket"):
                rehearsal.verify_dedicated_docker_engine(remote, native_linux, clean_before)

        with self.assertRaisesRegex(RuntimeError, "Docker Desktop"):
            rehearsal.verify_dedicated_docker_engine(
                local_sock,
                {"OSType": "linux", "OperatingSystem": "Docker Desktop"},
                clean_before,
            )
        with self.assertRaisesRegex(RuntimeError, "dedicated Linux Docker engine"):
            rehearsal.verify_dedicated_docker_engine(
                local_sock,
                {"OSType": "windows", "OperatingSystem": "Windows"},
                clean_before,
            )
        for non_empty in (
            {"containers": ["unrelated-app"], "volumes": [], "networks": ["bridge"]},
            {"containers": [], "volumes": ["unrelated-vol"], "networks": ["bridge"]},
            {"containers": [], "volumes": [], "networks": ["bridge", "custom-net"]},
        ):
            with self.subTest(before=non_empty), self.assertRaisesRegex(RuntimeError, "not empty"):
                rehearsal.verify_dedicated_docker_engine(local_sock, native_linux, non_empty)

    def test_preflight_conflict_rejects_similar_or_exact_preexisting_resources(self):
        before = {
            "containers": ["keep-ishonch-full-drill-12345-prod"],
            "volumes": ["unrelated-vol"],
            "networks": ["bridge", "host", "none"],
        }
        with self.assertRaisesRegex(RuntimeError, "conflicts with rehearsal identifiers"):
            rehearsal.check_no_resource_conflicts(
                before,
                ("ishonch-src-drill-12345", "ishonch-full-drill-12345"),
                ("ishonch-full-internal-12345", "supabase_network_ishonch-full-drill-12345"),
            )

    def test_aborted_run_preserves_preexisting_similar_resources(self):
        before = {
            "containers": ["keep-ishonch-full-drill-12345", "supabase_db_ishonch-full-drill-12345"],
            "volumes": ["keep-ishonch-full-drill-12345", "supabase_db_ishonch-full-drill-12345"],
            "networks": ["bridge", "ishonch-full-internal-12345", "keep-ishonch-full-internal-12345"],
        }
        calls = []
        removed_containers = set()
        removed_volumes = set()
        removed_networks = set()

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["docker", "ps", "-a"]:
                if "--format" in args and "{{.Names}}" in args:
                    names = ["supabase_db_ishonch-full-drill-12345", "keep-ishonch-full-drill-12345"]
                    if "cid-new" not in removed_containers:
                        names.append("supabase_db_ishonch-full-drill-12345-new")
                    return _ok("\n".join(names) + "\n")
                return _ok(
                    "cid-old\tsupabase_db_ishonch-full-drill-12345\n"
                    "cid-similar\tkeep-ishonch-full-drill-12345\n"
                    "cid-new\tsupabase_db_ishonch-full-drill-12345-new\n"
                )
            if args[:2] == ["docker", "rm"]:
                removed_containers.update(args[3:])
                return _ok("")
            if args[:3] == ["docker", "volume", "ls"]:
                vols = ["supabase_db_ishonch-full-drill-12345"]
                if "new-vol" not in removed_volumes:
                    vols.append("new-vol")
                return _ok("\n".join(vols) + "\n")
            if args[:3] == ["docker", "volume", "rm"]:
                removed_volumes.update(args[3:])
                return _ok("")
            if args[:3] == ["docker", "network", "ls"]:
                return _ok("ishonch-full-internal-12345\nnew-net\n")
            if args[:3] == ["docker", "network", "inspect"]:
                return _fail(1) if args[3] in removed_networks else _ok("{}")
            if args[:3] == ["docker", "network", "rm"]:
                removed_networks.add(args[3])
                return _ok("")
            return _ok("")

        with patch.object(rehearsal, "run_cmd", side_effect=fake_run):
            ok_unstarted, errs_unstarted = rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-full-drill-12345",
                before_docker=before,
                started_projects=set(),
                created_networks=set(),
            )
            self.assertTrue(ok_unstarted)
            self.assertEqual(errs_unstarted, [])
            self.assertEqual(calls, [])

            ok_partial, errs_partial = rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-full-drill-12345",
                before_docker=before,
                started_projects={"ishonch-full-drill-12345"},
                created_networks={"ishonch-full-internal-12345", "fresh-internal-net"},
            )
            self.assertTrue(ok_partial, errs_partial)

        for cmd in calls:
            self.assertFalse(any(arg.startswith("name=") for arg in cmd), f"substring name filter forbidden: {cmd}")
            if cmd[:2] == ["docker", "rm"]:
                self.assertEqual(cmd, ["docker", "rm", "-f", "cid-new"])
            if cmd[:3] == ["docker", "volume", "rm"]:
                self.assertEqual(cmd, ["docker", "volume", "rm", "new-vol"])
            if cmd[:3] == ["docker", "network", "rm"]:
                self.assertIn(cmd[3], ("new-net", "fresh-internal-net"))
                self.assertNotIn(cmd[3], before["networks"])

    def test_timeout_in_first_cleanup_still_cleans_second_stack_and_temp_dir_and_fails(self):
        before = {"containers": [], "volumes": [], "networks": ["bridge", "host", "none"]}
        with tempfile.TemporaryDirectory() as parent:
            temp_root = Path(parent) / "run-temp"
            src_dir = temp_root / "src"
            tgt_dir = temp_root / "tgt"
            src_dir.mkdir(parents=True)
            tgt_dir.mkdir(parents=True)
            (temp_root / "identity.txt").write_text("AGE-SECRET-KEY-SYNTHETIC", encoding="utf-8")

            seen = []

            def fake_run(args, **kwargs):
                seen.append(args)
                # Inject a timeout on the very first source stack cleanup command.
                if args[:2] == ["supabase", "stop"] and str(src_dir) in args:
                    raise subprocess.TimeoutExpired(cmd=args, timeout=90)
                if args[:3] == ["docker", "network", "inspect"]:
                    return _fail(1)
                if args[:3] == ["docker", "volume", "inspect"]:
                    return _fail(1)
                return _ok("")

            with patch.object(rehearsal, "run_cmd", side_effect=fake_run), patch.object(
                rehearsal, "docker_snapshot", return_value=before
            ):
                result = rehearsal.finalize_cleanup(
                    src_dir=src_dir,
                    src_project="ishonch-src-drill-99",
                    tgt_dir=tgt_dir,
                    tgt_project="ishonch-full-drill-99",
                    temp_root=temp_root,
                    before_docker=before,
                    started_projects={"ishonch-src-drill-99", "ishonch-full-drill-99"},
                    created_src_networks={"supabase_network_ishonch-src-drill-99"},
                    created_tgt_networks={"ishonch-full-internal-99"},
                )

            # Target stack cleanup was still attempted AND temp_root (keys/plaintext) was deleted.
            self.assertTrue(any(cmd[:2] == ["supabase", "stop"] and str(tgt_dir) in cmd for cmd in seen))
            self.assertTrue(any("ishonch-full-internal-99" in cmd for cmd in seen))
            self.assertTrue(result["tempDirDeleted"])
            self.assertFalse(temp_root.exists())
            # Cleanup failure MUST remain fatal (exactBeforeAfterMatch == False -> non-zero exit).
            self.assertFalse(result["exactBeforeAfterMatch"])
            self.assertTrue(any("TimeoutExpired" in err for err in result["cleanupErrors"]))

    def test_rewrite_roles_idempotent_guards_only_create_role(self):
        sample = 'CREATE ROLE "custom_role" WITH LOGIN;\nALTER ROLE postgres SET search_path = public;\n'
        rewritten = rehearsal.rewrite_roles_idempotent(sample)
        self.assertIn("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'custom_role')", rewritten)
        self.assertIn("ALTER ROLE postgres SET search_path = public;", rewritten)

    def test_cli_accepts_only_reviewed_profile_and_rejects_shared_docker_and_db_url(self):
        args = rehearsal.parse_args(["--profile", "production-38", "--run-id", "123456"])
        self.assertEqual(args.profile, "production-38")
        self.assertEqual(args.run_id, "123456")
        for bad_argv in (
            ["--profile", "production-33"],
            ["--profile", "production-38", "--db-url", "postgresql://bad"],
            ["--profile", "production-38", "--allow-shared-docker"],
        ):
            with self.subTest(argv=bad_argv), self.assertRaises(SystemExit):
                rehearsal.parse_args(bad_argv)
        with self.assertRaises(ValueError):
            rehearsal.parse_args(["--profile", "production-38", "--run-id", "bad-id"])


if __name__ == "__main__":
    unittest.main()
