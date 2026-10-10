import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('firmware exact model manifest contract', () => {
  it('keeps package compatibility separate from execution authorization', () => {
    const core = read('libs/bootforgeusb/src/firmware_manifest.rs');
    expect(core).toContain('candidate_compatible');
    expect(core).toContain('execution_authorized');
    expect(core).toContain('let execution_authorized = false');
    expect(core).toContain('service-loader authorization and physical qualification still apply');
  });

  it('requires exact package identity metadata', () => {
    const core = read('libs/bootforgeusb/src/firmware_manifest.rs');
    expect(core).toContain('at least one exact commercial model is required');
    expect(core).toContain('firmware build ID is required');
    expect(core).toContain('firmware provenance/source reference is required');
    expect(core).toContain('bootloader_revision');
  });

  it('rejects unsafe artifact paths and verifies hashes', () => {
    const core = read('libs/bootforgeusb/src/firmware_manifest.rs');
    const commands = read('src-tauri/src/firmware_manifest_commands.rs');

    expect(core).toContain('ParentDir');
    expect(core).toContain('artifact SHA-256 must contain 64 hex characters');
    expect(commands).toContain('all_hashes_match');
    expect(commands).toContain('package_verified');
    expect(commands).toContain('resolved.starts_with(&package_root)');
  });

  it('exposes manifest inspection and target comparison through Tauri and the Command Center', () => {
    const main = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(main).toContain('firmware_manifest_inspect');
    expect(main).toContain('firmware_manifest_compare');
    expect(desktop).toContain('inspectFirmwareManifest');
    expect(desktop).toContain('compareFirmwareManifest');
    expect(ui).toContain('Exact model / variant manifest verification');
    expect(ui).toContain('execution authorization: NO');
  });
});
