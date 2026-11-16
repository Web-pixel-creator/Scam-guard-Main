"""Read-only immutable Linux/amd64 Docker identity gate (classic/containerd)."""
import argparse
import json
import re
import subprocess

DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
INDEX_TYPES = {"application/vnd.oci.image.index.v1+json",
               "application/vnd.docker.distribution.manifest.list.v2+json"}


def verify(record, digest, config_id):
    if not DIGEST.fullmatch(digest) or not DIGEST.fullmatch(config_id):
        raise ValueError("invalid pinned digest")
    if record.get("Os") != "linux" or record.get("Architecture") != "amd64":
        raise ValueError("image platform must be linux/amd64")
    repo_digests = record.get("RepoDigests")
    if not isinstance(repo_digests, list) or not any(
        isinstance(value, str) and value.endswith("@" + digest) for value in repo_digests
    ):
        raise ValueError("immutable repository digest mismatch")
    if record.get("Id") == config_id:
        return "classic-config-id"
    descriptor = record.get("Descriptor") or {}
    # Docker's containerd image store reports an index ID instead of the
    # legacy config ID. An exact pinned index plus resolved OS/architecture
    # binds the same immutable platform image; arbitrary tag/ID is insufficient.
    if (record.get("Id") == digest and descriptor.get("digest") == digest
            and descriptor.get("mediaType") in INDEX_TYPES):
        return "containerd-pinned-index"
    raise ValueError("image ID/descriptor does not match either pinned representation")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    parser.add_argument("--digest", required=True)
    parser.add_argument("--config-id", required=True)
    args = parser.parse_args()
    result = subprocess.run(["docker", "image", "inspect", args.image],
                            capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise SystemExit("image inspect failed")
    records = json.loads(result.stdout)
    if not isinstance(records, list) or len(records) != 1:
        raise SystemExit("expected exactly one local image")
    try:
        representation = verify(records[0], args.digest, args.config_id)
    except (ValueError, TypeError, AttributeError) as exc:
        raise SystemExit("image identity rejected: " + str(exc)) from None
    print("Immutable linux/amd64 image: PASS (" + representation + ")")


if __name__ == "__main__":
    main()
