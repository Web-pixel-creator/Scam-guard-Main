"""Both supported Docker representations retain immutable platform pinning."""
import copy
import unittest

from verify_image_identity import verify

DIGEST = "sha256:" + "a" * 64
CONFIG = "sha256:" + "b" * 64


class ImageIdentityTests(unittest.TestCase):
    def record(self):
        return {"Id": DIGEST, "Os": "linux", "Architecture": "amd64",
                "RepoDigests": ["synthetic/image@" + DIGEST],
                "Descriptor": {"digest": DIGEST, "mediaType": "application/vnd.oci.image.index.v1+json"}}

    def test_classic(self):
        image = self.record()
        image["Id"] = CONFIG
        del image["Descriptor"]
        self.assertEqual(verify(image, DIGEST, CONFIG), "classic-config-id")

    def test_containerd(self):
        self.assertEqual(verify(self.record(), DIGEST, CONFIG), "containerd-pinned-index")

    def test_docker_index(self):
        image = self.record()
        image["Descriptor"]["mediaType"] = "application/vnd.docker.distribution.manifest.list.v2+json"
        self.assertEqual(verify(image, DIGEST, CONFIG), "containerd-pinned-index")

    def test_changed_platform_or_pin_is_rejected(self):
        for key, value in (("Os", "windows"), ("Architecture", "arm64"),
                           ("Id", "sha256:" + "c" * 64), ("RepoDigests", []),
                           ("RepoDigests", ["synthetic/image@sha256:" + "d" * 64]),
                           ("RepoDigests", None), ("Descriptor", None),
                           ("Descriptor", {"digest": CONFIG, "mediaType": "application/vnd.oci.image.index.v1+json"}),
                           ("Descriptor", {"digest": DIGEST, "mediaType": "application/vnd.oci.image.manifest.v1+json"})):
            with self.subTest(field=key, value=value):
                image = copy.deepcopy(self.record())
                image[key] = value
                with self.assertRaises(ValueError):
                    verify(image, DIGEST, CONFIG)

    def test_classic_still_requires_repository_digest_and_platform(self):
        for key, value in (("Architecture", "arm64"), ("RepoDigests", [])):
            image = self.record()
            image["Id"] = CONFIG
            image[key] = value
            with self.assertRaises(ValueError):
                verify(image, DIGEST, CONFIG)

    def test_invalid_pin_is_rejected(self):
        for digest, config in (("latest", CONFIG), (DIGEST, ""), (DIGEST + "\n", CONFIG)):
            with self.subTest(digest=digest, config=config):
                with self.assertRaises(ValueError):
                    verify(self.record(), digest, config)


if __name__ == "__main__":
    unittest.main()
