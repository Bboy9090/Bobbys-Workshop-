#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app}"
EXPECTED_SOURCE_SHA="${2:-${GITHUB_SHA:-}}"
BIN="$APP_PATH/Contents/MacOS/bobfwtools"
PLIST="$APP_PATH/Contents/Info.plist"
ENTITLEMENTS="src-tauri/entitlements.mac.plist"

fail() {
  echo "BobFWTools macOS signed-release preflight failed: $*" >&2
  exit 1
}

bash scripts/verify-bobfwtools-macos-app.sh "$APP_PATH"

[[ -f "$ENTITLEMENTS" ]] || fail "macOS entitlements file is missing"
plutil -lint "$ENTITLEMENTS" >/dev/null

[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")" == "com.bobbyblanco.bobfwtools" ]]   || fail "release bundle identifier drifted"

ARCHS="$(lipo -archs "$BIN")"
[[ " $ARCHS " == *" x86_64 "* && " $ARCHS " == *" arm64 "* ]]   || fail "release executable must contain both x86_64 and arm64"

if strings "$BIN" | grep -Fq "bootforge_qualified_fastboot_devices"; then
  fail "normal release unexpectedly contains the qualified destructive executor"
fi

if strings "$BIN" | grep -Fq "issue-qualified-flash-grant"; then
  fail "normal release unexpectedly contains qualified-flash grant issuance"
fi

# The normal non-qualified application does not claim an embedded source-SHA
# binding. Source provenance is recorded in the workflow release receipt
# instead of pretending the executable contains evidence it does not.
DETAILS="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1 || true)"
if printf '%s\n' "$DETAILS" | grep -q '^Authority='; then
  fail "pre-sign release bundle unexpectedly has an identity-backed signature"
fi

echo "BobFWTools signed-release preflight: PASS"
echo "bundle_id=com.bobbyblanco.bobfwtools"
echo "architectures=$ARCHS"
echo "qualified_destructive_feature=false"
echo "workflow_source_revision=${EXPECTED_SOURCE_SHA:-unavailable}"
