#!/usr/bin/env bash
set -euo pipefail
PROFILE="${1:-BobFWTools}"
APPLE_ID_VALUE="${BOBFW_APPLE_ID:-}"
APP_PASSWORD="${BOBFW_APP_SPECIFIC_PASSWORD:-}"
TEAM_ID="${BOBFW_EXPECTED_TEAM_ID:-86NUJ8M3B8}"
API_KEY_PATH="${BOBFW_NOTARY_KEY_PATH:-}"
API_KEY_ID="${BOBFW_NOTARY_KEY_ID:-}"
API_ISSUER_ID="${BOBFW_NOTARY_ISSUER_ID:-}"
fail(){ echo "BobFWTools notary profile setup failed: $*" >&2; exit 1; }
[[ -n "$TEAM_ID" ]] || fail "BOBFW_EXPECTED_TEAM_ID is not set"

if [[ -n "$API_KEY_PATH" || -n "$API_KEY_ID" || -n "$API_ISSUER_ID" ]]; then
  [[ -f "$API_KEY_PATH" ]] || fail "BOBFW_NOTARY_KEY_PATH does not point to an App Store Connect .p8 key"
  [[ -n "$API_KEY_ID" ]] || fail "BOBFW_NOTARY_KEY_ID is not set"
  [[ -n "$API_ISSUER_ID" ]] || fail "BOBFW_NOTARY_ISSUER_ID is not set"
  xcrun notarytool store-credentials "$PROFILE" \
    --key "$API_KEY_PATH" \
    --key-id "$API_KEY_ID" \
    --issuer "$API_ISSUER_ID"
  AUTH_MODE="app-store-connect-api-key"
else
  [[ -n "$APPLE_ID_VALUE" ]] || fail "set BOBFW_APPLE_ID and BOBFW_APP_SPECIFIC_PASSWORD, or provide the App Store Connect API-key variables"
  [[ -n "$APP_PASSWORD" ]] || fail "BOBFW_APP_SPECIFIC_PASSWORD is not set"
  xcrun notarytool store-credentials "$PROFILE" \
    --apple-id "$APPLE_ID_VALUE" \
    --team-id "$TEAM_ID" \
    --password "$APP_PASSWORD"
  AUTH_MODE="apple-id"
fi

xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null
echo "BobFWTools notarization profile: PASS"
echo "profile=$PROFILE"
echo "team_id=$TEAM_ID"
echo "auth_mode=$AUTH_MODE"
