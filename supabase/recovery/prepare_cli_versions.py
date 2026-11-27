"""Select checksum-pinned workflow image tags in a fresh CLI 2.104.0 project.

The CLI's defaults do not follow Docker preload tags. Cache file names are
consumed by apps/cli-go/pkg/config/config.go in the pinned CLI source.
"""
import argparse
import os
from pathlib import Path
import re


def prepare(project, env, postgres_only=False):
    project = Path(project)
    if not (project / "supabase/config.toml").is_file():
        raise ValueError("initialized private CLI project required")
    specs = [("POSTGRES", "supabase/postgres", "postgres-version")]
    if not postgres_only:
        specs += [("AUTH", "supabase/gotrue", "gotrue-version"),
                  ("STORAGE", "supabase/storage-api", "storage-version"),
                  ("REALTIME", "supabase/realtime", "realtime-version")]
    versions = {}
    for key, repository, filename in specs:
        value = env["SUPABASE_" + key + "_IMAGE"]
        prefix = repository + ":"
        if not value.startswith(prefix) or not re.fullmatch(r"v?[0-9]+(?:\.[0-9]+){2,3}", value[len(prefix):]):
            raise ValueError("unexpected reviewed image tag")
        versions[filename] = value[len(prefix):]
    cache = project / "supabase/.temp"
    cache.mkdir(mode=0o700, exist_ok=True)
    for filename, value in versions.items():
        path = cache / filename
        # Never replace a linked project cache or silently accept symlinks.
        with path.open("x", encoding="ascii") as target:
            target.write(value)
    return versions


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--postgres-only", action="store_true")
    args = parser.parse_args()
    prepare(args.project, os.environ, args.postgres_only)
