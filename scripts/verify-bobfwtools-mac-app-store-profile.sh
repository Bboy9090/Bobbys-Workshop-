#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-}"
ENTITLEMENTS="${2:-src-tauri/entitlements.mac.plist}"
EXPECTED_BUNDLE="${BOBFW_EXPECTED_BUNDLE_ID:-com.bobbyblanco.bobfwtools}"
EXPECTED_TEAM="${BOBFW_EXPECTED_TEAM_ID:-${APPLE_TEAM_ID:-}}"

fail() {
  echo "BobFWTools Mac App Store profile preflight: FAIL — $*" >&2
  exit 1
}

[[ "$(uname -s)" == "Darwin" ]] || fail "macOS is required to decode Apple provisioning profiles"
command -v security >/dev/null || fail "security tool is unavailable"
[[ -x /usr/libexec/PlistBuddy ]] || fail "PlistBuddy is unavailable"
[[ -n "$PROFILE" && -f "$PROFILE" ]] || fail "provisioning profile path is required"
[[ -f "$ENTITLEMENTS" ]] || fail "shipping entitlements plist not found: $ENTITLEMENTS"
[[ -n "$EXPECTED_TEAM" ]] || fail "BOBFW_EXPECTED_TEAM_ID or APPLE_TEAM_ID is required"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
DECODED="$TMP/profile.plist"

security cms -D -i "$PROFILE" > "$DECODED" 2>/dev/null || fail "profile could not be decoded"

read_plist() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$DECODED" 2>/dev/null || true
}

NAME="$(read_plist Name)"
UUID="$(read_plist UUID)"
EXPIRATION="$(read_plist ExpirationDate)"
TEAM="$(read_plist TeamIdentifier:0)"
GET_TASK_ALLOW="$(read_plist Entitlements:get-task-allow)"
APP_IDENTIFIER="$(read_plist Entitlements:com.apple.application-identifier)"
[[ -n "$APP_IDENTIFIER" ]] || APP_IDENTIFIER="$(read_plist Entitlements:application-identifier)"
PROVISIONS_ALL="$(read_plist ProvisionsAllDevices)"

[[ -n "$NAME" ]] || fail "profile Name is missing"
[[ -n "$UUID" ]] || fail "profile UUID is missing"
[[ -n "$EXPIRATION" ]] || fail "profile expiration is missing"
[[ "$TEAM" == "$EXPECTED_TEAM" ]] || fail "profile team '$TEAM' does not match expected team '$EXPECTED_TEAM'"
[[ "$GET_TASK_ALLOW" != "true" && "$GET_TASK_ALLOW" != "1" ]] || fail "development profile rejected because get-task-allow is enabled"
[[ "$PROVISIONS_ALL" != "true" && "$PROVISIONS_ALL" != "1" ]] || fail "Developer ID / all-devices profile rejected for Mac App Store lane"

EXPECTED_APP_ID="$EXPECTED_TEAM.$EXPECTED_BUNDLE"
[[ "$APP_IDENTIFIER" == "$EXPECTED_APP_ID" ]] || fail "profile application identifier '$APP_IDENTIFIER' does not match '$EXPECTED_APP_ID'"

if /usr/libexec/PlistBuddy -c "Print :ProvisionedDevices" "$DECODED" >/dev/null 2>&1; then
  fail "development/ad-hoc profile rejected because ProvisionedDevices is present"
fi

python3 - "$EXPIRATION" <<'PY' || exit 1
from datetime import datetime, timezone
import sys
raw=sys.argv[1].strip()
formats=(
    ("%Y-%m-%d %H:%M:%S +0000", raw),
    ("%Y-%m-%dT%H:%M:%SZ", raw),
    ("%a %b %d %H:%M:%S UTC %Y", raw),
)
parsed=None
for fmt, candidate in formats:
    try:
        parsed=datetime.strptime(candidate,fmt).replace(tzinfo=timezone.utc)
        break
    except ValueError:
        pass
if parsed is None:
    raise SystemExit(f"BobFWTools Mac App Store profile preflight: FAIL — unrecognized expiration date: {raw}")
if parsed <= datetime.now(timezone.utc):
    raise SystemExit("BobFWTools Mac App Store profile preflight: FAIL — provisioning profile is expired")
PY

for entitlement in   com.apple.security.app-sandbox   com.apple.security.device.usb   com.apple.security.files.user-selected.read-write
do
  value="$(/usr/libexec/PlistBuddy -c "Print :$entitlement" "$ENTITLEMENTS" 2>/dev/null || true)"
  [[ "$value" == "true" || "$value" == "1" ]] || fail "required shipping entitlement is not enabled: $entitlement"
done

echo "BobFWTools Mac App Store profile preflight: PASS"
echo "profile_name=$NAME"
echo "profile_uuid=$UUID"
echo "team_id=$TEAM"
echo "bundle_id=$EXPECTED_BUNDLE"
echo "expiration=$EXPIRATION"
