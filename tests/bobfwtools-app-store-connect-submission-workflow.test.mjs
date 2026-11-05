import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = readFileSync(
  ".github/workflows/bobfwtools-app-store-connect-submission.yml",
  "utf8",
);

test("submission lane is manual and requires exact package-run provenance", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /package_run_id:/);
  assert.match(workflow, /RUN_NAME.*BobFWTools Mac App Store Package/s);
  assert.match(workflow, /RUN_STATUS.*completed/s);
  assert.match(workflow, /RUN_CONCLUSION.*success/s);
  assert.match(workflow, /gh run download/);
  assert.match(workflow, /sourceRevision.*source_sha/s);
  assert.match(workflow, /installerPackageSha256.*pkg_sha/s);
});

test("upload requires explicit authorization and App Store Connect API credentials", () => {
  assert.match(workflow, /CONFIRM_UPLOAD.*UPLOAD/s);
  assert.match(workflow, /BOBFW_ASC_API_KEY_ID/);
  assert.match(workflow, /BOBFW_ASC_API_ISSUER_ID/);
  assert.match(workflow, /BOBFW_ASC_API_KEY_P8_BASE64/);
  assert.match(workflow, /--p8-file-path/);
});

test("lane validates before upload and does not confuse upload with review approval", () => {
  assert.match(workflow, /--validate-app/);
  assert.match(workflow, /--upload-app/);
  assert.ok(workflow.indexOf("--validate-app") < workflow.indexOf("--upload-app"));
  assert.match(workflow, /"appStoreConnectUploaded": True/);
  assert.match(workflow, /"appleProcessingComplete": False/);
  assert.match(workflow, /"appStoreReviewSubmitted": False/);
  assert.match(workflow, /"appStoreReviewApproved": False/);
  assert.doesNotMatch(workflow, /notarytool/);
});
