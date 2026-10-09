#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app}"
EXPECTED_ID="com.bobbyblanco.bobfwtools"
EXPECTED_VERSION="0.1.0"
BIN="$APP_PATH/Contents/MacOS/bobfwtools"
PLIST="$APP_PATH/Contents/Info.plist"

fail() {
  echo "BobFWTools macOS release verification failed: $*" >&2
  exit 1
}

[[ -d "$APP_PATH" ]] || fail "app bundle not found: $APP_PATH"
[[ -f "$BIN" ]] || fail "main executable missing"
[[ -f "$PLIST" ]] || fail "Info.plist missing"

ARCHS="$(lipo -archs "$BIN" 2>/dev/null || true)"
[[ " $ARCHS " == *" x86_64 "* ]] || fail "x86_64 slice missing ($ARCHS)"
[[ " $ARCHS " == *" arm64 "* ]] || fail "arm64 slice missing ($ARCHS)"

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")"

[[ "$BUNDLE_ID" == "$EXPECTED_ID" ]] || fail "bundle id is $BUNDLE_ID"
[[ "$VERSION" == "$EXPECTED_VERSION" ]] || fail "version is $VERSION"
[[ -n "$BUILD" ]] || fail "bundle build/version is empty"

if find "$APP_PATH" -type f \( -iname '*.py' -o -iname 'node' -o -iname 'node.exe' -o -iname '*fastapi*' \) -print -quit | grep -q .; then
  fail "legacy Python/Node/FastAPI payload found"
fi

if find "$APP_PATH" -type f -path '*/server/*' -print -quit | grep -q .; then
  fail "legacy server payload found"
fi

SIGNING="unsigned"
SIGNATURE_DETAILS="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1 || true)"
if printf '%s\n' "$SIGNATURE_DETAILS" | grep -q '^Authority='; then
  codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1 || fail "identity-backed codesign verification failed"
  SIGNING="signed"
elif printf '%s\n' "$SIGNATURE_DETAILS" | grep -q '^Signature=adhoc'; then
  SIGNING="adhoc"
fi

echo "BobFWTools macOS app verification: PASS"
echo "bundle_id=$BUNDLE_ID"
echo "version=$VERSION"
echo "build=$BUILD"
echo "architectures=$ARCHS"
echo "signing=$SIGNING"
