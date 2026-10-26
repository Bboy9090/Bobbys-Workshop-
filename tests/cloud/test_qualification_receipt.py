import importlib.util
import json
import os
import sys
import types
import unittest
from pathlib import Path

class FakeS3:
    def __init__(self): self.calls=[]
    def put_object(self, **kwargs): self.calls.append(kwargs); return {}

fake_s3=FakeS3()
fake_boto3=types.ModuleType('boto3')
fake_boto3.client=lambda name: fake_s3
sys.modules['boto3']=fake_boto3
os.environ['EVIDENCE_BUCKET']='test-bucket'
os.environ['EVIDENCE_KMS_KEY_ARN']='arn:aws:kms:us-east-1:123:key/test'
path=Path('infra/cloud/lambda/qualification_receipt.py')
spec=importlib.util.spec_from_file_location('qualification_receipt', path)
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

class ReceiptTests(unittest.TestCase):
    def setUp(self): fake_s3.calls.clear()
    def valid(self):
        return {
            'schema': mod.SCHEMA,
            'sourceRevision': 'a'*40,
            'artifactSha256': 'b'*64,
            'provenanceSha256': 'c'*64,
            'platform': 'macos',
            'status': 'qualified-evidence-only',
            'evidence': ['ci:green'],
            'executionPerformed': False,
            'deviceWriteAuthorityGranted': False,
        }
    def call(self, value): return mod.handler({'body':json.dumps(value),'isBase64Encoded':False},None)
    def test_accepts_fail_closed_receipt(self):
        r=self.call(self.valid()); self.assertEqual(r['statusCode'],202); self.assertEqual(len(fake_s3.calls),1)
        body=json.loads(r['body']); self.assertFalse(body['executionPerformed']); self.assertFalse(body['deviceWriteAuthorityGranted'])
        self.assertTrue(fake_s3.calls[0]['Key'].startswith('qualification-receipts/'))
    def test_rejects_write_authority_claim(self):
        v=self.valid(); v['deviceWriteAuthorityGranted']=True
        r=self.call(v); self.assertEqual(r['statusCode'],422); self.assertEqual(fake_s3.calls,[])
    def test_rejects_execution_claim(self):
        v=self.valid(); v['executionPerformed']=True
        r=self.call(v); self.assertEqual(r['statusCode'],422); self.assertEqual(fake_s3.calls,[])
    def test_rejects_bad_digests(self):
        v=self.valid(); v['artifactSha256']='bad'
        r=self.call(v); self.assertEqual(r['statusCode'],422); self.assertEqual(fake_s3.calls,[])

if __name__=='__main__': unittest.main()
