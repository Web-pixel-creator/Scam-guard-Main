"""Offline contract checks; real PostgreSQL matrix is a separate opt-in gate."""
import unittest
from unittest.mock import patch

import lifecycle_fixture_rehearsal as fixture
import restored_authorization as gate


class LifecycleFixtureTests(unittest.TestCase):
    def test_pinned_lifecycle_reserves_only_its_fixture_ids_before_assertions(self):
        text = (gate.ROOT / 'supabase/tests/telegram_update_lifecycle.test.sql').read_text()
        prefix = text.split('SELECT plan(41);')[0]
        self.assertTrue(prefix.startswith('BEGIN;'))
        self.assertIn('DELETE FROM public.telegram_webhook_updates\nWHERE update_id IN (900001, 900002, 900003);', prefix)
        self.assertIn('DELETE FROM public.telegram_sessions\nWHERE telegram_user_id = 700002;', prefix)
        self.assertNotIn('TRUNCATE', text)
        self.assertTrue(text.strip().endswith('ROLLBACK;'))

    def test_collision_matrix_has_individual_and_combined_controls(self):
        self.assertEqual(set(fixture.SEEDS), {'empty', 'update-900001', 'update-900002',
                                              'update-900003', 'future-session', 'leader', 'combined'})
        # NULL last_update_at intentionally starts a new sequencing epoch;
        # only a fresh timestamp models a real newer retained session.
        self.assertIn('last_update_id,last_update_at,scenario_data', fixture.SESSION_SEED)
        self.assertIn('(700002,990000,now(),', fixture.SESSION_SEED)
        for seed in fixture.SEEDS.values():
            text = fixture.collision_test('BEGIN; SELECT plan(41); ROLLBACK;', seed)
            self.assertTrue(text.startswith('BEGIN;'))
            self.assertTrue(text.endswith('ROLLBACK;'))
            self.assertLess(text.index('CREATE TEMP TABLE fixture_before'), text.index('SAVEPOINT fixture_suite;'))
            self.assertLess(text.index('ROLLBACK TO SAVEPOINT fixture_suite;'), text.index('IS DISTINCT FROM'))
            self.assertIn(fixture.UNRELATED, text)
            self.assertNotIn('COMMIT;', text)

    def test_rejects_missing_transaction_boundaries(self):
        for text in ('SELECT 1;', 'BEGIN; SELECT 1;', 'SELECT 1; ROLLBACK;'):
            with self.assertRaises(ValueError):
                fixture.collision_test(text, '')

    def test_checks_outer_state_after_failure_and_never_swallows_failure(self):
        with patch.object(gate, 'sql', side_effect=['same', 'same']) as sql, \
                patch.object(gate, 'run_tests', side_effect=ValueError('failed')):
            with self.assertRaisesRegex(ValueError, 'failed'):
                fixture.run_matrix('synthetic', 'BEGIN; ROLLBACK;', 41)
            self.assertEqual(sql.call_count, 2)

    def test_rejects_outer_state_drift_even_after_all_passing_tap(self):
        with patch.object(gate, 'sql', side_effect=['before', 'after']), \
                patch.object(gate, 'run_tests', return_value=41) as run:
            with self.assertRaisesRegex(ValueError, 'outer fixture rollback'):
                fixture.run_matrix('synthetic', 'BEGIN; ROLLBACK;', 41)
            self.assertEqual(run.call_count, 7)

    def test_main_verifies_target_before_any_matrix_sql(self):
        with patch.object(gate, 'load_tests', return_value=[('SELECT plan(41); public.begin_telegram_update(', 41)]), \
                patch.dict(fixture.os.environ, {name: 'synthetic' for name in (
                    'DRILL_PROJECT_ID', 'DRILL_INTERNAL_NETWORK', 'SUPABASE_POSTGRES_AMD64_IMAGE_ID',
                    'DRILL_DB_PORT', 'SUPABASE_POSTGRES_INDEX_DIGEST')}), \
                patch.object(gate, 'verify_isolation', side_effect=ValueError('not isolated')), \
                patch.object(fixture, 'run_matrix') as run:
            with self.assertRaises(ValueError):
                fixture.main()
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
