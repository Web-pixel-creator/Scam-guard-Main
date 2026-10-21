"""Production33-only release regressions; no database, network or credentials.

Candidate38 stays in its original application candidate, not in migrations or
test fixtures of this package. Generic generator tests use invented in-memory
policy entries, never pretend those objects exist in production33.
"""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import recovery_contract as rc


class RecoveryContractTests(unittest.TestCase):
    def snapshot(self, profile):
        return "\n".join(
            f'COPY "{name.split(".")[0]}"."{name.split(".")[1]}" (id) FROM stdin;\nrow\n\\.'
            for name in profile["relations"]
        ) + "\n"

    def test_only_reviewed_33_profile_and_sources_are_present(self):
        self.assertEqual(rc.PROFILE_NAMES, ("production-33",))
        document = json.loads((rc.HERE / "baselines.json").read_text())
        self.assertEqual(list(document["profiles"]), ["production-33"])
        profile = rc.load_profile("production-33")
        self.assertEqual(len(profile["migrations"]), 33)
        self.assertEqual(len(profile["relations"]), 18)
        migrations = rc.HERE.parent / "migrations"
        self.assertEqual(sorted(p.name for p in migrations.glob("*.sql")),
                         [m["name"] for m in profile["migrations"]])
        rc.check_sources(profile, migrations)

    def test_unknown_and_deferred_profiles_rejected(self):
        for name in ("automatic-latest", "candidate-38", "", "production-34"):
            with self.subTest(profile=name), self.assertRaises(ValueError):
                rc.load_profile(name)

    def test_cli_rejects_deferred_profile_before_creating_files(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, "-B", str(rc.HERE / "recovery_contract.py"),
                                     "prepare", "--profile", "candidate-38", "--plain", directory],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_exact_history_not_count_or_head(self):
        profile = rc.load_profile("production-33")
        versions = rc.versions(profile)
        rc.check_history(profile, versions)
        for invalid in ["SET\n" + versions, versions + versions[-15:],
                        versions.replace("20260528182724", "20260528182723"),
                        "\n".join(reversed(versions.splitlines())) + "\n",
                        versions + "20990101000000\n"]:
            with self.subTest(history=invalid[:20]), self.assertRaises(ValueError):
                rc.check_history(profile, invalid)

    def test_missing_changed_migration_source_rejected(self):
        profile = rc.load_profile("production-33")
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                rc.check_sources(profile, Path(directory))
        changed = copy.deepcopy(profile)
        changed["migrations"][0]["sha256"] = "0" * 64
        with self.assertRaises(ValueError):
            rc.check_sources(changed, rc.HERE.parent / "migrations")

    def test_copy_counts_reviewed_state(self):
        profile = rc.load_profile("production-33")
        counts = rc.copy_counts(profile, self.snapshot(profile))
        self.assertEqual(counts, "".join(f"{table}\t1\n" for table in profile["relations"]))
        rc.check_counts(profile, counts)

    def test_missing_relation_rejected(self):
        profile = rc.load_profile("production-33")
        data = self.snapshot(profile).split("\\.\n", 1)[1]
        with self.assertRaises(ValueError):
            rc.copy_counts(profile, data)

    def test_duplicate_truncated_unknown_app_copy_rejected(self):
        profile = rc.load_profile("production-33")
        data = self.snapshot(profile)
        for invalid in [data + data, data[:-3], data + 'COPY public.future_table (id) FROM stdin;\n\\.\n']:
            with self.assertRaises(ValueError):
                rc.copy_counts(profile, invalid)

    def test_copy_payload_not_interpreted_as_sql(self):
        profile = rc.load_profile("production-33")
        data = self.snapshot(profile).replace("row", "COPY public.fake_table (id) FROM stdin;")
        self.assertEqual(rc.copy_counts(profile, data).count("\t1\n"), 18)

    def test_unicode_separators_are_payload_not_copy_records(self):
        profile = rc.load_profile("production-33")
        expected = "".join(f"{table}\t1\n" for table in profile["relations"])
        for separator in ("\u0085", "\u2028", "\u2029", "\x1c", "\x1d", "\x1e"):
            with self.subTest(codepoint=hex(ord(separator))):
                data = self.snapshot(profile).replace("row", "first" + separator + "second")
                self.assertEqual(rc.copy_counts(profile, data), expected)

    def test_escaped_and_terminator_like_payload_stays_one_record(self):
        profile = rc.load_profile("production-33")
        expected = "".join(f"{table}\t1\n" for table in profile["relations"])
        for payload in (r"\\.", r"before\t\nafter", "", r"\N",
                        "before\u2028\\.\u2029after",
                        "before\u0085COPY public.future_table (id) FROM stdin;"):
            with self.subTest(payload=repr(payload)):
                self.assertEqual(rc.copy_counts(profile, self.snapshot(profile).replace("row", payload)),
                                 expected)

    def test_only_physical_lf_starts_another_copy_record(self):
        profile = rc.load_profile("production-33")
        data = self.snapshot(profile).replace("row", "first\u2028second\nthird")
        self.assertEqual(rc.copy_counts(profile, data),
                         "".join(f"{table}\t2\n" for table in profile["relations"]))

    def test_count_inventory_is_exact_sorted_nonnegative(self):
        profile = rc.load_profile("production-33")
        counts = rc.copy_counts(profile, self.snapshot(profile))
        for invalid in [counts.replace("\t1", "\t-1", 1), counts.replace("\t1", "\t01", 1),
                        counts + counts, "\n".join(reversed(counts.splitlines())),
                        counts.replace("auth.users\t1\n", "")]:
            with self.assertRaises(ValueError):
                rc.check_counts(profile, invalid)

    def test_profile_fingerprint_is_stable_and_content_bound(self):
        profile = rc.load_profile("production-33")
        self.assertEqual(rc.fingerprint(profile),
                         "4f889170aeede11588a0cc22d4109afe64d2010ef286c33cbc7f1a0d6b01182a")
        self.assertEqual(rc.fingerprint(profile), rc.fingerprint(json.loads(json.dumps(profile))))
        changed = copy.deepcopy(profile)
        changed["schedules"][0]["schedule"] = "0 0 * * *"
        self.assertNotEqual(rc.fingerprint(profile), rc.fingerprint(changed))

    def test_production_security_sql_has_rls_but_no_future_schema(self):
        sql = rc.security_sql(rc.load_profile("production-33"))
        self.assertIn("relrowsecurity", sql)
        self.assertIn("public.reputation_appeals", sql)
        self.assertNotIn("web_ocr_ticket_claims", sql)
        self.assertNotIn("telegram_media_provider_consents", sql)

    def test_generic_security_generator_preserves_acl_and_function_checks(self):
        policy = copy.deepcopy(rc.load_profile("production-33"))
        policy["restricted_tables"] = {"private.synthetic_guard": ["SELECT"]}
        policy["rpc"] = [{"signature": "private.synthetic_guard()", "security_definer": True,
                          "search_path": "pg_catalog, public", "service_execute": True}]
        sql = rc.security_sql(policy)
        for text in ["has_table_privilege", "has_function_privilege", "prosecdef = true",
                     "ARRAY['search_path=pg_catalog, public']", "aclexplode",
                     "profile PUBLIC RPC privilege", "profile PUBLIC table privilege"]:
            self.assertIn(text, sql)

    def test_schedules_match_reviewed_migration(self):
        profile = rc.load_profile("production-33")
        self.assertEqual(len(profile["schedules"]), 1)
        for job in profile["schedules"]:
            migration = (rc.HERE.parent / "migrations" / job["migration"]).read_text(encoding="utf-8")
            for field in ["name", "schedule", "command"]:
                self.assertIn("'" + job[field] + "'", migration)
        self.assertIn("profile scheduled job mismatch", rc.schedule_sql(profile))
        self.assertNotIn("cron.schedule(", rc.schedule_sql(profile))

    def test_schedule_restore_is_guarded_and_does_not_run_retention(self):
        sql = rc.schedule_sql(rc.load_profile("production-33"), restore=True)
        for text in ["cron.launch_active_jobs", "IS DISTINCT FROM 'off'", "current_user <> 'postgres'",
                     "profile unexpected or changed scheduled job", "PERFORM cron.schedule("]:
            self.assertIn(text, sql)
        self.assertNotIn("PERFORM private.prune_", sql)
        self.assertNotIn("DELETE FROM cron", sql)


if __name__ == "__main__":
    unittest.main()
