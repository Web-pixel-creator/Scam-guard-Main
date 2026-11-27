"""Offline contract tests for the reproducible encrypted restore rehearsal."""
import unittest

import rehearse_encrypted_restore as rehearsal


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

    def test_rewrite_roles_idempotent_guards_only_create_role(self):
        sample = 'CREATE ROLE "custom_role" WITH LOGIN;\nALTER ROLE postgres SET search_path = public;\n'
        rewritten = rehearsal.rewrite_roles_idempotent(sample)
        self.assertIn("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'custom_role')", rewritten)
        self.assertIn("ALTER ROLE postgres SET search_path = public;", rewritten)

    def test_cli_accepts_only_reviewed_profile_and_no_db_url(self):
        args = rehearsal.parse_args(["--profile", "production-38", "--run-id", "123456"])
        self.assertEqual(args.profile, "production-38")
        self.assertEqual(args.run_id, "123456")
        with self.assertRaises(SystemExit):
            rehearsal.parse_args(["--profile", "production-33"])
        with self.assertRaises(SystemExit):
            rehearsal.parse_args(["--profile", "production-38", "--db-url", "postgresql://bad"])
        with self.assertRaises(ValueError):
            rehearsal.parse_args(["--profile", "production-38", "--run-id", "bad-id"])


if __name__ == "__main__":
    unittest.main()
