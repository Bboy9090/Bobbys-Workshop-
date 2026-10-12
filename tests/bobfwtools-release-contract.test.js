import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('BobFWTools macOS signed release contract', () => {
  it('keeps the public release non-qualified, serialized, signed, notarized, and auditable', () => {
    const workflow = read('.github/workflows/bobfwtools-macos-release.yml');
    const preflight = read('scripts/verify-bobfwtools-macos-release-preflight.sh');
    const receipt = read('scripts/create-bobfwtools-release-receipt.sh');

    expect(workflow).toContain('concurrency:');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('actions/checkout@v7');
    expect(workflow).toContain('actions/setup-node@v7');
    expect(workflow).toContain('actions/upload-artifact@v7');
    expect(workflow).toContain('package-manager-cache: false');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('APP-NOTARIZATION.json');
    expect(workflow).toContain('DMG-NOTARIZATION.json');
    expect(workflow).toContain('RELEASE-RECEIPT.json');

    expect(preflight).toContain('qualified destructive executor');
    expect(preflight).toContain('qualified destructive');
    expect(preflight).toContain('release config must not bundle legacy resources');
    expect(preflight).toContain('release config must not declare external binaries');
    expect(receipt).toContain('com.bobbyblanco.bobfwtools.release-receipt.v2');
    expect(receipt).toContain('"qualifiedDestructiveWriterIncluded": False');
    expect(receipt).toContain('"submissionId"');
    expect(receipt).toContain('"dmgSha256"');
    expect(receipt).toContain('Gatekeeper rejected DMG');
  });

  it('keeps the reusable Developer ID helper capable of Apple-team binding', () => {
    const sign = read('scripts/sign-bobfwtools-developer-id.sh');
    expect(sign).toContain('BOBFW_EXPECTED_TEAM_ID');
    expect(sign).toContain('Developer ID TeamIdentifier does not match the expected Apple team');
  });

  it('supports a local notarized release without exporting the Developer ID private key', () => {
    const localRelease = read('scripts/release-bobfwtools-macos-local.sh');
    const profileSetup = read('scripts/configure-bobfwtools-notary-profile.sh');
    const runbook = read('docs/BOBFWTOOLS_LOCAL_NOTARIZED_RELEASE.md');

    expect(localRelease).toContain('notarytool history --keychain-profile');
    expect(localRelease).toContain('notarytool submit');
    expect(localRelease).toContain('scripts/sign-bobfwtools-developer-id.sh');
    expect(localRelease).toContain('scripts/create-bobfwtools-release-receipt.sh');
    expect(localRelease).toContain('scripts/verify-bobfwtools-macos-release-preflight.sh');
    expect(profileSetup).toContain('notarytool store-credentials');
    expect(profileSetup).toContain('BOBFW_APP_SPECIFIC_PASSWORD');
    expect(runbook).toContain('keeps the Developer ID private key in the Mac login keychain');
  });
});
