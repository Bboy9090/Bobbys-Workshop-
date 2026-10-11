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

  it('requires complete service metadata plus exact provenance before bundle readiness', () => {
    const library = read('src-tauri/src/firmware_library.rs');

    expect(library).toContain('&["firehose-programmer", "rawprogram-manifest"]');
    expect(library).toContain('&["scatter-manifest", "download-agent"]');
    expect(library).toContain('bobfwtools-firmware-manifest.json');
    expect(library).toContain('com.bobbyblanco.bobfwtools.firmware-provenance.v1');
    expect(library).toContain('official-oem');
    expect(library).toContain('authorized-service');
    expect(library).toContain('provenance.exact_identity_present');
    expect(library).toContain('Provenance hash mismatch');
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
      'firmware_provenance_write',
      'firmware_bundle_planning_artifacts',
    ]) {
      expect(main).toContain(command);
    }

    expect(desktop).toContain('getFirmwareChipsetCatalog');
    expect(desktop).toContain('lookupFirmwareChipset');
    expect(desktop).toContain('scanFirmwareLibrary');
    expect(desktop).toContain('writeFirmwareProvenance');
    expect(desktop).toContain('getVerifiedFirmwareBundleArtifacts');
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
    expect(ui).toContain('model/board/SKU');
    expect(ui).toContain('Same-chipset firmware is not enough');
    expect(ui).toContain('provenance');
    expect(ui).toContain('FirmwareProvenanceBuilder');
    expect(ui).toContain('Workstation setup walkthrough');
    expect(ui).toContain('Setup is blocked');
    expect(ui).toContain('You should see: this card changes to driver ready');

    const safety = read('src/components/RecoverySafetyTools.tsx');
    expect(safety).toContain('Backup walkthrough');
    expect(safety).toContain('Programmer enrollment walkthrough');
    expect(safety).toContain('Choosing a different unverified programmer is not a valid workaround');

    const provenance = read('src/components/FirmwareProvenanceBuilder.tsx');
    expect(provenance).toContain('Package provenance builder');
    expect(provenance).toContain('Create exact provenance manifest');
    expect(provenance).toContain('Stop if you cannot prove the exact model/board/SKU');
    expect(provenance).toContain('Do not edit hashes');

    const dossier = read('src/components/QualificationDossier.tsx');
    expect(dossier).toContain('Qualification walkthrough');
    expect(dossier).toContain('Stop here. Do not substitute another phone');
    expect(dossier).toContain('Do not edit the blocked dossier to make it pass');

    const qualified = read('src/components/QualifiedFlashConsole.tsx');
    expect(qualified).toContain('Qualification wizard');
    expect(qualified).toContain('YOU ARE HERE');
    expect(qualified).toContain('Production authority');
    expect(qualified).toContain('Do not skip ahead, reuse stale evidence, or change targets to make the workflow pass');
  });
});


describe('Firmware provenance documentation contract', () => {
  it('documents the operator manifest workflow and fail-closed rules', () => {
    const docs = read('docs/FIRMWARE_LIBRARY.md');

    expect(docs).toContain('## Exact package provenance manifest');
    expect(docs).toContain('bobfwtools-firmware-manifest.json');
    expect(docs).toContain('model/board/SKU bound');
    expect(docs).toContain('Do not edit a digest merely to make the package pass');
    expect(docs).toContain('does **not** authorize a write');
  });
});


describe('Verified firmware recovery handoff', () => {
  it('revalidates planning readiness before handing a bundle to recovery planning', () => {
    const library = read('src-tauri/src/firmware_library.rs');
    const app = read('src/App.tsx');

    expect(library).toContain('firmware_bundle_planning_artifacts');
    expect(library).toContain('if !bundle.planning_ready');
    expect(library).toContain('entry.eligible_for_planning');
    expect(library).toContain('selected firmware bundle is not planning-ready');

    expect(app).toContain('Verified firmware handoff');
    expect(app).toContain('Use verified package');
    expect(app).toContain('getVerifiedFirmwareBundleArtifacts');
    expect(app).toContain('bundle.vendorHint !== expectedVendor');
    expect(app).toContain('The backend rescans this package before handoff');
  });
});


describe('Recovery layout storage-domain safety', () => {
  it('fails closed on ambiguous Qualcomm LUNs and mixed MediaTek storage families', () => {
    const job = read('libs/bootforgeusb/src/recovery_job.rs');

    expect(job).toContain('storage_domain_integrity_issues');
    expect(job).toContain('physical_partition_number');
    expect(job).toContain('mixes eMMC and UFS storage families');
    expect(job).toContain('unrecognized storage region');
    expect(job).toContain('integrity_findings.extend(storage_domain_issues');
  });
});


describe('Recovery integrity remediation UX', () => {
  it('explains how to resolve rawprogram/scatter integrity failures safely', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('Layout or payload integrity failed');
    expect(app).toContain('verify the rawprogram/scatter file belongs to the exact model, board, SKU, storage type, and build');
    expect(app).toContain('Do not edit partition addresses, storage regions, LUN numbers, or payload sizes merely to make the check pass');
  });
});


describe('Per-device mode controls', () => {
  it('binds ADB and Fastboot transitions to exact device serials', () => {
    const app = read('src/App.tsx');
    const modeControl = read('src-tauri/src/mode_control.rs');
    const jobs = read('src-tauri/src/workflow_jobs.rs');

    expect(app).toContain('runAdbModeForSerial(device.serial');
    expect(app).toContain('runFastbootModeForSerial(serial');
    expect(app).toContain('BobFWTools re-scans after the phone disconnects and changes mode');
    expect(app).toContain('Download Mode is not exposed here because it is not a generic Fastboot transition');

    expect(jobs).toContain('adb-reboot-normal');
    expect(jobs).toContain('adb-reboot-recovery');
    expect(jobs).toContain('adb-reboot-bootloader');
    expect(jobs).toContain('adb-reboot-download');

    expect(modeControl).toContain('require_exact_fastboot_target');
    expect(modeControl).toContain('fastboot_mode_devices');
    expect(modeControl).toContain('fastboot_reboot_mode');
    expect(modeControl).toContain('Download Mode is not a generic Fastboot transition');
  });
});


describe('Mode transition verification receipts', () => {
  it('separates accepted commands from verified re-enumeration', () => {
    const app = read('src/App.tsx');
    const modeControl = read('src-tauri/src/mode_control.rs');
    const desktop = read('src/lib/desktop.ts');

    expect(modeControl).toContain('mode_transition_verify');
    expect(modeControl).toContain('identity_confidence');
    expect(modeControl).toContain('mode-observed-identity-unverified');
    expect(modeControl).toContain('Original serial has not reappeared in fastboot yet');
    expect(modeControl).toContain('Samsung Download Mode was observed');

    expect(desktop).toContain('verifyModeTransition');
    expect(app).toContain('verifyTransitionLater');
    expect(app).toContain('MODE VERIFIED');
    expect(app).toContain('MODE NOT YET VERIFIED');
    expect(app).toContain('identity:');
  });
});


describe('Device-aware mode capability matrix', () => {
  it('gates Samsung Download and refuses fake universal EDL/BROM buttons', () => {
    const adb = read('src-tauri/src/adb_workflows.rs');
    const app = read('src/App.tsx');
    const desktop = read('src/lib/desktop.ts');

    expect(adb).toContain('adb_mode_capabilities');
    expect(adb).toContain('Download Mode is only exposed after BobFWTools identifies the authorized ADB target as Samsung');
    expect(adb).toContain('generic adb reboot edl is intentionally not exposed');
    expect(adb).toContain('BROM/preloader entry is intentionally not exposed as a generic ADB command');

    expect(desktop).toContain('getAdbModeCapabilities');
    expect(app).toContain('adbModeCapabilities[device.serial]?.download');
    expect(app).toContain('Qualcomm EDL: device/OEM-specific entry required');
    expect(app).toContain('MediaTek BROM/Preloader: device-specific or physical entry required');
  });
});


describe('Mode control stale-state protection', () => {
  it('clears prior transition receipts and offers per-device re-scan after manual entry', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('delete next[serial]');
    expect(app).toContain('Re-scan modes');
    expect(app).toContain('Use after a manual OEM key-combo/service entry');
  });
});


describe('USB-only service mode transition guidance', () => {
  it('explains when software exit signals are unavailable instead of exposing fake controls', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('Mode transition matrix');
    expect(app).toContain('Do not send guessed Sahara/Firehose reset packets');
    expect(app).toContain('no generic BROM/Preloader exit command is exposed');
    expect(app).toContain('no generic unauthenticated Download Mode exit command is exposed');
    expect(app).toContain('Re-scan this mode');
  });
});


describe('Windows driver claim control center', () => {
  it('inspects exact device claims and releases only the selected device node', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_scan');
    expect(backend).toContain('DEVPKEY_Device_DriverInfPath');
    expect(backend).toContain('DEVPKEY_Device_HardwareIds');
    expect(backend).toContain('driver_binding_release_and_rescan');
    expect(backend).toContain('/remove-device');
    expect(backend).toContain('/scan-devices');
    expect(backend).toContain('No driver package was deleted');

    expect(desktop).toContain('scanDriverBindings');
    expect(desktop).toContain('releaseAndRescanDriverBinding');

    expect(ui).toContain('Driver Claim Inspector');
    expect(ui).toContain('Release + re-enumerate');
    expect(ui).toContain('possible driver mismatch');
    expect(ui).toContain('Forced INF binding remains blocked until hardware-ID compatibility is proven');
  });
});


describe('Verified INF relatch workflow', () => {
  it('requires exact hardware-ID compatibility before staging a driver package', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_inspect_inf');
    expect(backend).toContain('matched_hardware_ids');
    expect(backend).toContain('Driver relatch blocked: selected INF hardware IDs do not match the exact device');
    expect(backend).toContain('pnputil /add-driver');
    expect(backend).toContain('driver_binding_stage_and_relatch');
    expect(backend).toContain('verified_claim');

    expect(desktop).toContain('chooseDriverInf');
    expect(desktop).toContain('inspectDriverInf');
    expect(desktop).toContain('stageAndRelatchDriver');

    expect(ui).toContain('Inspect compatible INF');
    expect(ui).toContain('Stage + relatch exact device');
    expect(ui).toContain('HARDWARE-ID MATCH VERIFIED');
    expect(ui).toContain('INF MISMATCH — RELATCH BLOCKED');
    expect(ui).toContain('DRIVER CLAIM VERIFIED');
  });
});


describe('Driver relatch audit evidence', () => {
  it('records exact-instance driver inspection and elevated relatch operations', () => {
    const backend = read('src-tauri/src/driver_binding.rs');

    expect(backend).toContain('"driver-binding"');
    expect(backend).toContain('"inspect-inf"');
    expect(backend).toContain('"stage-relatch"');
    expect(backend).toContain('"release-rescan"');
    expect(backend).toContain('verified-claim:');
    expect(backend).toContain('observed-service:');
    expect(backend).toContain('observed-inf:');
  });
});


describe('Composite USB driver isolation', () => {
  it('tracks MI_xx siblings and verifies the same interface after relatch', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('composite_identity');
    expect(backend).toContain('interface_specific_ids');
    expect(backend).toContain('composite_sibling_count');
    expect(backend).toContain('original_interface_ids');

    expect(ui).toContain('Composite USB device detected');
    expect(ui).toContain('Exact interface protection is active');
    expect(ui).toContain('not merely the same VID/PID family');
  });
});


describe('Installed driver conflict candidates', () => {
  it('ranks compatible installed OEM INF packages by exact interface evidence', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_candidates');
    expect(backend).toContain('exact_interface_match');
    expect(backend).toContain('compatibility_score');
    expect(backend).toContain('oem');
    expect(backend).toContain('current_claim');

    expect(desktop).toContain('getInstalledDriverCandidates');
    expect(ui).toContain('Installed driver candidates');
    expect(ui).toContain('exact interface match');
    expect(ui).toContain('current claim');
    expect(ui).toContain('Multiple compatible driver packages are installed for this interface');
  });
});


describe('Guided driver conflict resolution plan', () => {
  it('classifies exact-interface driver conflicts and gives non-destructive next steps', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_conflict_plan');
    expect(backend).toContain('actionable-mismatch');
    expect(backend).toContain('ambiguous-family-only');
    expect(backend).toContain('multiple-exact-candidates');
    expect(backend).toContain('missing-compatible-driver');
    expect(backend).toContain('Do not delete driver packages automatically');

    expect(desktop).toContain('getDriverConflictPlan');
    expect(ui).toContain('Driver conflict resolution plan');
    expect(ui).toContain('Build resolution plan');
    expect(ui).toContain('Stop here until resolved');
    expect(ui).toContain('Do this');
  });
});
