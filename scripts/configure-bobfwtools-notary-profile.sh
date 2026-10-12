#!/usr/bin/env bash
set -euo pipefail
PROFILE="${1:-BobFWTools}"
APPLE_ID_VALUE="${BOBFW_APPLE_ID:-}"
APP_PASSWORD="${BOBFW_APP_SPECIFIC_PASSWORD:-}"
TEAM_ID="${BOBFW_EXPECTED_TEAM_ID:-86NUJ8M3B8}"
fail(){ echo "BobFWTools notary profile setup failed: $*" >&2; exit 1; }
[[ -n "$APPLE_ID_VALUE" ]] || fail "BOBFW_APPLE_ID is not set"
[[ -n "$APP_PASSWORD" ]] || fail "BOBFW_APP_SPECIFIC_PASSWORD is not set"
[[ -n "$TEAM_ID" ]] || fail "BOBFW_EXPECTED_TEAM_ID is not set"
xcrun notarytool store-credentials "$PROFILE" \
  --apple-id "$APPLE_ID_VALUE" \
  --team-id "$TEAM_ID" \
  --password "$APP_PASSWORD"
xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null
echo "BobFWTools notarization profile: PASS"
echo "profile=$PROFILE"
echo "team_id=$TEAM_ID"
