"""Behavioral authorization gate, ONLY for an owned isolated restore container.

No URL/password input. SQL comes from hash-pinned checkout tests, never the
archive. Each suite rolls back its fixtures. Output is aggregate-only: pgTAP
diagnostics may contain restored values and must not reach Actions logs.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

from recovery_contract import load_profile
from verify_image_identity import verify as verify_image

ROOT = Path(__file__).resolve().parents[2]


def check_tap(output, expected):
    plans, passed = [], []
    for raw in output.splitlines():
        line = raw.strip()
        if re.match(r'(?i)^(not ok\b|bail out!)', line):
            raise ValueError('authorization behavior failed')
        if line.startswith('1..'):
            if not re.fullmatch(r'1\.\.[1-9][0-9]*', line):
                raise ValueError('invalid or skipped authorization plan')
            plans.append(int(line[3:]))
        elif re.match(r'^ok\b', line):
            match = re.fullmatch(r'ok ([1-9][0-9]*)(?: - .*)?', line)
            if not match or re.search(r'(?i)#\s*(SKIP|TODO)\b', line):
                raise ValueError('invalid or skipped authorization result')
            passed.append(int(match[1]))
    if plans != [expected] or passed != list(range(1, expected + 1)):
        raise ValueError('incomplete authorization results')
    return expected


def command(args, text=None):
    # All child output is private. Never include stderr/SQL in an exception.
    result = subprocess.run(args, input=text, capture_output=True, text=True,
                            encoding='utf-8', timeout=150)
    if result.returncode:
        raise ValueError('isolated authorization command failed')
    return result.stdout.strip()


def check_target(target, network, project, network_name, image_id, port):
    config = target['HostConfig']
    # After detaching the NAT network Docker may remove the published mapping
    # altogether. Only no listener or the already verified loopback is safe.
    ports = target['NetworkSettings'].get('Ports')
    safe_ports = ports in ({'5432/tcp': None},
                          {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': port}]})
    if (target['Config'].get('Labels', {}).get('com.supabase.cli.project') != project
            or target['Image'] != image_id or not target['State']['Running']
            or config['NetworkMode'] == 'host' or config.get('PidMode')
            or config.get('Privileged')
            or not safe_ports
            or set(target['NetworkSettings']['Networks']) != {network_name}
            or network.get('Internal') is not True
            or any(m['Destination'] == '/var/run/docker.sock' for m in target['Mounts'])
            or not re.fullmatch('[a-f0-9]{64}', target['Id'])):
        raise ValueError('authorization target is not isolated')
    return target['Id']


def verify_isolation(project, network_name, image_id, port, index_digest):
    match = re.fullmatch(r'ishonch-(backup|full)-drill-([0-9]+)', project)
    if (not match or network_name != f'ishonch-{match[1]}-internal-{match[2]}'
            or not re.fullmatch(r'sha256:[a-f0-9]{64}', image_id)
            or not re.fullmatch(r'sha256:[a-f0-9]{64}', index_digest)
            or not re.fullmatch(r'[0-9]{1,5}', port)):
        raise ValueError('unreviewed authorization target')
    target = json.loads(command(['docker', 'inspect', 'supabase_db_' + project]))[0]
    # The immutable image ID is a config ID on classic Docker and an index ID
    # on containerd. Reuse the reviewed identity gate, never compare a tag.
    image = json.loads(command(['docker', 'image', 'inspect', target['Image']]))[0]
    verify_image(image, index_digest, image_id)
    network = json.loads(command(['docker', 'network', 'inspect', network_name]))[0]
    return check_target(target, network, project, network_name, image['Id'], port)


def load_tests(profile_name):
    tests = []
    for test in load_profile(profile_name)['authorization_tests']:
        name = test['file']
        if not re.fullmatch(r'[a-z_][a-z0-9_]*\.test\.sql', name):
            raise ValueError('invalid authorization test filename')
        text = (ROOT / 'supabase/tests' / name).read_text(encoding='utf-8')
        if (hashlib.sha256(text.encode('utf-8')).hexdigest() != test['sha256']
                or not text.strip().startswith('BEGIN;') or not text.strip().endswith('ROLLBACK;')
                or not isinstance(test['tests'], int) or test['tests'] < 1):
            raise ValueError('authorization test source drift')
        tests.append((text, test['tests']))
    if not tests:
        raise ValueError('authorization test inventory empty')
    return tests


def sql(container_id, text):
    return command(['docker', 'exec', '--user', 'postgres', '-i', container_id,
                    'psql', '-X', '-Atq', '--no-password', '-h', '/var/run/postgresql',
                    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
                   "SET statement_timeout='120s'; SET lock_timeout='10s';\n" + text)


def run_tests(container_id, tests):
    if sql(container_id, "SHOW cron.launch_active_jobs;") != 'off':
        raise ValueError('authorization gate requires disabled scheduler')
    existing = sql(container_id, "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n "
                   "ON n.oid=e.extnamespace WHERE e.extname='pgtap';")
    if existing not in ('', 'extensions'):
        raise ValueError('unexpected pgTAP namespace')
    # Try/finally also covers a failed CREATE; cleanup failure is itself fatal.
    try:
        if not existing:
            sql(container_id, 'CREATE EXTENSION pgtap WITH SCHEMA extensions;')
        passed = 0
        for text, expected in tests:
            output = sql(container_id, 'SET search_path=public,extensions;\n' + text)
            passed += check_tap(output, expected)
        return passed
    finally:
        if not existing:
            sql(container_id, 'DROP EXTENSION IF EXISTS pgtap;')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', required=True, choices=('production-33',))
    args = parser.parse_args()
    tests = load_tests(args.profile)
    container_id = verify_isolation(os.environ['DRILL_PROJECT_ID'],
        os.environ['DRILL_INTERNAL_NETWORK'], os.environ['SUPABASE_POSTGRES_AMD64_IMAGE_ID'],
        os.environ['DRILL_DB_PORT'], os.environ['SUPABASE_POSTGRES_INDEX_DIGEST'])
    count = run_tests(container_id, tests)
    print(f'Restored authorization behavior: PASS ({count} assertions; fixtures rolled back)')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, IndexError, subprocess.TimeoutExpired):
        print('Restored authorization gate failed; no private SQL diagnostics are published.', file=sys.stderr)
        sys.exit(1)
