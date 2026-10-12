#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools-DeveloperID.app}"
RECEIPT_PATH="${2:-bobfwtools-notarization-receipt.json}"

fail() {
  echo "BobFWTools notarization failed: $*" >&2
  exit 1
}

: "${APPLE_ID:?APPLE_ID is required}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?APPLE_APP_SPECIFIC_PASSWORD is required}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required}"

[[ -d "$APP_PATH" ]] || fail "signed app not found: $APP_PATH"

codesign --verify --deep --strict --verbose=2 "$APP_PATH" || fail "codesign verification failed before notarization"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
ZIP_PATH="$WORK_DIR/BobFWTools-notarization.zip"

ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

xcrun notarytool submit "$ZIP_PATH"   --apple-id "$APPLE_ID"   --password "$APPLE_APP_SPECIFIC_PASSWORD"   --team-id "$APPLE_TEAM_ID"   --wait   --output-format json > "$RECEIPT_PATH"

STATUS="$(python3 - "$RECEIPT_PATH" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
print(data.get("status", ""))
PY
)"

[[ "$STATUS" == "Accepted" ]] || fail "Apple notarization status was '$STATUS', expected 'Accepted'"

xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
spctl -a -vv --type execute "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

SUBMISSION_ID="$(python3 - "$RECEIPT_PATH" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
print(data.get("id", ""))
PY
)"

echo "BobFWTools notarization: PASS"
echo "status=$STATUS"
echo "submission_id=$SUBMISSION_ID"
echo "receipt=$RECEIPT_PATH"
echo "app=$APP_PATH"
