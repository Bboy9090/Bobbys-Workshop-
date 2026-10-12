#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"
DMG_PATH="${2:-}"
APP_NOTARY_JSON="${3:-}"
DMG_NOTARY_JSON="${4:-}"
OUTPUT_PATH="${5:-RELEASE-RECEIPT.json}"
SOURCE_REVISION="${BOBFWTOOLS_SOURCE_REVISION:-${GITHUB_SHA:-}}"
RELEASE_LABEL="${BOBFWTOOLS_RELEASE_LABEL:-}"

fail() {
  echo "BobFWTools release receipt failed: $*" >&2
  exit 1
}

[[ -d "$APP_PATH" ]] || fail "app not found: $APP_PATH"
[[ -f "$DMG_PATH" ]] || fail "DMG not found: $DMG_PATH"
[[ -f "$APP_NOTARY_JSON" ]] || fail "app notarization receipt not found"
[[ -f "$DMG_NOTARY_JSON" ]] || fail "DMG notarization receipt not found"
[[ -n "$SOURCE_REVISION" ]] || fail "source revision is unavailable"
[[ -n "$RELEASE_LABEL" ]] || fail "release label is unavailable"

BIN="$APP_PATH/Contents/MacOS/bobfwtools"
PLIST="$APP_PATH/Contents/Info.plist"
[[ -f "$BIN" ]] || fail "BobFWTools executable is missing"
[[ -f "$PLIST" ]] || fail "Info.plist is missing"

codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1 || fail "codesign verification failed"
xcrun stapler validate "$APP_PATH" >/dev/null 2>&1 || fail "app stapler validation failed"
xcrun stapler validate "$DMG_PATH" >/dev/null 2>&1 || fail "DMG stapler validation failed"
spctl --assess --type execute --verbose=4 "$APP_PATH" >/dev/null 2>&1 || fail "Gatekeeper rejected app"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH" >/dev/null 2>&1 || fail "Gatekeeper rejected DMG"

SIGNATURE_DETAILS="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)"
AUTHORITY="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^Authority=Developer ID Application/ {print substr($0,index($0,"=")+1); exit}')"
TEAM_ID="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^TeamIdentifier=/ {print $2; exit}')"
IDENTIFIER="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^Identifier=/ {print $2; exit}')"
[[ -n "$AUTHORITY" ]] || fail "Developer ID Application authority is missing"
[[ -n "$TEAM_ID" ]] || fail "TeamIdentifier is missing"
[[ -n "$IDENTIFIER" ]] || fail "signing identifier is missing"

ARCHS="$(lipo -archs "$BIN")"
[[ " $ARCHS " == *" x86_64 "* && " $ARCHS " == *" arm64 "* ]] || fail "release executable is not universal"

BIN_SHA256="$(shasum -a 256 "$BIN" | awk '{print $1}')"
PLIST_SHA256="$(shasum -a 256 "$PLIST" | awk '{print $1}')"
DMG_SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
APP_NOTARY_SHA256="$(shasum -a 256 "$APP_NOTARY_JSON" | awk '{print $1}')"
DMG_NOTARY_SHA256="$(shasum -a 256 "$DMG_NOTARY_JSON" | awk '{print $1}')"

python3 - "$APP_NOTARY_JSON" "$DMG_NOTARY_JSON" "$OUTPUT_PATH" "$SOURCE_REVISION" "$RELEASE_LABEL" "$BIN_SHA256" "$PLIST_SHA256" "$DMG_SHA256" "$APP_NOTARY_SHA256" "$DMG_NOTARY_SHA256" "$ARCHS" "$AUTHORITY" "$TEAM_ID" "$IDENTIFIER" <<'PY'
import json, sys
(
    app_notary_path, dmg_notary_path, output_path, source_revision, release_label,
    binary_sha256, plist_sha256, dmg_sha256, app_notary_sha256, dmg_notary_sha256,
    architectures, authority, team_id, identifier
) = sys.argv[1:]

with open(app_notary_path, encoding='utf-8') as f:
    app_notary = json.load(f)
with open(dmg_notary_path, encoding='utf-8') as f:
    dmg_notary = json.load(f)

for name, receipt in [('app', app_notary), ('dmg', dmg_notary)]:
    if receipt.get('status') != 'Accepted' or not receipt.get('id'):
        raise SystemExit(f"{name} notarization is not accepted with a submission id")

receipt = {
    "schema": "com.bobbyblanco.bobfwtools.release-receipt.v2",
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
        "app": {
            "status": app_notary["status"],
            "submissionId": app_notary["id"],
            "receiptSha256": app_notary_sha256,
            "ticketStapledAndValidated": True,
            "gatekeeperAccepted": True,
        },
        "dmg": {
            "status": dmg_notary["status"],
            "submissionId": dmg_notary["id"],
            "receiptSha256": dmg_notary_sha256,
            "ticketStapledAndValidated": True,
            "gatekeeperAccepted": True,
        },
    },
    "artifacts": {
        "executableSha256": binary_sha256,
        "infoPlistSha256": plist_sha256,
        "dmgSha256": dmg_sha256,
    },
}
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(receipt, f, indent=2, sort_keys=True)
    f.write('\n')
PY

echo "BobFWTools JSON release receipt: PASS"
echo "receipt=$OUTPUT_PATH"
