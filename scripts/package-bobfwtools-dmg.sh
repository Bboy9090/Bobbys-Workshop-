#!/usr/bin/env bash
set -euo pipefail
# Shared packaging check for unsigned CI and the credential-gated release lane.
# Copies only into a new isolated destination; never installs into /Applications.
APP="${1:?app bundle is required}"
DMG="${2:?DMG destination is required}"
COPIED="${3:?isolated app-copy destination is required}"
MODE="${4:-create}"
REVISION="${BOBFWTOOLS_SOURCE_REVISION:-${GITHUB_SHA:-}}"
fail() { echo "BobFWTools installer packaging failed: $*" >&2; exit 1; }

[[ "$REVISION" =~ ^[a-f0-9]{40}$ ]] || fail "a full lowercase source SHA is required"
[[ -d "$APP" ]] || fail "app bundle not found"
case "$MODE" in
  create) [[ ! -e "$DMG" && ! -L "$DMG" ]] || fail "DMG destination already exists" ;;
  verify) [[ -f "$DMG" && ! -L "$DMG" ]] || fail "DMG to verify is missing or a symlink" ;;
  *) fail "installer mode must be create or verify" ;;
esac
[[ ! -e "$COPIED" && ! -L "$COPIED" ]] || fail "app-copy destination already exists"

# Read the complete executable instead of a strings | grep -q pipeline, whose
# early SIGPIPE can hide a forbidden marker under pipefail.
python3 - "$APP/Contents/MacOS/bobfwtools" "$REVISION" <<'PY'
import pathlib, sys
binary = pathlib.Path(sys.argv[1]).read_bytes()
if sys.argv[2].encode() not in binary:
    raise SystemExit("Installer executable does not contain the expected source SHA")
for marker in (b"bootforge_qualified_fastboot_devices", b"issue-qualified-flash-grant"):
    if marker in binary:
        raise SystemExit("Public installer contains a qualified destructive executor marker")
PY
bash scripts/verify-bobfwtools-macos-app.sh "$APP"

WORK="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/bobfw-dmg.XXXXXX")"
MOUNT="$WORK/mount"
MOUNTED=no
cleanup() {
  if [[ "$MOUNTED" == yes ]]; then
    hdiutil detach "$MOUNT" >/dev/null || { echo "Could not detach isolated installer mount: $MOUNT" >&2; exit 1; }
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT
mkdir -p "$WORK/stage" "$MOUNT" "$(dirname "$DMG")" "$(dirname "$COPIED")"
if [[ "$MODE" == create ]]; then
  ditto "$APP" "$WORK/stage/BobFWTools.app"
  ln -s /Applications "$WORK/stage/Applications"
  hdiutil create -volname BobFWTools -srcfolder "$WORK/stage" -format UDZO "$DMG"
fi
hdiutil verify "$DMG"
hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT" "$DMG"
MOUNTED=yes
[[ -L "$MOUNT/Applications" ]] || fail "Applications shortcut is missing"
[[ "$(readlink "$MOUNT/Applications")" == /Applications ]] || fail "Applications shortcut has the wrong destination"
ditto "$MOUNT/BobFWTools.app" "$COPIED"
diff -qr "$APP" "$COPIED"
bash scripts/verify-bobfwtools-macos-app.sh "$COPIED"
hdiutil detach "$MOUNT"
MOUNTED=no
echo "BobFWTools DMG integrity, read-only mount, Applications shortcut and isolated copy: PASS"
