import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const script = fs.readFileSync('scripts/verify-bobfwtools-mac-app-store-profile.sh', 'utf8');
const entitlements = fs.readFileSync('src-tauri/entitlements.mac.plist', 'utf8');

describe('BobFWTools Mac App Store provisioning gate', () => {
  it('requires real Apple profile identity, team, bundle, expiry and distribution semantics', () => {
    expect(script).toContain('security cms -D -i');
    expect(script).toContain('TeamIdentifier:0');
    expect(script).toContain('Entitlements:get-task-allow');
    expect(script).toContain('Entitlements:com.apple.application-identifier');
    expect(script).toContain('ProvisionedDevices');
    expect(script).toContain('ProvisionsAllDevices');
    expect(script).toContain('provisioning profile is expired');
    expect(script).toContain('com.bobbyblanco.bobfwtools');
  });

  it('keeps shipping sandbox, USB and user-selected-file entitlements mandatory', () => {
    for (const key of [
      'com.apple.security.app-sandbox',
      'com.apple.security.device.usb',
      'com.apple.security.files.user-selected.read-write',
    ]) {
      expect(script).toContain(key);
      expect(entitlements).toContain(key);
    }
  });

  it('fails closed when expected Apple team is not supplied', () => {
    expect(script).toContain('BOBFW_EXPECTED_TEAM_ID or APPLE_TEAM_ID is required');
  });
});
