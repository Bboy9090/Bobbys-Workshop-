import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
const workflow = readFileSync(new URL('../.github/workflows/bobfwtools-macos-release.yml', import.meta.url), 'utf8');

test('public macOS release invokes existing verification helpers', () => {
  for (const path of ['scripts/verify-bobfwtools-macos-release-preflight.sh', 'scripts/create-bobfwtools-release-receipt.sh']) {
    assert.ok(existsSync(new URL('../' + path, import.meta.url)), 'missing release helper: ' + path);
    assert.ok(workflow.includes(path), 'release workflow no longer calls: ' + path);
  }
});

test('public release fails closed at real app and DMG notarization, Gatekeeper and provenance', () => {
  assert.match(workflow, /notarytool submit/);
  assert.match(workflow, /status != 'Accepted'/);
  assert.match(workflow, /stapler validate/);
  assert.match(workflow, /spctl --assess/);
  assert.match(workflow, /tauri:build:macos:ci/);
  assert.match(workflow, /verify-bobfwtools-macos-release-preflight\.sh/);
  assert.match(workflow, /create-bobfwtools-release-receipt\.sh/);
  assert.doesNotMatch(workflow, /bootforge_qualified_fastboot_devices/);
});

test('public release preflight excludes the qualified destructive executor', () => {
  const preflight = readFileSync(new URL('../scripts/verify-bobfwtools-macos-release-preflight.sh', import.meta.url), 'utf8');
  assert.match(preflight, /bootforge_qualified_fastboot_devices/);
  assert.match(preflight, /issue-qualified-flash-grant/);
  assert.match(preflight, /unexpectedly contains the qualified destructive executor/);
});
