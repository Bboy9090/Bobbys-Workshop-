#!/usr/bin/env bash
set -euo pipefail
# CI-only installer structure/copy checks. This does not qualify a signed release or native GUI.
test -n "$BOBFWTOOLS_SOURCE_REVISION"
test -n "$RUNNER_TEMP"
APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/BobFWTools.app"
OUT="$RUNNER_TEMP/BobFWTools-installer-qualification"
WORK="$(mktemp -d "$RUNNER_TEMP/bobfw-installer.XXXXXX")"
STAGE="$WORK/stage"
MOUNT="$WORK/mount"
COPIED="$WORK/installed/BobFWTools.app"
DMG="$OUT/BobFWTools-universal-macOS-unsigned.dmg"
mkdir -p "$OUT" "$STAGE" "$MOUNT" "$WORK/installed"
test ! -e "$DMG"

bash scripts/verify-bobfwtools-macos-app.sh "$APP"
ditto "$APP" "$STAGE/BobFWTools.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "BobFWTools" -srcfolder "$STAGE" -format UDZO "$DMG"
hdiutil verify "$DMG"

trap 'hdiutil detach "$MOUNT" >/dev/null 2>&1 || true' EXIT
hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT" "$DMG"
test -L "$MOUNT/Applications"
test "$(readlink "$MOUNT/Applications")" = "/Applications"
ditto "$MOUNT/BobFWTools.app" "$COPIED"
diff -qr "$APP" "$COPIED"
bash scripts/verify-bobfwtools-macos-app.sh "$COPIED"
strings "$COPIED/Contents/MacOS/bobfwtools" | grep -F "$BOBFWTOOLS_SOURCE_REVISION"

SIGNATURE_DETAILS="$(codesign -dv --verbose=4 "$COPIED" 2>&1 || true)"
if printf '%s\n' "$SIGNATURE_DETAILS" | grep -q '^Authority='; then
  echo "Unexpected identity-backed signature in CI installer." >&2
  exit 1
fi
SIGNATURE_MODE="unsigned"
if printf '%s\n' "$SIGNATURE_DETAILS" | grep -q '^Signature=adhoc'; then
  codesign --verify --deep --strict "$COPIED"
  SIGNATURE_MODE="adhoc"
fi
python3 - "$DMG" "$COPIED" "$OUT/installer-evidence.json" "$SIGNATURE_MODE" "$BOBFWTOOLS_SOURCE_REVISION" <<'PY'
import datetime, hashlib, json, pathlib, sys
dmg, app, output, signature, revision = sys.argv[1:]
app = pathlib.Path(app)
def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
receipt = {
    "schema": "bobfwtools.unsigned-installer-evidence.v1",
    "sourceRevision": revision,
    "observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "scope": "macOS CI runner; unsigned installer structure and isolated copy only",
    "status": "PASS",
    "executionAuthorized": False,
    "hardwareQualified": False,
    "signatureMode": signature,
    "artifacts": {
        "dmgSha256": digest(dmg),
        "copiedExecutableSha256": digest(app / "Contents/MacOS/bobfwtools"),
        "copiedInfoPlistSha256": digest(app / "Contents/Info.plist"),
    },
    "checks": [
        {"capability": "DMG integrity", "status": "PASS"},
        {"capability": "Read-only mount and Applications link", "status": "PASS"},
        {"capability": "Isolated app copy matches original bundle bytes", "status": "PASS"},
        {"capability": "Copied universal bundle preflight", "status": "PASS"},
        {"capability": "Developer ID release signature", "status": "BLOCKED"},
        {"capability": "App and DMG notarization", "status": "BLOCKED"},
        {"capability": "Release Gatekeeper acceptance", "status": "NOT TESTED"},
        {"capability": "Native GUI on the connected Mac", "status": "BLOCKED"},
    ],
}
receipt["releaseQualified"] = False
receipt["cases"] = []
receipt["receipts"] = []
for index, check in enumerate(receipt["checks"]):
    spec = {
        "caseId": "installer-" + str(index + 1),
        "model": "macOS-universal",
        "deviceAlias": "github-macos-ci" if index < 7 else "connected-mac",
        "protocol": "dmg",
        "operation": check["capability"],
        "scope": "release",
        "sourceRevision": revision,
    }
    if check["status"] == "BLOCKED":
        spec["exception"] = "Outside this unsigned CI packaging check: " + check["capability"]
    receipt["cases"].append(spec)
    if check["status"] == "PASS":
        receipt["receipts"].append({
            **spec,
            "status": "PASS",
            "observedAt": receipt["observedAt"],
            "detail": check["capability"] + " passed on the macOS CI runner; no release or device execution authority.",
            "artifacts": [{"path": pathlib.Path(dmg).name, "sha256": receipt["artifacts"]["dmgSha256"]}],
        })
pathlib.Path(output).write_text(json.dumps(receipt, indent=2) + "\n")
print("UNSIGNED_INSTALLER_EVIDENCE " + json.dumps(receipt))
PY
node scripts/qualification-matrix.mjs "$OUT/installer-evidence.json" > "$OUT/installer-matrix.json"
python3 - "$OUT/installer-matrix.json" <<'PY'
import json, sys
report = json.load(open(sys.argv[1], encoding="utf-8"))
assert report["executionAuthorized"] is False
assert len(report["rows"]) == 8
assert [row["status"] for row in report["rows"][:4]] == ["PASS"] * 4
assert all(row["executionAuthorized"] is False for row in report["rows"])
assert not any(row["status"] == "PASS" for row in report["rows"][4:])
print("Unsigned installer evidence hashes and scope: PASS")
PY
hdiutil detach "$MOUNT"
trap - EXIT
