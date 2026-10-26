import importlib.util
import io
import json
import os
import sys
import types
import unittest
from pathlib import Path


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.metadata = {}
        self.puts = []

    def head_object(self, **kwargs):
        body = self.objects[kwargs["Key"]]
        return {"Metadata": self.metadata, "ContentLength": len(body)}

    def get_object(self, **kwargs):
        return {"Body": io.BytesIO(self.objects[kwargs["Key"]])}

    def put_object(self, **kwargs):
        self.puts.append(kwargs)
        return {}


class FakeDynamoDB:
    def __init__(self):
        self.previous = None
        self.puts = []

    def get_item(self, **kwargs):
        return {"Item": self.previous} if self.previous else {}

    def put_item(self, **kwargs):
        self.puts.append(kwargs)
        return {}


fake_s3 = FakeS3()
fake_ddb = FakeDynamoDB()
fake_boto3 = types.ModuleType("boto3")
fake_boto3.client = lambda name: fake_s3 if name == "s3" else fake_ddb
sys.modules["boto3"] = fake_boto3

os.environ.update(
    SOURCE_STATE_TABLE="state",
    EVIDENCE_KMS_KEY_ARN="arn:aws:kms:us-east-1:123:key/test",
    VENDOR_SOURCE_HOSTS="samsung.com,google.com",
)

spec = importlib.util.spec_from_file_location(
    "firmware_provenance",
    Path("infra/cloud/lambda/firmware_provenance.py"),
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FirmwareProvenanceTests(unittest.TestCase):
    def setUp(self):
        fake_s3.objects = {"firmware-intake/fw.bin": b"firmware-bytes"}
        fake_s3.metadata = {
            "vendor": "samsung",
            "device-model": "SM-T500",
            "firmware-build": "T500XXU8",
            "bootloader-revision": "8",
            "vendor-source-url": "https://www.samsung.com/support/fw",
        }
        fake_s3.puts.clear()
        fake_ddb.previous = None
        fake_ddb.puts.clear()

    def event(self):
        return {
            "Records": [
                {
                    "s3": {
                        "bucket": {"name": "evidence"},
                        "object": {"key": "firmware-intake/fw.bin"},
                    }
                }
            ]
        }

    def test_emits_evidence_only_manifest(self):
        result = module.handler(self.event(), None)
        self.assertFalse(result["executionAuthorized"])
        self.assertFalse(result["deviceWriteAuthorityGranted"])
        self.assertFalse(result["replacementDetected"])
        self.assertEqual(len(fake_s3.puts), 1)
        body = json.loads(fake_s3.puts[0]["Body"])
        self.assertFalse(body["executionAuthorized"])
        self.assertFalse(body["deviceWriteAuthorityGranted"])
        self.assertEqual(body["deviceModel"], "SM-T500")

    def test_detects_source_replacement(self):
        fake_ddb.previous = {"artifactSha256": {"S": "0" * 64}}
        result = module.handler(self.event(), None)
        self.assertTrue(result["replacementDetected"])
        self.assertEqual(result["executionAuthorized"], False)

    def test_rejects_unapproved_source(self):
        fake_s3.metadata["vendor-source-url"] = "https://evil.example/fw"
        with self.assertRaisesRegex(ValueError, "approved HTTPS host"):
            module.handler(self.event(), None)
        self.assertEqual(fake_s3.puts, [])

    def test_rejects_non_exact_model(self):
        fake_s3.metadata["device-model"] = "../../device"
        with self.assertRaisesRegex(ValueError, "exact normalized model"):
            module.handler(self.event(), None)
        self.assertEqual(fake_s3.puts, [])

    def test_rejects_outside_intake_prefix(self):
        event = self.event()
        event["Records"][0]["s3"]["object"]["key"] = "public/fw.bin"
        with self.assertRaisesRegex(ValueError, "outside firmware-intake"):
            module.handler(event, None)


if __name__ == "__main__":
    unittest.main()
