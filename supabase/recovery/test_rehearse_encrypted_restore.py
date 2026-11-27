"""Offline contract tests for the reproducible encrypted restore rehearsal."""
import os
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


def _docker_subargs(args):
    """Strip optional `--host <endpoint>` prefix for test matching."""
    if len(args) >= 3 and args[0] == "docker" and args[1] == "--host":
        return ["docker", *args[3:]]
    return list(args)


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
            norm = _docker_subargs(args)
            if norm[:3] == ["docker", "ps", "-a"]:
                if "--format" in norm and "{{.Names}}" in norm:
                    names = ["supabase_db_ishonch-full-drill-12345", "keep-ishonch-full-drill-12345"]
                    if "cid-new" not in removed_containers:
                        names.append("supabase_db_ishonch-full-drill-12345-new")
                    return _ok("\n".join(names) + "\n")
                return _ok(
                    "cid-old\tsupabase_db_ishonch-full-drill-12345\n"
                    "cid-similar\tkeep-ishonch-full-drill-12345\n"
                    "cid-new\tsupabase_db_ishonch-full-drill-12345-new\n"
                )
            if norm[:2] == ["docker", "rm"]:
                removed_containers.update(norm[3:])
                return _ok("")
            if norm[:3] == ["docker", "volume", "ls"]:
                vols = ["supabase_db_ishonch-full-drill-12345"]
                if "new-vol" not in removed_volumes:
                    vols.append("new-vol")
                return _ok("\n".join(vols) + "\n")
            if norm[:3] == ["docker", "volume", "rm"]:
                removed_volumes.update(norm[3:])
                return _ok("")
            if norm[:3] == ["docker", "network", "ls"]:
                if "--filter" in norm:
                    nets = ["ishonch-full-internal-12345"]
                    if "new-net" not in removed_networks:
                        nets.append("new-net")
                    return _ok("\n".join(nets) + "\n")
                nets = ["bridge", "ishonch-full-internal-12345"]
                for candidate in ("new-net", "fresh-internal-net"):
                    if candidate not in removed_networks:
                        nets.append(candidate)
                return _ok("\n".join(nets) + "\n")
            if norm[:3] == ["docker", "network", "rm"]:
                removed_networks.add(norm[3])
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
            norm = _docker_subargs(cmd)
            self.assertFalse(any(arg.startswith("name=") for arg in norm), f"substring name filter forbidden: {cmd}")
            if norm[:2] == ["docker", "rm"]:
                self.assertEqual(norm, ["docker", "rm", "-f", "cid-new"])
            if norm[:3] == ["docker", "volume", "rm"]:
                self.assertEqual(norm, ["docker", "volume", "rm", "new-vol"])
            if norm[:3] == ["docker", "network", "rm"]:
                self.assertIn(norm[3], ("new-net", "fresh-internal-net"))
                self.assertNotIn(norm[3], before["networks"])

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
            self.assertTrue(any(_docker_subargs(cmd)[:3] == ["docker", "network", "ls"] for cmd in seen))
            self.assertTrue(result["tempDirDeleted"])
            self.assertFalse(temp_root.exists())
            # Cleanup failure MUST remain fatal (exactBeforeAfterMatch == False -> non-zero exit).
            self.assertFalse(result["exactBeforeAfterMatch"])
            self.assertTrue(any("TimeoutExpired" in err for err in result["cleanupErrors"]))

    def test_nonzero_docker_error_in_cleanup_is_never_treated_as_empty_success(self):
        before = {"containers": [], "volumes": [], "networks": ["bridge", "host", "none"]}
        daemon_down = _fail(1, "Cannot connect to the Docker daemon at unix:///var/run/docker.sock")

        # Case 1: Every docker command returns exit=1 ("daemon unavailable").
        with patch.object(rehearsal, "run_cmd", return_value=daemon_down):
            ok, errs = rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-src-drill-55",
                before_docker=before,
                started_projects={"ishonch-src-drill-55"},
                created_networks={"supabase_network_ishonch-src-drill-55"},
            )
        self.assertFalse(ok)
        self.assertTrue(errs)
        self.assertTrue(any("verify-containers-gone: exit=1" in e for e in errs), errs)
        self.assertTrue(any("verify-volumes-gone: exit=1" in e for e in errs), errs)
        self.assertTrue(any("verify-exact-volume-gone: exit=1" in e for e in errs), errs)
        self.assertTrue(any("verify-created-networks-gone: exit=1" in e for e in errs), errs)

        # Case 2: Removal passes, but ONLY verification queries fail with exit=1.
        call_counts = {"ps": 0, "vol": 0, "net": 0}

        def fail_only_on_verify(args, **kwargs):
            norm = _docker_subargs(args)
            if norm[:3] == ["docker", "ps", "-a"]:
                call_counts["ps"] += 1
                return _ok("") if call_counts["ps"] == 1 else daemon_down
            if norm[:3] == ["docker", "volume", "ls"]:
                call_counts["vol"] += 1
                return _ok("") if call_counts["vol"] <= 2 else daemon_down
            if norm[:3] == ["docker", "network", "ls"]:
                call_counts["net"] += 1
                return _ok("") if call_counts["net"] <= 2 else daemon_down
            return _ok("")

        with patch.object(rehearsal, "run_cmd", side_effect=fail_only_on_verify):
            ok_v, errs_v = rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-src-drill-55",
                before_docker=before,
                started_projects={"ishonch-src-drill-55"},
                created_networks={"supabase_network_ishonch-src-drill-55"},
            )
        self.assertFalse(ok_v)
        self.assertTrue(any("verify-containers-gone: exit=1" in e for e in errs_v), errs_v)
        self.assertTrue(any("verify-created-networks-gone: exit=1" in e for e in errs_v), errs_v)

        # Case 3: finalize_cleanup still deletes temp_root and reports exactBeforeAfterMatch=False.
        with tempfile.TemporaryDirectory() as parent:
            temp_root = Path(parent) / "run-temp"
            temp_root.mkdir(parents=True)
            (temp_root / "identity.txt").write_text("AGE-SECRET-KEY-SYNTHETIC", encoding="utf-8")
            with patch.object(rehearsal, "run_cmd", return_value=daemon_down):
                fin = rehearsal.finalize_cleanup(
                    src_dir=None,
                    src_project="ishonch-src-drill-55",
                    tgt_dir=None,
                    tgt_project="ishonch-full-drill-55",
                    temp_root=temp_root,
                    before_docker=before,
                    started_projects={"ishonch-src-drill-55"},
                    created_src_networks={"supabase_network_ishonch-src-drill-55"},
                    created_tgt_networks=set(),
                )
            self.assertTrue(fin["tempDirDeleted"])
            self.assertFalse(temp_root.exists())
            self.assertFalse(fin["exactBeforeAfterMatch"])
            self.assertTrue(any("source/verify-containers-gone: exit=1" in e for e in fin["cleanupErrors"]))

    def test_rehearse_rejects_remote_endpoint_before_first_docker_daemon_call(self):
        pins = rehearsal.parse_workflow_pins()
        for remote in ("tcp://10.0.0.5:2376", "ssh://ops@prod.example", "npipe:////./pipe/docker_engine", ""):
            with self.subTest(endpoint=remote):
                with patch.object(rehearsal, "run_cmd", return_value=_ok(pins["SUPABASE_CLI_VERSION"] + "\n")), patch.object(
                    rehearsal, "docker_endpoint_host", return_value=remote
                ), patch.object(
                    rehearsal, "docker_engine_info", side_effect=AssertionError("docker info must not be called")
                ), patch.object(
                    rehearsal, "docker_snapshot", side_effect=AssertionError("docker snapshot must not be called")
                ):
                    with self.assertRaisesRegex(RuntimeError, "local Unix-socket"):
                        rehearsal.rehearse("production-38", "12345", 58422, 59422)

    def test_pinned_docker_env_and_commands_override_context_and_restore_os_environ(self):
        endpoint = "unix:///run/disposable-docker.sock"
        pinned_env = rehearsal.build_pinned_docker_env(endpoint)
        self.assertEqual(pinned_env["DOCKER_HOST"], endpoint)
        self.assertIsNone(pinned_env["DOCKER_CONTEXT"])
        self.assertIsNone(pinned_env["DOCKER_TLS_VERIFY"])
        self.assertIsNone(pinned_env["DOCKER_CERT_PATH"])
        self.assertEqual(pinned_env["BUILDX_BUILDER"], "default")

        # Verify process env pinning overrides DOCKER_CONTEXT and restores prior values on error.
        with patch.dict(
            os.environ,
            {
                "DOCKER_HOST": "tcp://old-host:2376",
                "DOCKER_CONTEXT": "remote-prod",
                "DOCKER_TLS_VERIFY": "1",
                "BUILDX_BUILDER": "external-cloud",
            },
            clear=False,
        ):
            try:
                with rehearsal.pinned_process_docker_env(pinned_env):
                    self.assertEqual(os.environ.get("DOCKER_HOST"), endpoint)
                    self.assertNotIn("DOCKER_CONTEXT", os.environ)
                    self.assertNotIn("DOCKER_TLS_VERIFY", os.environ)
                    self.assertEqual(os.environ.get("BUILDX_BUILDER"), "default")
                    raise ValueError("boom")
            except ValueError:
                pass
            self.assertEqual(os.environ.get("DOCKER_HOST"), "tcp://old-host:2376")
            self.assertEqual(os.environ.get("DOCKER_CONTEXT"), "remote-prod")
            self.assertEqual(os.environ.get("DOCKER_TLS_VERIFY"), "1")
            self.assertEqual(os.environ.get("BUILDX_BUILDER"), "external-cloud")

        # Verify docker_engine_info, docker_snapshot, and cleanup pin both --host and env.
        recorded = []

        def capture_run(args, **kwargs):
            recorded.append((args, kwargs.get("env")))
            norm = _docker_subargs(args)
            if norm[:2] == ["docker", "info"]:
                return _ok('{"OSType":"linux","OperatingSystem":"Debian"}')
            return _ok("")

        before = {"containers": [], "volumes": [], "networks": ["bridge", "host", "none"]}
        with patch.object(rehearsal, "run_cmd", side_effect=capture_run):
            rehearsal.docker_engine_info(endpoint, docker_env=pinned_env)
            rehearsal.docker_snapshot(endpoint, docker_env=pinned_env)
            ok, errs = rehearsal.stop_and_remove_owned_project(
                None,
                "ishonch-src-drill-77",
                before_docker=before,
                started_projects={"ishonch-src-drill-77"},
                created_networks={"supabase_network_ishonch-src-drill-77"},
                docker_endpoint=endpoint,
                docker_env=pinned_env,
            )
        self.assertTrue(ok, errs)
        self.assertTrue(recorded)
        for args, env in recorded:
            if args[0] == "docker":
                self.assertEqual(args[:3], ["docker", "--host", endpoint])
            self.assertEqual(env["DOCKER_HOST"], endpoint)
            self.assertIsNone(env["DOCKER_CONTEXT"])

    def test_ensure_offline_gates_image_excludes_external_buildx_builder(self):
        endpoint = "unix:///run/disposable-docker.sock"

        # Case A: buildx present with local docker driver -> uses --builder default --load.
        calls_a = []

        def fake_buildx_local(args, **kwargs):
            calls_a.append((args, kwargs.get("env")))
            norm = _docker_subargs(args)
            if norm[:3] == ["docker", "image", "inspect"]:
                return _fail(1)
            if norm[:3] == ["docker", "buildx", "version"]:
                return _ok("github.com/docker/buildx v0.30.1\n")
            if norm[:4] == ["docker", "buildx", "inspect", "default"]:
                return _ok("Name: default\nDriver: docker\n")
            return _ok("")

        with patch.object(rehearsal, "run_cmd", side_effect=fake_buildx_local):
            mode = rehearsal.ensure_offline_gates_image(endpoint)
        self.assertEqual(mode, "buildx-default-docker")
        build_cmds = [(a, e) for a, e in calls_a if _docker_subargs(a)[:3] == ["docker", "buildx", "build"]]
        self.assertEqual(len(build_cmds), 1)
        build_args, build_env = build_cmds[0]
        self.assertEqual(build_args[:3], ["docker", "--host", endpoint])
        self.assertIn("--builder", build_args)
        self.assertEqual(build_args[build_args.index("--builder") + 1], "default")
        self.assertIn("--load", build_args)
        self.assertEqual(build_env["DOCKER_HOST"], endpoint)
        self.assertIsNone(build_env["DOCKER_CONTEXT"])
        self.assertEqual(build_env["BUILDX_BUILDER"], "default")

        # Case B: buildx default reports non-docker driver (or error) -> fails closed without building.
        for bad_inspect in ("Name: default\nDriver: remote\n", "Name: default\nDriver: docker-container\n", "Name: default\nDriver:\nError: unreachable\n"):
            with self.subTest(inspect=bad_inspect):
                calls_b = []

                def fake_buildx_external(args, **kwargs):
                    calls_b.append(args)
                    norm = _docker_subargs(args)
                    if norm[:3] == ["docker", "image", "inspect"]:
                        return _fail(1)
                    if norm[:3] == ["docker", "buildx", "version"]:
                        return _ok("github.com/docker/buildx v0.30.1\n")
                    if norm[:4] == ["docker", "buildx", "inspect", "default"]:
                        return _ok(bad_inspect)
                    raise AssertionError(f"unexpected build invocation: {args}")

                with patch.object(rehearsal, "run_cmd", side_effect=fake_buildx_external):
                    with self.assertRaisesRegex(RuntimeError, "local docker driver"):
                        rehearsal.ensure_offline_gates_image(endpoint)

        # Case C: buildx absent -> falls back to legacy local daemon build with DOCKER_BUILDKIT=0.
        calls_c = []

        def fake_no_buildx(args, **kwargs):
            calls_c.append((args, kwargs.get("env")))
            norm = _docker_subargs(args)
            if norm[:3] == ["docker", "image", "inspect"]:
                return _fail(1)
            if norm[:3] == ["docker", "buildx", "version"]:
                return _fail(125, "unknown command: docker buildx")
            return _ok("")

        with patch.object(rehearsal, "run_cmd", side_effect=fake_no_buildx):
            mode_c = rehearsal.ensure_offline_gates_image(endpoint)
        self.assertEqual(mode_c, "legacy-local-daemon")
        legacy_cmds = [(a, e) for a, e in calls_c if _docker_subargs(a)[:2] == ["docker", "build"]]
        self.assertEqual(len(legacy_cmds), 1)
        legacy_args, legacy_env = legacy_cmds[0]
        self.assertEqual(legacy_args[:3], ["docker", "--host", endpoint])
        self.assertEqual(legacy_env["DOCKER_HOST"], endpoint)
        self.assertEqual(legacy_env["DOCKER_BUILDKIT"], "0")
        self.assertIsNone(legacy_env["DOCKER_CONTEXT"])

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
