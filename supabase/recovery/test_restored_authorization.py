"""Fail-closed tests for the restored-database authorization gate (offline)."""
import copy
import json
import unittest
from unittest.mock import patch

import restored_authorization as gate


class RestoredAuthorizationTests(unittest.TestCase):
    def test_accepts_exact_tap_with_non_tap_psql_results(self):
        self.assertEqual(gate.check_tap('1..2\nok 1 - first\n{}\nok 2 - next\n', 2), 2)

    def test_rejects_failures_even_when_psql_exit_was_zero(self):
        for text in ('1..2\nok 1 - first\nnot ok 2 - denied\n',
                     '1..2\nok 1\nok 2\nBail out! problem\n',
                     '1..2\nok 1 # SKIP unavailable\nok 2\n',
                     '1..2\nok 1\nnot ok 2 # TODO later\n'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                gate.check_tap(text, 2)

    def test_rejects_missing_duplicate_reordered_or_truncated_results(self):
        for text in ('', 'ok 1\nok 2', '1..0 # SKIP', '1..2\nok 1',
                     '1..2\nok 1\nok 1', '1..2\nok 2\nok 1',
                     '1..2\nok 1\nok 2\nok 3', '1..2\n1..2\nok 1\nok 2',
                     '1..3\nok 1\nok 2', '1..2\nok\nok 2'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                gate.check_tap(text, 2)

    def target(self):
        return {'Id': 'c' * 64, 'Image': 'sha256:' + 'a' * 64,
                'Config': {'Labels': {'com.supabase.cli.project': 'ishonch-backup-drill-123'}},
                'State': {'Running': True},
                'HostConfig': {'NetworkMode': 'bridge', 'PidMode': '', 'Privileged': False,
                               'PortBindings': {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '55432'}]}},
                'Mounts': [],
                'NetworkSettings': {'Networks': {'ishonch-backup-internal-123': {}},
                                    'Ports': {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '55432'}]}}}

    def test_isolation_accepts_only_owned_internal_target(self):
        target = self.target()
        self.assertEqual(gate.check_target(target, {'Internal': True},
            'ishonch-backup-drill-123', 'ishonch-backup-internal-123',
            'sha256:' + 'a' * 64, '55432'), 'c' * 64)
        target['NetworkSettings']['Ports'] = {'5432/tcp': None}
        self.assertEqual(gate.check_target(target, {'Internal': True},
            'ishonch-backup-drill-123', 'ishonch-backup-internal-123',
            'sha256:' + 'a' * 64, '55432'), 'c' * 64)

    def test_isolation_rejects_live_or_mismatched_targets(self):
        mutations = [lambda t: t['Config']['Labels'].clear(),
                     lambda t: t['NetworkSettings']['Networks'].update({'bridge': {}}),
                     lambda t: t.update(Image='sha256:' + 'b' * 64),
                     lambda t: t['State'].update(Running=False),
                     lambda t: t['HostConfig'].update(NetworkMode='host'),
                     lambda t: t['HostConfig'].update(PidMode='host'),
                     lambda t: t['HostConfig'].update(Privileged=True),
                     lambda t: t['NetworkSettings']['Ports']['5432/tcp'][0].update(HostIp='0.0.0.0'),
                     lambda t: t['Mounts'].append({'Destination': '/var/run/docker.sock'})]
        for mutate in mutations:
            target = copy.deepcopy(self.target())
            mutate(target)
            with self.subTest(mutation=mutate), self.assertRaises(ValueError):
                gate.check_target(target, {'Internal': True}, 'ishonch-backup-drill-123',
                                  'ishonch-backup-internal-123', 'sha256:' + 'a' * 64, '55432')
        for network in ({}, {'Internal': False}):
            with self.assertRaises(ValueError):
                gate.check_target(self.target(), network, 'ishonch-backup-drill-123',
                                  'ishonch-backup-internal-123', 'sha256:' + 'a' * 64, '55432')

    def test_refuses_arbitrary_project_or_mismatched_run_before_docker(self):
        for project, network in [('production', 'bridge'),
                                 ('ishonch-backup-drill-123', 'ishonch-backup-internal-124'),
                                 ('ishonch-backup-drill-123', 'ishonch-full-internal-123')]:
            with patch.object(gate, 'command') as command, self.assertRaises(ValueError):
                gate.verify_isolation(project, network, 'sha256:' + 'a' * 64, '55432', 'sha256:' + 'b' * 64)
            command.assert_not_called()

    def test_inspection_binds_classic_and_containerd_to_the_actual_container_image(self):
        config, digest = 'sha256:' + 'a' * 64, 'sha256:' + 'b' * 64
        for actual in (config, digest):
            target = self.target()
            target['Image'] = actual
            image = {'Id': actual, 'Os': 'linux', 'Architecture': 'amd64',
                     'RepoDigests': ['synthetic/image@' + digest],
                     'Descriptor': {'digest': digest, 'mediaType': 'application/vnd.oci.image.index.v1+json'}}
            outputs = [json.dumps([target]), json.dumps([image]), json.dumps([{'Internal': True}])]
            with patch.object(gate, 'command', side_effect=outputs) as command:
                self.assertEqual(gate.verify_isolation('ishonch-backup-drill-123',
                    'ishonch-backup-internal-123', config, '55432', digest), 'c' * 64)
            self.assertEqual(command.call_args_list[1].args[0], ['docker', 'image', 'inspect', actual])

    def test_unpinned_image_rejected_before_network_inspection_or_sql(self):
        target = self.target()
        image = {'Id': target['Image'], 'Os': 'linux', 'Architecture': 'amd64', 'RepoDigests': []}
        with patch.object(gate, 'command', side_effect=[json.dumps([target]), json.dumps([image])]) as command:
            with self.assertRaises(ValueError):
                gate.verify_isolation('ishonch-backup-drill-123', 'ishonch-backup-internal-123',
                                      'sha256:' + 'a' * 64, '55432', 'sha256:' + 'b' * 64)
        self.assertEqual(command.call_count, 2)

    def test_trusted_tests_have_exact_pinned_content_and_rollback(self):
        tests = gate.load_tests('production-33')
        self.assertEqual(sum(expected for _, expected in tests), 92)
        self.assertEqual(len(tests), 4)
        for text, _ in tests:
            self.assertTrue(text.strip().startswith('BEGIN;'))
            self.assertTrue(text.strip().endswith('ROLLBACK;'))

    def test_no_writes_when_scheduler_enabled(self):
        with patch.object(gate, 'sql', return_value='on') as sql, self.assertRaises(ValueError):
            gate.run_tests('c' * 64, [('BEGIN; ROLLBACK;', 1)])
        self.assertEqual(sql.call_count, 1)

    def test_fixture_transaction_runs_and_extension_cleanup_on_tap_failure(self):
        with patch.object(gate, 'sql', side_effect=['off', '', '', '1..1\nnot ok 1', '']) as sql:
            with self.assertRaises(ValueError):
                gate.run_tests('c' * 64, [('BEGIN; ROLLBACK;', 1)])
        self.assertIn('DROP EXTENSION IF EXISTS pgtap', sql.call_args.args[1])

    def test_rejects_unpinned_empty_or_path_traversal_test_inventory(self):
        for test in ({'file': '../bad.test.sql', 'sha256': 'a' * 64, 'tests': 1},
                     {'file': 'admin_mfa_aal2_rls.test.sql', 'sha256': 'a' * 64, 'tests': 23}):
            with patch.object(gate, 'load_profile', return_value={'authorization_tests': [test]}):
                with self.assertRaises(ValueError):
                    gate.load_tests('production-33')
        with patch.object(gate, 'load_profile', return_value={'authorization_tests': []}):
            with self.assertRaises(ValueError):
                gate.load_tests('production-33')

    def test_preserves_preexisting_extension(self):
        with patch.object(gate, 'sql', side_effect=['off', 'extensions', '1..1\nok 1']) as sql:
            self.assertEqual(gate.run_tests('c' * 64, [('BEGIN; ROLLBACK;', 1)]), 1)
        self.assertEqual(sql.call_count, 3)


if __name__ == '__main__':
    unittest.main()
