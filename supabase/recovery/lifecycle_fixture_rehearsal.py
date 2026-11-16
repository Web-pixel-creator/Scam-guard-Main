"""Opt-in collision regression on an already isolated restore target.

Not part of backup enablement and accepts no database URL. Reuses the restore
identity/network checks. Synthetic rows and pgTAP fixtures use nested rollback
boundaries; private diagnostics and restored row contents are never printed.
"""
import os
import subprocess
import sys

import restored_authorization as gate


CLEAR = """
DELETE FROM private.telegram_update_leaders WHERE name = 'telegram_updates';
DELETE FROM public.telegram_webhook_updates WHERE update_id IN (900001,900002,900003,900004);
DELETE FROM public.telegram_sessions WHERE telegram_user_id IN (700002,700003);
"""
UPDATE_SEEDS = {
    f'update-{value}': f"""
INSERT INTO public.telegram_webhook_updates (update_id,status,completed_at)
VALUES ({value},'completed',now());
""" for value in (900001, 900002, 900003)
}
SESSION_SEED = """
INSERT INTO public.telegram_sessions (telegram_user_id,last_update_id,last_update_at,scenario_data)
VALUES (700002,990000,now(),'{"synthetic":"retained-session"}'::jsonb);
"""
LEADER_SEED = """
INSERT INTO private.telegram_update_leaders (name,lease_token,fence,lease_expires_at)
VALUES ('telegram_updates','17100000-0000-4000-8000-000000000001',17,now()+interval '1 hour');
"""
UNRELATED = """
INSERT INTO public.telegram_webhook_updates (update_id,status,completed_at)
VALUES (900004,'completed',now());
INSERT INTO public.telegram_sessions (telegram_user_id,last_update_id,scenario_data)
VALUES (700003,990001,'{"synthetic":"unrelated-session"}'::jsonb);
"""
SEEDS = {'empty': '', **UPDATE_SEEDS, 'future-session': SESSION_SEED,
         'leader': LEADER_SEED,
         'combined': ''.join(UPDATE_SEEDS.values()) + SESSION_SEED + LEADER_SEED}
STATE = """
SELECT jsonb_build_array(
  (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY update_id),'[]'::jsonb)
   FROM public.telegram_webhook_updates t),
  (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY telegram_user_id),'[]'::jsonb)
   FROM public.telegram_sessions t),
  (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY name),'[]'::jsonb)
   FROM private.telegram_update_leaders t))
"""


def collision_test(text, seed):
    text = text.strip()
    if not text.startswith('BEGIN;') or not text.endswith('ROLLBACK;'):
        raise ValueError('fixture suite must have rollback boundaries')
    body = text[len('BEGIN;'):-len('ROLLBACK;')]
    return ('BEGIN;\n' + CLEAR + seed + UNRELATED +
            '\nCREATE TEMP TABLE fixture_before ON COMMIT DROP AS SELECT (' + STATE + ') AS state;\n'
            'SAVEPOINT fixture_suite;\n' + body +
            '\nROLLBACK TO SAVEPOINT fixture_suite;\n'
            'DO $preserved$ BEGIN IF (SELECT state FROM fixture_before) IS DISTINCT FROM (' + STATE +
            ") THEN RAISE EXCEPTION 'fixture rollback changed restored rows'; END IF; END $preserved$;\n"
            'ROLLBACK;')


def run_matrix(container_id, text, expected):
    # Only a digest leaves SQL; all row values remain inside the isolated DB.
    fingerprint = 'SELECT md5((' + STATE + ')::text);'
    before = gate.sql(container_id, fingerprint)
    passed = 0
    try:
        for seed in SEEDS.values():
            passed += gate.run_tests(container_id, [(collision_test(text, seed), expected)])
    finally:
        if gate.sql(container_id, fingerprint) != before:
            raise ValueError('outer fixture rollback changed restored rows')
    return passed


def main():
    tests = gate.load_tests('production-33')
    matches = [(text, count) for text, count in tests
               if 'SELECT plan(41);' in text and 'public.begin_telegram_update(' in text]
    if len(matches) != 1:
        raise ValueError('lifecycle suite inventory drift')
    container = gate.verify_isolation(os.environ['DRILL_PROJECT_ID'],
        os.environ['DRILL_INTERNAL_NETWORK'], os.environ['SUPABASE_POSTGRES_AMD64_IMAGE_ID'],
        os.environ['DRILL_DB_PORT'], os.environ['SUPABASE_POSTGRES_INDEX_DIGEST'])
    passed = run_matrix(container, *matches[0])
    print(f'Lifecycle fixture collisions: PASS ({len(SEEDS)} cases; {passed} assertions; rows preserved)')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, IndexError, subprocess.TimeoutExpired):
        print('Lifecycle fixture regression failed; private SQL diagnostics suppressed.', file=sys.stderr)
        sys.exit(1)
