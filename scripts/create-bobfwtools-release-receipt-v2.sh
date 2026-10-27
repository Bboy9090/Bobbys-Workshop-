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
[[ "$SOURCE_REVISION" =~ ^[a-f0-9]{40}$ ]] || fail "a full lowercase source SHA is required"
[[ -n "$RELEASE_LABEL" ]] || fail "release label is unavailable"
[[ ! -e "$OUTPUT_PATH" && ! -L "$OUTPUT_PATH" ]] || fail "receipt destination already exists"

BIN="$APP_PATH/Contents/MacOS/bobfwtools"
PLIST="$APP_PATH/Contents/Info.plist"
[[ -f "$BIN" ]] || fail "BobFWTools executable is missing"
[[ -f "$PLIST" ]] || fail "Info.plist is missing"

python3 - "$BIN" "$SOURCE_REVISION" "$APP_NOTARY_JSON" "$DMG_NOTARY_JSON" <<'PY'
import json, pathlib, sys
binary = pathlib.Path(sys.argv[1]).read_bytes()
if sys.argv[2].encode() not in binary:
    raise SystemExit("Release executable does not contain the expected source SHA")
for marker in (b"bootforge_qualified_fastboot_devices", b"issue-qualified-flash-grant"):
    if marker in binary:
        raise SystemExit("Public release contains a qualified destructive executor marker")
for path in sys.argv[3:]:
    receipt = json.loads(pathlib.Path(path).read_text())
    if receipt.get("status") != "Accepted" or not isinstance(receipt.get("id"), str) or not receipt["id"].strip():
        raise SystemExit("Notarization is not accepted with a nonempty submission id")
PY

codesign --verify --strict "$DMG_PATH" >/dev/null 2>&1 || fail "DMG codesign verification failed"
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
[[ "$IDENTIFIER" == com.bobbyblanco.bobfwtools ]] || fail "unexpected signing identifier"
EXPECTED_TEAM="${BOBFW_EXPECTED_TEAM_ID:-${APPLE_TEAM_ID:-}}"
[[ -n "$EXPECTED_TEAM" && "$TEAM_ID" == "$EXPECTED_TEAM" ]] || fail "release signing team does not match the expected Apple team"
printf '%s\n' "$SIGNATURE_DETAILS" | grep -E 'flags=.*[(,]runtime[),]' >/dev/null || fail "hardened runtime is missing"
TIMESTAMP="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^Timestamp=/ {print substr($0,index($0,"=")+1); exit}')"
case "$TIMESTAMP" in
  ''|[Nn][Oo][Nn][Ee]|[Uu][Nn][Aa][Vv][Aa][Ii][Ll][Aa][Bb][Ll][Ee]) fail "secure signing timestamp is missing" ;;
esac
DMG_DETAILS="$(codesign -dv --verbose=4 "$DMG_PATH" 2>&1)"
DMG_TEAM="$(printf '%s\n' "$DMG_DETAILS" | awk -F= '/^TeamIdentifier=/ {print $2; exit}')"
[[ "$DMG_TEAM" == "$TEAM_ID" ]] || fail "DMG signing team differs from the app"
printf '%s\n' "$DMG_DETAILS" | grep -F 'Authority=Developer ID Application' >/dev/null || fail "DMG Developer ID authority is missing"

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
    "scope": "Signed app and DMG artifact checks; no native GUI or device qualification",
    "hardwareQualified": False,
    "executionAuthorized": False,
    "releaseQualified": False,
    "nativeGuiStatus": "NOT TESTED",
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
