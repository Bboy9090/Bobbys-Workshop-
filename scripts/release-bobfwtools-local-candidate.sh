#!/usr/bin/env bash
set -euo pipefail
# Credential-backed candidate production on an authorized Mac. Credentials remain
# in the existing Keychain; this script never exports or reconfigures them.
LABEL="${1:-}"
OUT="${2:-}"
APP="${3:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app}"
PROFILE="${BOBFW_NOTARY_PROFILE:-BobFWTools}"
TEAM="${BOBFW_EXPECTED_TEAM_ID:-86NUJ8M3B8}"
REVISION="${BOBFWTOOLS_SOURCE_REVISION:-}"
fail() { echo "Local release candidate refused: $*" >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || fail "macOS required"
[[ "$LABEL" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || fail "invalid label"
[[ "$REVISION" =~ ^[a-f0-9]{40}$ && "$(git rev-parse HEAD)" == "$REVISION" ]] || fail "full source SHA must equal checkout HEAD"
git diff --exit-code HEAD -- >/dev/null || fail "tracked source changes present"
[[ -n "$OUT" && ! -e "$OUT" && ! -L "$OUT" ]] || fail "new isolated output directory required"
[[ -d "$APP" && ! -L "$APP" ]] || fail "standard unsigned source app required"
IDENTITIES="$(security find-identity -v -p codesigning | sed -nE 's/.*"(Developer ID Application: .+ \('"$TEAM"'\))".*/\1/p')"
COUNT="$(printf '%s\n' "$IDENTITIES" | sed '/^$/d' | wc -l | tr -d ' ')"
[[ "$COUNT" == 1 ]] || fail "expected one Developer ID identity for the configured team"
xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1 || fail "saved notarization profile is unavailable"
bash scripts/verify-bobfwtools-macos-app.sh "$APP"
mkdir -p "$OUT/staging"
OUT="$(cd "$OUT" && pwd)"
SIGNED="$OUT/staging/BobFWTools.app"
BOBFW_DEVELOPER_IDENTITY="$IDENTITIES" BOBFW_EXPECTED_TEAM_ID="$TEAM" \
  bash scripts/sign-bobfwtools-developer-id.sh "$APP" "$SIGNED"
APP_NOTARY="$OUT/app-notarization.json"
DMG_NOTARY="$OUT/dmg-notarization.json"
ditto -c -k --keepParent "$SIGNED" "$OUT/app-notarization.zip"
xcrun notarytool submit "$OUT/app-notarization.zip" --keychain-profile "$PROFILE" --wait --output-format json > "$APP_NOTARY"
python3 - "$APP_NOTARY" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
assert r.get('status')=='Accepted' and isinstance(r.get('id'),str) and r['id'].strip(), r
print('App notarization: Accepted; submission='+r['id'])
PY
xcrun stapler staple "$SIGNED"
xcrun stapler validate "$SIGNED"
spctl --assess --type execute --verbose=4 "$SIGNED"
DMG="$OUT/BobFWTools-$LABEL-universal-macOS.dmg"
mkdir "$OUT/pre-notary-copy" "$OUT/final-copy"
bash scripts/package-bobfwtools-dmg.sh "$SIGNED" "$DMG" "$OUT/pre-notary-copy/BobFWTools.app"
codesign --force --timestamp --sign "$IDENTITIES" "$DMG"
codesign --verify --strict "$DMG"
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait --output-format json > "$DMG_NOTARY"
python3 - "$DMG_NOTARY" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
assert r.get('status')=='Accepted' and isinstance(r.get('id'),str) and r['id'].strip(), r
print('DMG notarization: Accepted; submission='+r['id'])
PY
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG"
COPIED="$OUT/final-copy/BobFWTools.app"
bash scripts/package-bobfwtools-dmg.sh "$SIGNED" "$DMG" "$COPIED" verify
codesign --verify --deep --strict "$COPIED"
xcrun stapler validate "$COPIED"
spctl --assess --type execute --verbose=4 "$COPIED"
export BOBFWTOOLS_RELEASE_LABEL="$LABEL"
export BOBFW_EXPECTED_TEAM_ID="$TEAM"
bash scripts/create-bobfwtools-release-receipt.sh "$COPIED" "$DMG" "$APP_NOTARY" "$DMG_NOTARY" "$OUT/release-receipt.json"
ditto -c -k --keepParent "$COPIED" "$OUT/BobFWTools-$LABEL-universal-macOS.app.zip"
python3 - "$OUT" <<'PY'
import hashlib,pathlib,sys
root=pathlib.Path(sys.argv[1])
files=sorted(p for p in root.iterdir() if p.suffix in ['.dmg','.zip','.json'])
(root/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in files))
PY
echo "Signed/notarized installer candidate: PASS (native GUI and hardware remain separate)"
echo "output=$OUT"
