#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"
OUTPUT_PATH="${2:-APP-STORE-ARCHIVE-RECEIPT.json}"
EXPECTED_BUNDLE="${BOBFW_EXPECTED_BUNDLE_ID:-com.bobbyblanco.bobfwtools}"
EXPECTED_TEAM="${BOBFW_EXPECTED_TEAM_ID:-${APPLE_TEAM_ID:-}}"

fail() {
  echo "BobFWTools App Store archive receipt: FAIL — $*" >&2
  exit 1
}

[[ "$(uname -s)" == "Darwin" ]] || fail "macOS is required"
[[ -d "$APP_PATH" ]] || fail "app bundle not found: $APP_PATH"
[[ -n "$EXPECTED_TEAM" ]] || fail "BOBFW_EXPECTED_TEAM_ID or APPLE_TEAM_ID is required"
[[ ! -e "$OUTPUT_PATH" && ! -L "$OUTPUT_PATH" ]] || fail "receipt destination already exists"

PLIST="$APP_PATH/Contents/Info.plist"
BIN="$APP_PATH/Contents/MacOS/bobfwtools"
PROFILE="$APP_PATH/Contents/embedded.provisionprofile"
[[ -f "$PLIST" ]] || fail "Info.plist is missing"
[[ -f "$BIN" ]] || fail "main executable is missing"
[[ -f "$PROFILE" ]] || fail "embedded.provisionprofile is missing"

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")"
[[ "$BUNDLE_ID" == "$EXPECTED_BUNDLE" ]] || fail "unexpected bundle id: $BUNDLE_ID"

bash scripts/verify-bobfwtools-mac-app-store-profile.sh "$PROFILE"

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
DETAILS="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)"
TEAM_ID="$(printf '%s\n' "$DETAILS" | awk -F= '/^TeamIdentifier=/ {print $2; exit}')"
IDENTIFIER="$(printf '%s\n' "$DETAILS" | awk -F= '/^Identifier=/ {print $2; exit}')"
AUTHORITY="$(printf '%s\n' "$DETAILS" | awk -F= '/^Authority=/ {print substr($0,index($0,"=")+1); exit}')"

[[ "$TEAM_ID" == "$EXPECTED_TEAM" ]] || fail "signature TeamIdentifier mismatch"
[[ "$IDENTIFIER" == "$EXPECTED_BUNDLE" ]] || fail "signature identifier mismatch"
[[ "$AUTHORITY" == *"Apple Distribution"* || "$AUTHORITY" == *"3rd Party Mac Developer Application"* ]] || fail "App Store distribution authority not detected"

ENTITLEMENTS_JSON="$(mktemp)"
trap 'rm -f "$ENTITLEMENTS_JSON"' EXIT
codesign -d --entitlements :- "$APP_PATH" > "$ENTITLEMENTS_JSON" 2>/dev/null || fail "unable to read signed entitlements"
for key in   com.apple.security.app-sandbox   com.apple.security.device.usb   com.apple.security.files.user-selected.read-write
do
  /usr/libexec/PlistBuddy -c "Print :$key" "$ENTITLEMENTS_JSON" 2>/dev/null | grep -Eq '^(true|1)$' || fail "missing signed entitlement: $key"
done

ARCHS="$(lipo -archs "$BIN")"
[[ " $ARCHS " == *" x86_64 "* && " $ARCHS " == *" arm64 "* ]] || fail "App Store candidate is not universal"

APP_SHA256="$(ditto -c -k --keepParent "$APP_PATH" "$TMPDIR/BobFWTools-appstore-candidate.zip" >/dev/null 2>&1; shasum -a 256 "$TMPDIR/BobFWTools-appstore-candidate.zip" | awk '{print $1}')"
BIN_SHA256="$(shasum -a 256 "$BIN" | awk '{print $1}')"
PLIST_SHA256="$(shasum -a 256 "$PLIST" | awk '{print $1}')"
PROFILE_SHA256="$(shasum -a 256 "$PROFILE" | awk '{print $1}')"

python3 - "$OUTPUT_PATH" "$EXPECTED_BUNDLE" "$EXPECTED_TEAM" "$VERSION" "$BUILD" "$ARCHS" "$AUTHORITY" "$APP_SHA256" "$BIN_SHA256" "$PLIST_SHA256" "$PROFILE_SHA256" <<'PY'
import json, sys
(
  output, bundle_id, team_id, version, build, archs, authority,
  app_sha256, binary_sha256, plist_sha256, profile_sha256
)=sys.argv[1:]
receipt={
  "schema":"com.bobbyblanco.bobfwtools.app-store-archive-receipt.v1",
  "product":"BobFWTools",
  "distribution":"mac-app-store",
  "bundleId":bundle_id,
  "teamId":team_id,
  "version":version,
  "build":build,
  "architectures":archs.split(),
  "signingAuthority":authority,
  "embeddedProvisioningProfile":True,
  "sandboxEntitlementsVerified":True,
  "appStoreReady":False,
  "scope":"Archive/signing/profile evidence only; App Store Connect upload/review not proven",
  "artifacts":{
    "appZipSha256":app_sha256,
    "binarySha256":binary_sha256,
    "infoPlistSha256":plist_sha256,
    "provisioningProfileSha256":profile_sha256,
  },
}
with open(output,"w",encoding="utf-8") as f:
  json.dump(receipt,f,indent=2,sort_keys=True)
  f.write("\n")
PY

echo "BobFWTools App Store archive receipt: PASS"
echo "receipt=$OUTPUT_PATH"
