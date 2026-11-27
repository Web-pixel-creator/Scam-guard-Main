import tempfile
from pathlib import Path
import unittest

from prepare_cli_versions import prepare


class CliVersionsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'supabase').mkdir()
        (self.root / 'supabase/config.toml').write_text('project_id = "synthetic"\n')
        self.env = {'SUPABASE_POSTGRES_IMAGE': 'supabase/postgres:17.11.0.003',
                    'SUPABASE_AUTH_IMAGE': 'supabase/gotrue:v2.194.0',
                    'SUPABASE_STORAGE_IMAGE': 'supabase/storage-api:v1.67.15',
                    'SUPABASE_REALTIME_IMAGE': 'supabase/realtime:v2.102.1'}

    def test_exact_four_cache_tags(self):
        values = prepare(self.root, self.env)
        self.assertEqual(values, {'postgres-version': '17.11.0.003', 'gotrue-version': 'v2.194.0',
                                  'storage-version': 'v1.67.15', 'realtime-version': 'v2.102.1'})
        for name, value in values.items():
            self.assertEqual((self.root / 'supabase/.temp' / name).read_text(), value)

    def test_export_needs_only_postgres(self):
        self.assertEqual(prepare(self.root, {'SUPABASE_POSTGRES_IMAGE': self.env['SUPABASE_POSTGRES_IMAGE']}, True),
                         {'postgres-version': '17.11.0.003'})

    def test_wrong_repository_and_unsafe_tag_rejected_before_write(self):
        for value in ['other/postgres:17.11.0.003', 'supabase/postgres:latest', 'supabase/postgres:17.11\n', 'supabase/postgres:17.11;true']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                prepare(self.root, {**self.env, 'SUPABASE_POSTGRES_IMAGE': value})
        self.assertFalse((self.root / 'supabase/.temp').exists())

    def test_no_overwriting_existing_cache(self):
        prepare(self.root, self.env)
        with self.assertRaises(FileExistsError):
            prepare(self.root, self.env)

    def test_missing_init_rejected(self):
        with self.assertRaises(ValueError):
            prepare(self.root / 'missing', self.env)


if __name__ == '__main__':
    unittest.main()
