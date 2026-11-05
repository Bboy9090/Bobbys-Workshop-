import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const script = readFileSync("scripts/create-bobfwtools-app-store-archive-receipt.sh", "utf8");

test("App Store archive receipt verifies identity, profile, entitlements and architecture", () => {
  for (const token of [
    "embedded.provisionprofile",
    "verify-bobfwtools-mac-app-store-profile.sh",
    "CFBundleIdentifier",
    "CFBundleShortVersionString",
    "CFBundleVersion",
    "Apple Distribution",
    "3rd Party Mac Developer Application",
    "com.apple.security.app-sandbox",
    "com.apple.security.device.usb",
    "com.apple.security.files.user-selected.read-write",
    "lipo -archs",
    "app-store-archive-receipt.v1",
  ]) {
    assert.ok(script.includes(token), token);
  }
});

test("receipt remains fail-closed for App Store acceptance", () => {
  assert.match(script, /"appStoreReady":False/);
  assert.match(script, /App Store Connect upload\/review not proven/);
});
