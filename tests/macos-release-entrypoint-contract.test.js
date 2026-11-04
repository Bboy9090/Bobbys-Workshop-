import { readFileSync, existsSync } from 'node:fs';
import { test, expect } from 'vitest';
const workflow = readFileSync(new URL('../.github/workflows/bobfwtools-macos-release.yml', import.meta.url), 'utf8');

test('public macOS release invokes existing verification helpers', () => {
  for (const path of ['scripts/verify-bobfwtools-macos-release-preflight.sh', 'scripts/create-bobfwtools-release-receipt.sh']) {
    expect(existsSync(new URL('../' + path, import.meta.url)), 'missing release helper: ' + path).toBeTruthy();
    expect(workflow.includes(path), 'release workflow no longer calls: ' + path).toBeTruthy();
  }
});

test('public release fails closed at real app and DMG notarization, Gatekeeper and provenance', () => {
  expect(workflow).toMatch(/notarytool submit/);
  expect(workflow).toMatch(/status != 'Accepted'/);
  expect(workflow).toMatch(/stapler validate/);
  expect(workflow).toMatch(/spctl --assess/);
  expect(workflow).toMatch(/tauri:build:macos:ci/);
  expect(workflow).toMatch(/verify-bobfwtools-macos-release-preflight\.sh/);
  expect(workflow).toMatch(/create-bobfwtools-release-receipt\.sh/);
  expect(workflow).not.toMatch(/bootforge_qualified_fastboot_devices/);
});

test('public release preflight excludes the qualified destructive executor', () => {
  const preflight = readFileSync(new URL('../scripts/verify-bobfwtools-macos-release-preflight.sh', import.meta.url), 'utf8');
  expect(preflight).toMatch(/bootforge_qualified_fastboot_devices/);
  expect(preflight).toMatch(/issue-qualified-flash-grant/);
  expect(preflight).toMatch(/unexpectedly contains the qualified destructive executor/);
});
