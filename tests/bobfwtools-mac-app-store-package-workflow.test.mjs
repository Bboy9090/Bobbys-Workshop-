import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = readFileSync(".github/workflows/bobfwtools-mac-app-store-package.yml", "utf8");

test("Mac App Store workflow uses separate app and installer distribution identities", () => {
  for (const token of [
    "BOBFW_MAC_APP_DISTRIBUTION_IDENTITY",
    "BOBFW_MAC_INSTALLER_DISTRIBUTION_IDENTITY",
    "BOBFW_MAC_APP_STORE_PROFILE_BASE64",
    "verify-bobfwtools-mac-app-store-profile.sh",
    "create-bobfwtools-app-store-archive-receipt.sh",
    "productbuild",
    "--component \"$APP\" /Applications",
    "pkgutil --check-signature",
  ]) {
    assert.ok(workflow.includes(token), token);
  }
});

test("Mac App Store workflow does not misuse Developer ID notarization", () => {
  assert.doesNotMatch(workflow, /notarytool/);
  assert.doesNotMatch(workflow, /Developer ID Application/);
});

test("package receipt remains fail-closed for App Store Connect and review", () => {
  assert.match(workflow, /"appStoreConnectUploaded": False/);
  assert.match(workflow, /"appStoreReviewApproved": False/);
});
