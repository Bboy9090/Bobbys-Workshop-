#!/usr/bin/env bash
set -euo pipefail

SOURCE_APP="${1:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app}"
OUTPUT_APP="${2:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools-DeveloperID.app}"
IDENTITY="${BOBFW_DEVELOPER_IDENTITY:-}"

fail() {
  echo "BobFWTools Developer ID signing failed: $*" >&2
  exit 1
}

[[ -d "$SOURCE_APP" ]] || fail "source app not found: $SOURCE_APP"
[[ -n "$IDENTITY" ]] || fail "BOBFW_DEVELOPER_IDENTITY is not set"
security find-identity -v -p codesigning | grep -F "$IDENTITY" >/dev/null || fail "requested signing identity is not available"

rm -rf "$OUTPUT_APP"
ditto "$SOURCE_APP" "$OUTPUT_APP"

codesign \
  --force \
  --deep \
  --options runtime \
  --timestamp \
  --entitlements src-tauri/entitlements.mac.plist \
  --sign "$IDENTITY" \
  "$OUTPUT_APP"

codesign --verify --deep --strict --verbose=2 "$OUTPUT_APP"
bash scripts/verify-bobfwtools-macos-app.sh "$OUTPUT_APP"

echo "Developer ID signing: PASS"
echo "output=$OUTPUT_APP"
