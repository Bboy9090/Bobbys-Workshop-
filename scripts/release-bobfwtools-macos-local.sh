#!/usr/bin/env bash
set -euo pipefail
LABEL="${1:-}"
PROFILE="${BOBFW_NOTARY_PROFILE:-BobFWTools}"
TEAM_ID="${BOBFW_EXPECTED_TEAM_ID:-86NUJ8M3B8}"
IDENTITY="${BOBFW_DEVELOPER_IDENTITY:-}"
CHECK_ONLY="${BOBFW_RELEASE_CHECK_ONLY:-0}"
SKIP_BUILD="${BOBFW_SKIP_BUILD:-0}"
fail(){ echo "BobFWTools local macOS release failed: $*" >&2; exit 1; }
[[ "$LABEL" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || fail "release label must be 1-64 characters using letters, numbers, dot, underscore, or hyphen"
[[ "$(uname -s)" == "Darwin" ]] || fail "local release must run on macOS"
command -v xcrun >/dev/null || fail "xcrun is unavailable"
command -v security >/dev/null || fail "security tool is unavailable"
if [[ -z "$IDENTITY" ]]; then
  MATCHES="$(security find-identity -v -p codesigning 2>/dev/null | sed -nE 's/.*"(Developer ID Application: .+ \('"$TEAM_ID"'\))".*/\1/p')"
  MATCH_COUNT="$(printf '%s\n' "$MATCHES" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "$MATCH_COUNT" == "1" ]] || fail "expected exactly one Developer ID Application identity for team $TEAM_ID; found $MATCH_COUNT"
  IDENTITY="$(printf '%s\n' "$MATCHES" | sed -n '1p')"
fi
security find-identity -v -p codesigning | grep -F "$IDENTITY" >/dev/null || fail "Developer ID identity is unavailable"
if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  fail "notarytool keychain profile '$PROFILE' is unavailable; configure it with scripts/configure-bobfwtools-notary-profile.sh"
fi
echo "BobFWTools local release prerequisites: PASS"
echo "profile=$PROFILE"
echo "team_id=$TEAM_ID"
echo "identity=$IDENTITY"
[[ "$CHECK_ONLY" == "1" ]] && exit 0
if [[ "$SKIP_BUILD" != "1" ]]; then
  npm ci
  npm run verify:reality
  npm run typecheck
  npm run build
  npm test
  npm run test:workflows
  npm run tauri:build:macos:ci
fi
APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app"
SIGNED="src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools-DeveloperID.app"
OUT="${BOBFW_RELEASE_OUT:-$PWD/release-local/$LABEL}"
mkdir -p "$OUT"
bash scripts/verify-bobfwtools-macos-release-preflight.sh "$APP" "$(git rev-parse HEAD)"
BOBFW_DEVELOPER_IDENTITY="$IDENTITY" BOBFW_EXPECTED_TEAM_ID="$TEAM_ID" \
  bash scripts/sign-bobfwtools-developer-id.sh "$APP" "$SIGNED"
APP_ZIP="$OUT/BobFWTools-$LABEL-universal-macOS-notarization.zip"
APP_NOTARY="$OUT/APP-NOTARIZATION.json"
ditto -c -k --keepParent "$SIGNED" "$APP_ZIP"
xcrun notarytool submit "$APP_ZIP" --keychain-profile "$PROFILE" --wait --output-format json > "$APP_NOTARY"
python3 - "$APP_NOTARY" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
if r.get('status')!='Accepted' or not r.get('id'):
    raise SystemExit(f"app notarization not accepted: status={r.get('status')!r} id={r.get('id')!r}")
print(f"app_notary_id={r['id']}")
PY
xcrun stapler staple "$SIGNED"
xcrun stapler validate "$SIGNED"
spctl --assess --type execute --verbose=4 "$SIGNED"
DMG="$OUT/BobFWTools-$LABEL-universal-macOS.dmg"
hdiutil create -volname "BobFWTools" -srcfolder "$SIGNED" -ov -format UDZO "$DMG"
DMG_NOTARY="$OUT/DMG-NOTARIZATION.json"
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait --output-format json > "$DMG_NOTARY"
python3 - "$DMG_NOTARY" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
if r.get('status')!='Accepted' or not r.get('id'):
    raise SystemExit(f"DMG notarization not accepted: status={r.get('status')!r} id={r.get('id')!r}")
print(f"dmg_notary_id={r['id']}")
PY
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG"
APP_ARCHIVE="$OUT/BobFWTools-$LABEL-universal-macOS.app.zip"
ditto -c -k --keepParent "$SIGNED" "$APP_ARCHIVE"
export BOBFWTOOLS_SOURCE_REVISION="$(git rev-parse HEAD)"
export BOBFWTOOLS_RELEASE_LABEL="$LABEL"
bash scripts/create-bobfwtools-release-receipt.sh "$SIGNED" "$DMG" "$APP_NOTARY" "$DMG_NOTARY" "$OUT/RELEASE-RECEIPT.json"
(cd "$OUT" && shasum -a 256 *.dmg *.zip APP-NOTARIZATION.json DMG-NOTARIZATION.json RELEASE-RECEIPT.json > SHA256SUMS.txt)
echo "BobFWTools local signed/notarized release: PASS"
echo "output=$OUT"
