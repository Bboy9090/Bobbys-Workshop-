#!/usr/bin/env bash
set -euo pipefail

SOURCE_APP="${1:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app}"
OUTPUT_APP="${2:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools-DeveloperID.app}"
IDENTITY="${BOBFW_DEVELOPER_IDENTITY:-}"
EXPECTED_TEAM_ID="${BOBFW_EXPECTED_TEAM_ID:-}"

fail() {
  echo "BobFWTools Developer ID signing failed: $*" >&2
  exit 1
}

[[ -d "$SOURCE_APP" ]] || fail "source app not found: $SOURCE_APP"
[[ -n "$IDENTITY" ]] || fail "BOBFW_DEVELOPER_IDENTITY is not set"
security find-identity -v -p codesigning | grep -F "$IDENTITY" >/dev/null || fail "requested signing identity is not available"

[[ ! -e "$OUTPUT_APP" && ! -L "$OUTPUT_APP" ]] || fail "output app must be a new isolated path"
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

SIGNATURE_DETAILS="$(codesign -dv --verbose=4 "$OUTPUT_APP" 2>&1)"
TEAM_ID="$(printf '%s\n' "$SIGNATURE_DETAILS" | awk -F= '/^TeamIdentifier=/ {print $2; exit}')"
[[ -n "$TEAM_ID" ]] || fail "signed app is missing TeamIdentifier"
if [[ -n "$EXPECTED_TEAM_ID" && "$TEAM_ID" != "$EXPECTED_TEAM_ID" ]]; then
  fail "Developer ID TeamIdentifier does not match the expected Apple team"
fi

echo "Developer ID signing: PASS"
echo "team_id=$TEAM_ID"
echo "output=$OUTPUT_APP"
