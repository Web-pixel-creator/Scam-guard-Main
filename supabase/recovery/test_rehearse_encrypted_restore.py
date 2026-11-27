"""Offline contract tests for the reproducible encrypted restore rehearsal."""
import subprocess
import unittest
from unittest.mock import patch

import rehearse_encrypted_restore as rehearsal


def _ok(stdout=""):
    return subprocess.CompletedProcess(args=["mock"], returncode=0, stdout=stdout, stderr="")


class RehearseEncryptedRestoreTests(unittest.TestCase):
    def test_parse_workflow_pins_reads_exact_four_pinned_images(self):
        pins = rehearsal.parse_workflow_pins()
        self.assertEqual(pins["SUPABASE_CLI_VERSION"], "2.104.0")
        self.assertEqual(pins["AGE_VERSION"], "1.3.1")
        self.assertEqual(pins["TARGET_POSTGRES_MAJOR"], "17")
        for svc in rehearsal.PINNED_SERVICES:
            self.assertRegex(pins[f"SUPABASE_{svc}_INDEX_DIGEST"], r"^sha256:[0-9a-f]{64}$")
            self.assertRegex(pins[f"SUPABASE_{svc}_AMD64_IMAGE_ID"], r"^sha256:[0-9a-f]{64}$")

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

    def test_dedicated_engine_guard_rejects_docker_desktop_and_shared_engines(self):
        clean_before = {"containers": [], "volumes": [], "networks": ["bridge", "host", "none"]}
        native_linux = {"OSType": "linux", "OperatingSystem": "Debian GNU/Linux 13 (trixie)"}
        rehearsal.verify_dedicated_docker_engine(native_linux, clean_before)

        with self.assertRaisesRegex(RuntimeError, "Docker Desktop"):
            rehearsal.verify_dedicated_docker_engine(
                {"OSType": "linux", "OperatingSystem": "Docker Desktop"},
                clean_before,
                allow_shared_docker=True,
            )
        with self.assertRaisesRegex(RuntimeError, "dedicated Linux Docker engine"):
            rehearsal.verify_dedicated_docker_engine(
                {"OSType": "windows", "OperatingSystem": "Windows"},
                clean_before,
            )
        shared_before = {"containers": ["unrelated-app"], "volumes": [], "networks": ["bridge"]}
        with self.assertRaisesRegex(RuntimeError, "not empty"):
            rehearsal.verify_dedicated_docker_engine(native_linux, shared_before)
        rehearsal.verify_dedicated_docker_engine(native_linux, shared_before, allow_shared_docker=True)

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

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["docker", "ps", "-a"]:
                return _ok(
                    "cid-old\tsupabase_db_ishonch-full-drill-12345\n"
                    "cid-similar\tkeep-ishonch-full-drill-12345\n"
                    "cid-new\tsupabase_db_ishonch-full-drill-12345-new\n"
                )
            if args[:3] == ["docker", "volume", "ls"]:
                return _ok("supabase_db_ishonch-full-drill-12345\nnew-vol\n")
            if args[:3] == ["docker", "network", "ls"]:
                return _ok("ishonch-full-internal-12345\nnew-net\n")
            return _ok("")

        with patch.object(rehearsal, "run_cmd", side_effect=fake_run):
            # Case A: run aborted BEFORE starting project or creating any network -> zero removals.
            rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-full-drill-12345",
                before_docker=before,
                started_projects=set(),
                created_networks=set(),
            )
            self.assertEqual(calls, [])

            # Case B: even when cleanup runs after partial start, pre-existing resources are NEVER removed
            # and substring `--filter name=` is NEVER used.
            rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-full-drill-12345",
                before_docker=before,
                started_projects={"ishonch-full-drill-12345"},
                created_networks={"ishonch-full-internal-12345", "fresh-internal-net"},
            )

        for cmd in calls:
            self.assertFalse(any(arg.startswith("name=") for arg in cmd), f"substring name filter forbidden: {cmd}")
            if cmd[:2] == ["docker", "rm"]:
                self.assertEqual(cmd, ["docker", "rm", "-f", "cid-new"])
            if cmd[:3] == ["docker", "volume", "rm"]:
                self.assertEqual(cmd, ["docker", "volume", "rm", "new-vol"])
            if cmd[:3] == ["docker", "network", "rm"]:
                self.assertIn(cmd[3], ("new-net", "fresh-internal-net"))
                self.assertNotIn(cmd[3], before["networks"])

    def test_rewrite_roles_idempotent_guards_only_create_role(self):
        sample = 'CREATE ROLE "custom_role" WITH LOGIN;\nALTER ROLE postgres SET search_path = public;\n'
        rewritten = rehearsal.rewrite_roles_idempotent(sample)
        self.assertIn("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'custom_role')", rewritten)
        self.assertIn("ALTER ROLE postgres SET search_path = public;", rewritten)

    def test_cli_accepts_only_reviewed_profile_and_no_db_url(self):
        args = rehearsal.parse_args(["--profile", "production-38", "--run-id", "123456"])
        self.assertEqual(args.profile, "production-38")
        self.assertEqual(args.run_id, "123456")
        self.assertFalse(args.allow_shared_docker)
        with self.assertRaises(SystemExit):
            rehearsal.parse_args(["--profile", "production-33"])
        with self.assertRaises(SystemExit):
            rehearsal.parse_args(["--profile", "production-38", "--db-url", "postgresql://bad"])
        with self.assertRaises(ValueError):
            rehearsal.parse_args(["--profile", "production-38", "--run-id", "bad-id"])


if __name__ == "__main__":
    unittest.main()
