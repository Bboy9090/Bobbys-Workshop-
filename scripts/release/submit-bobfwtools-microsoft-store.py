#!/usr/bin/env python3
"""Submit one exact BobFWTools MSIX package to an existing Partner Center app.

This script intentionally stops at submission commit/status evidence. It never
claims Microsoft certification, publication, or Store availability.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

API = "https://manage.devcenter.microsoft.com/v1.0/my/applications"
TOKEN_RESOURCE = "https://manage.devcenter.microsoft.com"

WRITABLE_FIELDS = (
    "applicationCategory",
    "pricing",
    "visibility",
    "targetPublishMode",
    "targetPublishDate",
    "listings",
    "hardwarePreferences",
    "automaticBackupEnabled",
    "canInstallOnRemovableMedia",
    "isGameDvrEnabled",
    "gamingOptions",
    "hasExternalInAppProducts",
    "meetAccessibilityGuidelines",
    "notesForCertification",
    "packageDeliveryOptions",
    "enterpriseLicensing",
    "allowMicrosoftDecideAppAvailabilityToFutureDeviceFamilies",
    "allowTargetFutureDeviceFamilies",
    "trailers",
)


def request_json(url: str, method: str, token: str | None = None, payload=None):
    body = None
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed: HTTP {exc.code}: {detail[:2000]}") from exc


def access_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    url = f"https://login.microsoftonline.com/{urllib.parse.quote(tenant_id)}/oauth2/token"
    data = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "resource": TOKEN_RESOURCE,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Microsoft Entra token request failed: HTTP {exc.code}: {detail[:1000]}") from exc
    token = result.get("access_token")
    if not token:
        raise RuntimeError("Microsoft Entra token response did not contain access_token")
    return token


def upload_zip(sas_url: str, zip_path: Path) -> None:
    data = zip_path.read_bytes()
    req = urllib.request.Request(
        sas_url,
        data=data,
        headers={
            "x-ms-blob-type": "BlockBlob",
            "Content-Type": "application/zip",
            "Content-Length": str(len(data)),
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            if response.status not in (200, 201, 202):
                raise RuntimeError(f"Partner Center SAS upload returned HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Partner Center SAS upload failed: HTTP {exc.code}: {detail[:1000]}") from exc


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", required=True, type=Path)
    parser.add_argument("--application-id", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--package-run-id", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    tenant = os.environ.get("BOBFW_MS_STORE_TENANT_ID", "").strip()
    client = os.environ.get("BOBFW_MS_STORE_CLIENT_ID", "").strip()
    secret = os.environ.get("BOBFW_MS_STORE_CLIENT_SECRET", "").strip()
    if not all((tenant, client, secret)):
        raise RuntimeError("Microsoft Store Entra credentials are incomplete")
    if not args.package.is_file() or args.package.suffix.lower() != ".msix":
        raise RuntimeError("exact .msix package is missing")
    if len(args.source_sha) != 40 or any(c not in "0123456789abcdef" for c in args.source_sha.lower()):
        raise RuntimeError("source SHA must be 40 hexadecimal characters")

    token = access_token(tenant, client, secret)
    base = f"{API}/{urllib.parse.quote(args.application_id)}/submissions"
    submission = request_json(base, "POST", token)
    submission_id = str(submission.get("id") or "")
    sas_url = str(submission.get("fileUploadUrl") or "")
    if not submission_id or not sas_url.startswith("https://"):
        raise RuntimeError("Partner Center create-submission response lacked id or fileUploadUrl")

    committed = False
    try:
        payload = {key: submission[key] for key in WRITABLE_FIELDS if key in submission}
        payload["applicationPackages"] = [
            {
                "fileName": args.package.name,
                "fileStatus": "PendingUpload",
                "minimumDirectXVersion": "None",
                "minimumSystemRam": "None",
            }
        ]
        request_json(f"{base}/{urllib.parse.quote(submission_id)}", "PUT", token, payload)

        zip_path = args.output.parent / "partner-center-upload.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(args.package, arcname=args.package.name)
        upload_zip(sas_url, zip_path)
        zip_path.unlink(missing_ok=True)

        request_json(f"{base}/{urllib.parse.quote(submission_id)}/commit", "POST", token, {})
        committed = True

        status_payload = {}
        status = "CommitStarted"
        for _ in range(12):
            status_payload = request_json(
                f"{base}/{urllib.parse.quote(submission_id)}/status", "GET", token
            )
            status = str(status_payload.get("status") or "")
            if status not in ("PendingCommit", "CommitStarted", ""):
                break
            time.sleep(10)

        status_errors = (status_payload.get("statusDetails") or {}).get("errors") or []
        confirmed_statuses = {
            "PreProcessing",
            "Certification",
            "Release",
            "PendingPublication",
            "Publishing",
            "Published",
        }
        failure_statuses = {
            "Canceled",
            "CommitFailed",
            "PreProcessingFailed",
            "CertificationFailed",
            "ReleaseFailed",
            "PublishFailed",
        }
        if status in failure_statuses:
            raise RuntimeError(
                f"Partner Center submission entered failure status {status}: {status_errors}"
            )
        if status not in confirmed_statuses:
            raise RuntimeError(
                "Partner Center commit was not confirmed after polling; "
                f"last status={status or 'empty'}"
            )

        receipt = {
            "schema": "com.bobbyblanco.bobfwtools.microsoft-store-submission-receipt.v1",
            "product": "BobFWTools",
            "distribution": "microsoft-store",
            "sourceRevision": args.source_sha,
            "packageWorkflowRunId": args.package_run_id,
            "applicationId": args.application_id,
            "submissionId": submission_id,
            "package": {
                "name": args.package.name,
                "sha256": sha256(args.package),
            },
            "partnerCenterUploadCompleted": True,
            "submissionCommitted": True,
            "partnerCenterStatus": status or "CommitStarted",
            "microsoftCertificationPassed": status in ("Release", "Publishing", "Published"),
            "storePublished": status == "Published",
            "deviceWriteAuthorityGranted": False,
            "scope": (
                "Partner Center upload/commit evidence only. Certification and publication "
                "are true only when explicitly reported by Microsoft status."
            ),
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"MICROSOFT_STORE_SUBMISSION=PASS id={submission_id} status={status or 'CommitStarted'}")
        return 0
    except Exception:
        if not committed:
            try:
                request_json(f"{base}/{urllib.parse.quote(submission_id)}", "DELETE", token)
            except Exception as cleanup_error:
                print(f"warning: failed to delete uncommitted Partner Center submission: {cleanup_error}", file=sys.stderr)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
