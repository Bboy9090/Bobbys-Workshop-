import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Qualcomm + MediaTek firmware library contract', () => {
  it('ships representative Qualcomm and MediaTek chipset coverage', () => {
    const catalog = read('libs/bootforgeusb/src/firmware_catalog.rs');

    for (const token of [
      'MSM8998',
      'SDM6xx',
      'SM8550',
      'SM8650',
      'SM8750',
      'SDM845',
      'MT6768',
      'MT6769',
      'MT6789',
      'MT6895',
      'MT6989',
      'MT6991',
      'MT6993',
    ]) {
      expect(catalog).toContain(token);
    }

    expect(catalog).toContain('advisory only');
    expect(catalog).toContain('does not use BootROM/SLA/DAA bypasses');
  });

  it('quarantines bypass/exploit-marked service artifacts', () => {
    const library = read('src-tauri/src/firmware_library.rs');

    for (const marker of [
      'auth-bypass',
      'sla-bypass',
      'daa-bypass',
      'brom-bypass',
      'edl-bypass',
      'sahara-bypass',
      'firehose-patched',
      'exploit',
    ]) {
      expect(library).toContain(marker);
    }

    expect(library).toContain('eligible_for_planning: !blocked');
  });

  it('requires complete Qualcomm and MediaTek service metadata before bundle readiness', () => {
    const library = read('src-tauri/src/firmware_library.rs');

    expect(library).toContain('&["firehose-programmer", "rawprogram-manifest"]');
    expect(library).toContain('&["scatter-manifest", "download-agent"]');
    expect(library).toContain('planning_ready');
    expect(library).toContain('missing_required');
    expect(library).toContain('multiple {vendor_hint} chipset families');
    expect(library).toContain('&& !chipset_conflict');
  });

  it('detects duplicate firmware content by SHA-256', () => {
    const library = read('src-tauri/src/firmware_library.rs');

    expect(library).toContain('Duplicate firmware content detected');
    expect(library).toContain('Keep one authoritative copy per package');
  });

  it('exposes firmware catalog and scan commands through Tauri', () => {
    const main = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');

    for (const command of [
      'firmware_chipset_catalog',
      'firmware_chipset_lookup',
      'firmware_library_scan',
    ]) {
      expect(main).toContain(command);
    }

    expect(desktop).toContain('getFirmwareChipsetCatalog');
    expect(desktop).toContain('lookupFirmwareChipset');
    expect(desktop).toContain('scanFirmwareLibrary');
  });

  it('initializes vendor-specific managed firmware folders', () => {
    const workstation = read('src-tauri/src/workstation.rs');

    expect(workstation).toContain('"firmware-inbox"');
    expect(workstation).toContain('"firmware-qualcomm"');
    expect(workstation).toContain('"firmware-mediatek"');
    expect(workstation).toContain('"firmware-quarantine"');
  });

  it('ships context-aware hand-holding walkthroughs for service workflows', () => {
    const guide = read('src/components/WorkflowWalkthrough.tsx');
    const ui = read('src/components/RepairCommandCenter.tsx');

    for (const workflow of [
      'Android ADB walkthrough',
      'Qualcomm EDL 9008 walkthrough',
      'MediaTek BootROM walkthrough',
      'MediaTek Preloader walkthrough',
      'Samsung Download Mode walkthrough',
    ]) {
      expect(guide).toContain(workflow);
    }

    expect(guide).toContain('Do this:');
    expect(guide).toContain('You should see:');
    expect(guide).toContain('Stop here if:');
    expect(guide).toContain('completed checklist never overrides');
    expect(ui).toContain('<WorkflowWalkthrough kind={walkthroughKind} />');
  });

  it('surfaces chipset intelligence and package-set readiness in the Command Center', () => {
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(ui).toContain('Qualcomm + MediaTek firmware intelligence');
    expect(ui).toContain('Package-set readiness');
    expect(ui).toContain('Scan managed firmware');
    expect(ui).toContain('quarantine / do not plan');
    expect(ui).toContain('How to use this section');
    expect(ui).toContain('What is blocking this package');
    expect(ui).toContain('Next step: return to the official/service package source');
    expect(ui).toContain('Workstation setup walkthrough');
    expect(ui).toContain('Setup is blocked');
    expect(ui).toContain('You should see: this card changes to driver ready');

    const safety = read('src/components/RecoverySafetyTools.tsx');
    expect(safety).toContain('Backup walkthrough');
    expect(safety).toContain('Programmer enrollment walkthrough');
    expect(safety).toContain('Choosing a different unverified programmer is not a valid workaround');

    const dossier = read('src/components/QualificationDossier.tsx');
    expect(dossier).toContain('Qualification walkthrough');
    expect(dossier).toContain('Stop here. Do not substitute another phone');
    expect(dossier).toContain('Do not edit the blocked dossier to make it pass');
  });
});
