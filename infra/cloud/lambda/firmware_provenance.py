import hashlib
import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import unquote_plus, urlparse

import boto3

s3 = boto3.client("s3")
ddb = boto3.client("dynamodb")

MODEL_RE = re.compile(r"^[A-Z0-9-]{3,32}$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def _allowed_source(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    allowed = {
        host.strip().lower()
        for host in os.environ.get("VENDOR_SOURCE_HOSTS", "").split(",")
        if host.strip()
    }
    hostname = parsed.hostname.lower()
    return any(hostname == item or hostname.endswith("." + item) for item in allowed)


def _validate_metadata(metadata):
    errors = []
    if not re.fullmatch(r"[a-z0-9-]{2,32}", metadata.get("vendor", "")):
        errors.append("vendor must be normalized")
    if not MODEL_RE.fullmatch(metadata.get("device-model", "")):
        errors.append("device-model must be an exact normalized model")
    if not metadata.get("firmware-build", "").strip():
        errors.append("firmware-build is required")
    if not metadata.get("bootloader-revision", "").isdigit():
        errors.append("bootloader-revision must be numeric")
    if not _allowed_source(metadata.get("vendor-source-url", "")):
        errors.append("vendor-source-url is not on the approved HTTPS host list")
    return errors


def _hash_object(bucket, key):
    stream = s3.get_object(Bucket=bucket, Key=key)["Body"]
    digest = hashlib.sha256()
    while True:
        chunk = stream.read(8 * 1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
    return digest.hexdigest()


def _source_hash(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def handler(event, context):
    records = event.get("Records", [])
    if len(records) != 1:
        raise ValueError("exactly one S3 object event is required")

    record = records[0]
    bucket = record["s3"]["bucket"]["name"]
    key = unquote_plus(record["s3"]["object"]["key"])
    if not key.startswith("firmware-intake/"):
        raise ValueError("object is outside firmware-intake/")

    head = s3.head_object(Bucket=bucket, Key=key)
    metadata = {k.lower(): v for k, v in head.get("Metadata", {}).items()}
    errors = _validate_metadata(metadata)
    if errors:
        raise ValueError("; ".join(errors))

    artifact_sha256 = _hash_object(bucket, key)
    if not SHA256_RE.fullmatch(artifact_sha256):
        raise ValueError("computed digest is invalid")

    source_url = metadata["vendor-source-url"]
    source_url_hash = _source_hash(source_url)
    table_name = os.environ["SOURCE_STATE_TABLE"]
    previous = ddb.get_item(
        TableName=table_name,
        Key={"sourceUrlHash": {"S": source_url_hash}},
        ConsistentRead=True,
    ).get("Item")
    previous_sha256 = (previous or {}).get("artifactSha256", {}).get("S")
    replacement_detected = bool(
        previous_sha256 and previous_sha256 != artifact_sha256
    )

    observed_at = (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
    manifest = {
        "schema": "com.bobbyblanco.bobfwtools.firmware-provenance.v1",
        "vendor": metadata["vendor"],
        "deviceModel": metadata["device-model"],
        "firmwareBuild": metadata["firmware-build"],
        "bootloaderRevision": int(metadata["bootloader-revision"]),
        "vendorSourceUrl": source_url,
        "sourceUrlHash": source_url_hash,
        "artifactSha256": artifact_sha256,
        "artifactBytes": head["ContentLength"],
        "observedAt": observed_at,
        "replacementDetected": replacement_detected,
        "previousArtifactSha256": previous_sha256,
        "executionAuthorized": False,
        "deviceWriteAuthorityGranted": False,
    }
    unsigned = (
        json.dumps(manifest, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode("utf-8")
    manifest["manifestSha256"] = hashlib.sha256(unsigned).hexdigest()
    encoded = (
        json.dumps(manifest, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode("utf-8")

    manifest_key = (
        f"firmware-provenance/{metadata['vendor']}/"
        f"{metadata['device-model']}/{artifact_sha256}.json"
    )
    s3.put_object(
        Bucket=bucket,
        Key=manifest_key,
        Body=encoded,
        ContentType="application/json",
        ServerSideEncryption="aws:kms",
        SSEKMSKeyId=os.environ["EVIDENCE_KMS_KEY_ARN"],
    )
    ddb.put_item(
        TableName=table_name,
        Item={
            "sourceUrlHash": {"S": source_url_hash},
            "sourceUrl": {"S": source_url},
            "artifactSha256": {"S": artifact_sha256},
            "deviceModel": {"S": metadata["device-model"]},
            "firmwareBuild": {"S": metadata["firmware-build"]},
            "observedAt": {"S": observed_at},
            "manifestKey": {"S": manifest_key},
        },
    )
    return {
        "manifestKey": manifest_key,
        "artifactSha256": artifact_sha256,
        "manifestSha256": manifest["manifestSha256"],
        "replacementDetected": replacement_detected,
        "executionAuthorized": False,
        "deviceWriteAuthorityGranted": False,
    }
