"""Fail-closed source contracts for the separate production33 backup release."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ReleaseBoundaryTests(unittest.TestCase):
    def test_every_secret_job_requires_main_and_explicit_supported_profile(self):
        for name, expected in [("backup.yml", 2), ("backup-restore-drill.yml", 1)]:
            text = (ROOT / ".github/workflows" / name).read_text()
            self.assertEqual(len(re.findall(r"^    environment: backup-(?:export|decrypt)$", text, re.M)), expected)
            self.assertEqual(text.count("if: github.ref == 'refs/heads/main' && inputs.recovery_profile == 'production-33'"), expected)
            self.assertIn("default: production-33", text)
            self.assertNotIn("- candidate-38", text)
            self.assertNotRegex(text, r"(?m)^\s+schedule:")

    def test_all_backup_checkouts_drop_persisted_credentials(self):
        for name in ["backup.yml", "backup-restore-drill.yml", "backup-recovery-ci.yml"]:
            text = (ROOT / ".github/workflows" / name).read_text()
            checkouts = re.findall(r"uses: actions/checkout@[^\n]+\n\s+with:\n\s+persist-credentials: false", text)
            self.assertEqual(len(checkouts), text.count("uses: actions/checkout@"))
            self.assertGreater(len(checkouts), 0)

    def test_separate_ci_has_no_credential_environment_or_privileged_runner(self):
        text = (ROOT / ".github/workflows/backup-recovery-ci.yml").read_text()
        for forbidden in ["secrets.", "environment:", "pull_request_target:", "--privileged", "/var/run/docker.sock"]:
            self.assertNotIn(forbidden, text)
        self.assertIn("contents: read", text)
        self.assertIn("--network none --read-only --cap-drop ALL", text)
        self.assertIn("python3 -B -m unittest discover", text)
        for ref in re.findall(r"uses: [^@\s]+@([^\s#]+)", text):
            self.assertRegex(ref, r"^[a-f0-9]{40}$")


if __name__ == "__main__":
    unittest.main()
