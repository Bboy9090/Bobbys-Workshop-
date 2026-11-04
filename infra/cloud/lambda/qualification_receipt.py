import base64
import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone

import boto3

SCHEMA = "com.bobbyblanco.bobfwtools.qualification-receipt.v1"
HEX64 = re.compile(r"^[a-f0-9]{64}$")
SHA40 = re.compile(r"^[a-f0-9]{40}$")
s3 = boto3.client("s3")


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body, separators=(",", ":"), sort_keys=True),
    }


def _parse_body(event):
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw.encode("utf-8")) > 64 * 1024:
        raise ValueError("receipt body exceeds 64 KiB")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("receipt body must be an object")
    return value


def _validate(value):
    errors = []
    if value.get("schema") != SCHEMA:
        errors.append("unsupported schema")
    if not SHA40.fullmatch(str(value.get("sourceRevision", ""))):
        errors.append("sourceRevision must be a 40-character lowercase git SHA")
    for field in ("artifactSha256", "provenanceSha256"):
        if not HEX64.fullmatch(str(value.get(field, ""))):
            errors.append(f"{field} must be a lowercase SHA-256 digest")
    if value.get("executionPerformed") is not False:
        errors.append("qualification receipt must declare executionPerformed=false")
    if value.get("deviceWriteAuthorityGranted") is not False:
        errors.append("qualification receipt must declare deviceWriteAuthorityGranted=false")
    allowed_status = {"observed", "planned", "qualified-evidence-only", "blocked"}
    if value.get("status") not in allowed_status:
        errors.append("status is not allowed")
    evidence = value.get("evidence")
    if not isinstance(evidence, list) or len(evidence) > 100:
        errors.append("evidence must be an array with at most 100 entries")
    elif any(not isinstance(x, str) or len(x) > 512 for x in evidence):
        errors.append("evidence entries must be strings of at most 512 characters")
    return errors


def handler(event, context):
    try:
        receipt = _parse_body(event)
    except Exception as exc:
        return _response(400, {"accepted": False, "error": str(exc)})

    errors = _validate(receipt)
    if errors:
        return _response(422, {"accepted": False, "errors": errors})

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    normalized = {
        "schema": SCHEMA,
        "receiptId": str(uuid.uuid4()),
        "receivedAt": now,
        "sourceRevision": receipt["sourceRevision"],
        "artifactSha256": receipt["artifactSha256"],
        "provenanceSha256": receipt["provenanceSha256"],
        "platform": str(receipt.get("platform", "unknown"))[:64],
        "status": receipt["status"],
        "evidence": receipt["evidence"],
        "executionPerformed": False,
        "deviceWriteAuthorityGranted": False,
    }
    encoded = (json.dumps(normalized, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    normalized["receiptSha256"] = hashlib.sha256(encoded).hexdigest()
    encoded = (json.dumps(normalized, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")

    bucket = os.environ["EVIDENCE_BUCKET"]
    key = f"qualification-receipts/{now[:10]}/{normalized['receiptId']}.json"
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=encoded,
        ContentType="application/json",
        ServerSideEncryption="aws:kms",
        SSEKMSKeyId=os.environ["EVIDENCE_KMS_KEY_ARN"],
        Metadata={"artifact-sha256": receipt["artifactSha256"], "source-revision": receipt["sourceRevision"]},
    )
    return _response(202, {
        "accepted": True,
        "receiptId": normalized["receiptId"],
        "receiptSha256": normalized["receiptSha256"],
        "objectKey": key,
        "executionPerformed": False,
        "deviceWriteAuthorityGranted": False,
    })
