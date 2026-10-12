#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools-DeveloperID.app}"
NOTARY_RECEIPT="${2:-bobfwtools-notarization-receipt.json}"
OUTPUT_PATH="${3:-bobfwtools-release-receipt.json}"
SOURCE_REVISION="${BOBFWTOOLS_SOURCE_REVISION:-${GITHUB_SHA:-}}"
RELEASE_LABEL="${BOBFWTOOLS_RELEASE_LABEL:-manual}"

fail() {
  echo "BobFWTools release receipt failed: $*" >&2
  exit 1
}

[[ -d "$APP_PATH" ]] || fail "app not found: $APP_PATH"
[[ -f "$NOTARY_RECEIPT" ]] || fail "notarization receipt not found: $NOTARY_RECEIPT"
[[ -n "$SOURCE_REVISION" ]] || fail "source revision is unavailable"

BIN="$APP_PATH/Contents/MacOS/bobfwtools"
PLIST="$APP_PATH/Contents/Info.plist"
[[ -f "$BIN" ]] || fail "BobFWTools executable is missing"
[[ -f "$PLIST" ]] || fail "Info.plist is missing"

codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1 || fail "codesign verification failed"
xcrun stapler validate "$APP_PATH" >/dev/null 2>&1 || fail "stapler validation failed"
spctl -a -vv --type execute "$APP_PATH" >/dev/null 2>&1 || fail "Gatekeeper assessment failed"

SIGNATURE_DETAILS="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)"
AUTHORITY="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^Authority=Developer ID Application/ {print substr($0,index($0,"=")+1); exit}')"
TEAM_ID="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^TeamIdentifier=/ {print $2; exit}')"
IDENTIFIER="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^Identifier=/ {print $2; exit}')"
[[ -n "$AUTHORITY" ]] || fail "Developer ID Application authority is missing"
[[ -n "$TEAM_ID" ]] || fail "TeamIdentifier is missing"
[[ -n "$IDENTIFIER" ]] || fail "bundle signing identifier is missing"

ARCHITECTURES="$(lipo -archs "$BIN")"
BIN_SHA256="$(shasum -a 256 "$BIN" | awk '{print $1}')"
PLIST_SHA256="$(shasum -a 256 "$PLIST" | awk '{print $1}')"
NOTARY_SHA256="$(shasum -a 256 "$NOTARY_RECEIPT" | awk '{print $1}')"

python3 - "$NOTARY_RECEIPT" "$OUTPUT_PATH" "$SOURCE_REVISION" "$RELEASE_LABEL" "$BIN_SHA256" "$PLIST_SHA256" "$NOTARY_SHA256" "$ARCHITECTURES" "$AUTHORITY" "$TEAM_ID" "$IDENTIFIER" <<'PY'
import json, sys
(
    notary_path,
    output_path,
    source_revision,
    release_label,
    binary_sha256,
    plist_sha256,
    notary_sha256,
    architectures,
    authority,
    team_id,
    identifier,
) = sys.argv[1:]

with open(notary_path, "r", encoding="utf-8") as f:
    notary = json.load(f)

status = notary.get("status")
submission_id = notary.get("id")
if status != "Accepted":
    raise SystemExit(f"Notarization receipt status is {status!r}, expected 'Accepted'")
if not submission_id:
    raise SystemExit("Notarization receipt is missing submission id")

receipt = {
    "schema": "com.bobbyblanco.bobfwtools.release-receipt.v1",
    "product": "BobFWTools",
    "releaseLabel": release_label,
    "sourceRevision": source_revision,
    "qualifiedDestructiveWriterIncluded": False,
    "architectures": architectures.split(),
    "signing": {
        "authority": authority,
        "teamIdentifier": team_id,
        "identifier": identifier,
        "hardenedRuntimeRequired": True,
    },
    "notarization": {
        "status": status,
        "submissionId": submission_id,
        "receiptSha256": notary_sha256,
        "ticketStapledAndValidated": True,
        "gatekeeperAccepted": True,
    },
    "artifacts": {
        "executableSha256": binary_sha256,
        "infoPlistSha256": plist_sha256,
    },
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(receipt, f, indent=2, sort_keys=True)
    f.write("\n")
PY

echo "BobFWTools release receipt: PASS"
echo "receipt=$OUTPUT_PATH"
echo "source_revision=$SOURCE_REVISION"
echo "architectures=$ARCHITECTURES"
