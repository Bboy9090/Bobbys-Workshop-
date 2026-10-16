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
    expect(ui).toContain('Auto-fix unique verified driver claim');
    expect(ui).toContain('candidate.exactInterfaceMatch');
    expect(ui).toContain('Automatic verified relatch stopped');
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


describe('Windows driver claim stability test', () => {
  it('detects exact-interface driver churn without mutating the driver store', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_stability_test');
    expect(backend).toContain('claim_changes');
    expect(backend).toContain('disappearance_events');
    expect(backend).toContain('claim-stability-test');
    expect(backend).toContain('Do not start firmware writes while the exact interface claim is unstable');

    expect(desktop).toContain('runDriverClaimStabilityTest');
    expect(ui).toContain('Driver Claim Stability Test');
    expect(ui).toContain('Run claim stability test');
    expect(ui).toContain('CLAIM CHURN DETECTED');
    expect(ui).toContain('CLAIM STABLE');
  });
});


describe('Protected driver cleanup recommendations', () => {
  it('protects the active claim and never auto-deletes competing packages', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_cleanup_report');
    expect(backend).toContain('keep-protected');
    expect(backend).toContain('candidate-for-cleanup-review');
    expect(backend).toContain('BobFWTools will never recommend deleting the active claim automatically');
    expect(backend).not.toContain('driver_binding_cleanup_delete');

    expect(desktop).toContain('getDriverCleanupReport');
    expect(ui).toContain('Driver cleanup recommendation');
    expect(ui).toContain('Evidence only');
    expect(ui).toContain('protected current INF');
  });
});


describe('Driver snapshot and rollback planning', () => {
  it('captures exact claim evidence and refuses blind rollback', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_snapshot');
    expect(backend).toContain('com.bobbyblanco.bobfwtools.driver-binding-snapshot.v2');
    expect(backend).toContain('driver-snapshots');
    expect(backend).toContain('driver_binding_rollback_plan');
    expect(backend).toContain('Rollback snapshots must come from BobFWTools managed driver-snapshots storage');
    expect(backend).toContain('Current interface hardware identity does not match the snapshot');
    expect(backend).toContain('The prior INF from the snapshot is no longer available in the Windows INF store');
    expect(backend).toContain('Require HARDWARE-ID MATCH VERIFIED');

    expect(desktop).toContain('createDriverBindingSnapshot');
    expect(desktop).toContain('getDriverRollbackPlan');
    expect(ui).toContain('Snapshot current claim');
    expect(ui).toContain('Build rollback plan');
    expect(ui).toContain('ROLLBACK PATH VERIFIED');
    expect(ui).toContain('ROLLBACK BLOCKED');
  });
});


describe('Automatic pre-relatch driver snapshot', () => {
  it('blocks relatch when rollback evidence cannot be captured', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('Relatch blocked because pre-change driver snapshot could not be captured');
    expect(backend).toContain('snapshot_path: Some(snapshot.path.clone())');
    expect(desktop).toContain('snapshotPath?: string | null');
    expect(ui).toContain('pre-relatch snapshot');
  });
});


describe('Tamper-evident driver rollback snapshots', () => {
  it('fingerprints exact claim state and rejects modified receipts', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('com.bobbyblanco.bobfwtools.driver-binding-snapshot.v2');
    expect(backend).toContain('snapshot_fingerprint');
    expect(backend).toContain('Driver rollback snapshot fingerprint mismatch');
    expect(backend).toContain('snapshot_fingerprint_valid');
    expect(backend).toContain('snapshot_fingerprint_changes_when_driver_claim_changes');

    expect(desktop).toContain('fingerprint: string');
    expect(desktop).toContain('snapshotFingerprintValid');
    expect(ui).toContain('snapshot fingerprint');
    expect(ui).toContain('fingerprint {driverSnapshots[binding.instanceId].snapshot.fingerprint}');
  });
});


describe('Installed driver provenance metadata', () => {
  it('surfaces provider version and catalog evidence for competing INF packages', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('inf_metadata_value');
    expect(backend).toContain('provider: inf_metadata_value(&text, "Provider")');
    expect(backend).toContain('driver_version: inf_metadata_value(&text, "DriverVer")');
    expect(backend).toContain('catalog_file: inf_metadata_value(&text, "CatalogFile")');

    expect(desktop).toContain('driverVersion?: string | null');
    expect(ui).toContain("provider {candidate.provider || 'unavailable'}");
    expect(ui).toContain("version {candidate.driverVersion || 'unavailable'}");
    expect(ui).toContain("catalog {candidate.catalogFile || 'unavailable'}");
  });
});


describe('Current INF hardware-ID claim proof', () => {
  it('requires the bound INF to advertise a compatible USB hardware ID', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('current_inf_hardware_match');
    expect(backend).toContain('claim_hardware_id_verified');
    expect(backend).toContain('claim_match_scope');
    expect(backend).toContain('Current INF also advertises a compatible USB hardware ID');
    expect(backend).toContain('could not prove a matching hardware ID inside the currently bound INF');

    expect(desktop).toContain('claimHardwareIdVerified');
    expect(desktop).toContain('claimMatchScope');
    expect(ui).toContain('INF hardware-ID proof');
    expect(ui).toContain("scope {binding.claimMatchScope}");
  });
});


describe('Windows driver mutation elevation gate', () => {
  it('blocks release and relatch until administrator elevation is proven', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('driver_binding_elevation_status');
    expect(backend).toContain('require_elevation("Verified driver staging and relatch")');
    expect(backend).toContain('require_elevation("Exact-device release and rescan")');
    expect(backend).toContain('requires Windows administrator elevation');

    expect(desktop).toContain('getDriverElevationStatus');
    expect(ui).toContain('Windows mutation readiness');
    expect(ui).toContain('Check admin readiness');
    expect(ui).toContain('ADMIN READY');
    expect(ui).toContain('ADMIN REQUIRED');
  });
});


describe('Post-relatch claim stability verification', () => {
  it('requires a stable exact-interface claim before final driver verification', () => {
    const backend = read('src-tauri/src/driver_binding.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/RepairCommandCenter.tsx');

    expect(backend).toContain('claim_matched_once');
    expect(backend).toContain('driver_binding_stability_test(record.instance_id.clone())');
    expect(backend).toContain('let verified_claim = claim_matched_once && stability_verified');
    expect(backend).toContain('stability_summary');

    expect(desktop).toContain('stabilityVerified');
    expect(desktop).toContain('stabilitySummary');
    expect(ui).toContain("stability {driverRelatchResults[binding.instanceId].stabilityVerified ? 'verified' : 'not verified'}");
  });
});


describe('Firmware provenance package switching', () => {
  it('clears identity and source facts when the selected package directory changes', () => {
    const ui = read('src/components/FirmwareProvenanceBuilder.tsx');

    expect(ui).toContain('Package identity/source facts must never bleed across bundle changes');
    expect(ui).toContain("setOem('')");
    expect(ui).toContain("setModel('')");
    expect(ui).toContain("setBoard('')");
    expect(ui).toContain("setSku('')");
    expect(ui).toContain("setBuildVersion('')");
    expect(ui).toContain("setSourceReference('')");
    expect(ui).toContain('Changing package directories clears all identity and source fields');
  });
});

describe('Firmware managed root initialization', () => {
  it('creates the managed firmware workspace before provenance canonicalization', () => {
    const backend = read('src-tauri/src/firmware_library.rs');

    expect(backend).toContain('fn ensure_firmware_root()');
    expect(backend).toContain('let root = ensure_firmware_root()?;');
    expect(backend).toContain('failed creating firmware inbox');
    expect(backend).toContain('failed creating Qualcomm firmware directory');
    expect(backend).toContain('failed creating MediaTek firmware directory');
    expect(backend).toContain('failed creating firmware quarantine directory');
  });
});

describe('Recovery lane verified firmware selection', () => {
  it('invalidates a selected package when the active recovery vendor changes', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('expectedRecoveryVendor');
    expect(app).toContain('laneVerifiedFirmwareBundles');
    expect(app).toContain('bundle.planningReady &&');
    expect(app).toContain('bundle.vendorHint === expectedRecoveryVendor &&');
    expect(app).toContain('sameIdentityValue(bundle.model, lockedRecoveryIdentity.model)');
    expect(app).toContain('sameIdentityValue(bundle.board, lockedRecoveryIdentity.board)');
    expect(app).toContain('sameIdentityValue(bundle.sku, lockedRecoveryIdentity.sku)');
    expect(app).toContain('setSelectedVerifiedBundle((current) =>');
    expect(app).toContain("return laneVerifiedFirmwareBundles[0]?.directory ?? ''");
    expect(app).toContain('Switching recovery lanes automatically clears or replaces any package from the other vendor');
  });
});


describe('Mode transition verification hardening', () => {
  it('requires positive normal-mode proof and makes USB scanning mode-specific', () => {
    const backend = read('src-tauri/src/mode_control.rs');

    expect(backend).toContain('sys.boot_completed');
    expect(backend).toContain('normal Android userspace is not positively proven');
    expect(backend).toContain('adb-present-mode-unverified');
    expect(backend).toContain('USB re-detection unavailable');
    expect(backend).toContain('Samsung Download Mode verification requires USB re-detection');
    expect(backend).toContain('usb-evidence-unavailable');
  });
});


describe('Qualified flash trial versus production authority', () => {
  it('requires exactly one trial partition and never treats trial authority as production authority', () => {
    const ui = read('src/components/QualifiedFlashConsole.tsx');
    const backend = read('src-tauri/src/main.rs');

    expect(ui).toContain('partitions.length !== 1');
    expect(ui).toContain('trialGrantActive');
    expect(ui).toContain('productionGrantActive');
    expect(ui).toContain('trial-only — exactly one approved partition; no wipe or automatic reboot');
    expect(ui).toContain('production-qualified — short-lived approved authority');
    expect(ui).toContain('exactly one trial partition required');

    expect(backend).toContain('qualificationStatus: "qualification-trial".into()');
    expect(backend).toContain('executorQualified: false');
    expect(backend).toContain('qualificationStatus: "approved".into()');
    expect(backend).toContain('executorQualified: true');
    expect(backend).toContain('let is_approved = grant.qualificationStatus == "approved" && grant.executorQualified');
    expect(backend).toContain('let is_trial = grant.qualificationStatus == "qualification-trial" && !grant.executorQualified');
  });
});


describe('Firmware workspace initializer recursion guard', () => {
  it('creates the managed firmware root from firmware_root instead of calling itself', () => {
    const backend = read('src-tauri/src/firmware_library.rs');

    expect(backend).toContain('fn ensure_firmware_root()');
    expect(backend).toContain('let root = firmware_root();');
    expect(backend).not.toContain('let root = ensure_firmware_root()?;\n    Ok(root)');
  });
});


describe('Verified firmware package fingerprint', () => {
  it('binds the provenance manifest and sorted planning artifact hashes into recovery handoff identity', () => {
    const backend = read('src-tauri/src/firmware_library.rs');
    const desktop = read('src/lib/desktop.ts');
    const app = read('src/App.tsx');
    const consoleUi = read('src/components/QualifiedFlashConsole.tsx');

    expect(backend).toContain('fn bundle_package_fingerprint');
    expect(backend).toContain('bobfwtools-firmware-bundle-v1');
    expect(backend).toContain('entry.artifact_kind == "provenance-manifest" || entry.eligible_for_planning');
    expect(backend).toContain('lines.sort()');
    expect(backend).toContain('let package_fingerprint = bundle_package_fingerprint');
    expect(backend).toContain('package_fingerprint,');

    expect(desktop).toContain('packageFingerprint?: string | null');
    expect(app).toContain('Selected package fingerprint:');
    expect(app).toContain('The selected firmware bundle has no deterministic package fingerprint');
    expect(desktop).toContain('reviewRecoveryReadinessCertificatePath');
    expect(app).toContain('reviewRecoveryReadinessCertificatePath(path, recoveryJob.jobFingerprint)');
    expect(desktop).toContain('const suppliedReadiness = input.readinessCertificatePath?.trim() || null');
    expect(app).toContain('readinessCertificatePath={recoveryCertificateReview?.safeToReview ? recoveryCertificatePath : null}');
    expect(consoleUi).toContain('readinessCertificatePath: readinessCertificatePath?.trim() || null');
  });
});


describe('Verified firmware package binding into recovery jobs', () => {
  it('binds package identity into the recovery job fingerprint and revalidation chain', () => {
    const recovery = read('libs/bootforgeusb/src/recovery_job.rs');
    const backend = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');
    const app = read('src/App.tsx');

    expect(recovery).toContain('pub package_fingerprint: Option<String>');
    expect(recovery).toContain('"package_fingerprint"');
    expect(recovery).toContain('bind_package_fingerprint');
    expect(recovery).toContain('verify_job_fingerprint');

    expect(backend).toContain('package_fingerprint: Option<String>');
    expect(backend).toContain('Recovery package binding failed');
    expect(backend).toContain('Recovery job fingerprint no longer matches its prepared artifacts/package identity');
    expect(backend).toContain('"packageFingerprint": job.package_fingerprint.clone()');

    expect(desktop).toContain('packageFingerprint?: string | null');
    expect(desktop).toContain('packageFingerprint: packageFingerprint?.trim() || null');

    expect(app).toContain('bundle.packageFingerprint');
    expect(app).toContain('const job = await prepareRecoveryJob(selectedRecoveryCandidate, paths);');
  });
});


describe('Automated hardware-flow qualification preflight', () => {
  it('collapses repeatable qualification evidence into one gate matrix without faking physical bench checks', () => {
    const dossier = read('src/components/QualificationDossier.tsx');

    expect(dossier).toContain('RUN ALL AUTOMATED GATES');
    expect(dossier).toContain('AUTOMATED EVIDENCE READY');
    expect(dossier).toContain('automatedEvidenceReady');
    expect(dossier).toContain('sourceRevisionAvailable');
    expect(dossier).toContain('qualifiedFlashCompiled');
    expect(dossier).toContain('workstation.blockers.length === 0');
    expect(dossier).toContain('selectedMatchesPreparedIdentity');
    expect(dossier).toContain('transportObservationLooksStable');
    expect(dossier).toContain("target.mode === 'qualcomm-edl' && !authorized.length");
    expect(dossier).toContain('Complete automated preflight first');
    expect(dossier).toContain('does not substitute for the destructive bench-write and post-write physical checks');
  });
});


describe('Qualcomm qualification programmer evidence', () => {
  it('requires a valid authorized programmer for Qualcomm EDL binding only', () => {
    const backend = read('src-tauri/src/main.rs');

    expect(backend).toContain('qualification_programmer_evidence_ready');
    expect(backend).toContain('device.mode != "qualcomm-edl"');
    expect(backend).toContain('programmer.authorized');
    expect(backend).toContain('valid_sha256_hex(&programmer.sha256)');
    expect(backend).toContain('programmer.bytes > 0');
    expect(backend).toContain('authorization_source');
    expect(backend).toContain('Qualcomm EDL qualification requires an authorized programmer record');
  });
});


describe('Qualification dossier semantic review and evidence-derived flash checks', () => {
  it('recomputes hash-bound evidence semantics and prevents manual approval of automated checks', () => {
    const backend = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');
    const consoleUi = read('src/components/QualifiedFlashConsole.tsx');

    expect(backend).toContain('binding_semantics_valid');
    expect(backend).toContain('liveDeviceIdentityMatch');
    expect(backend).toContain('workstationEvidenceReady');
    expect(backend).toContain('transportObservationReady');
    expect(backend).toContain('programmerEvidenceReady');
    expect(backend).toContain('.device_family');
    expect(backend).toContain('declared device family');
    expect(read('src-tauri/src/edl_programmer_vault.rs')).toContain('authorized EDL programmer enrollment requires a declared device family');
    expect(backend).toContain('Dossier qualification-binding claim is inconsistent');

    expect(desktop).toContain('bindingSemanticsValid');
    expect(desktop).toContain('programmerEvidenceReady');

    expect(consoleUi).toContain('EVIDENCE_DERIVED_CHECKS');
    expect(consoleUi).toContain("result.bindingSemanticsValid && result.transportObservationReady");
    expect(consoleUi).toContain("result.bindingSemanticsValid && result.programmerEvidenceReady");
    expect(consoleUi).toContain('disabled={automated}');
    expect(consoleUi).toContain("{automated ? 'AUTO' : 'MANUAL'}");
    expect(consoleUi).toContain('cannot be clicked manually');
    expect(desktop).toContain('reviewQualificationDossierPath');
    expect(desktop).toContain('reviewQualificationAuditBundlePath');
    expect(consoleUi).toContain('reviewQualificationAuditBundlePath(path, recoveryJobFingerprint)');
    expect(consoleUi).toContain('auditBundleReview?.safeToReview');
    expect(consoleUi).toContain('auditBundlePath: auditBundleReview?.safeToReview ? auditBundleReview.path : null');
    expect(backend).toContain('Production-qualified grant requires a verified qualification audit bundle');
    expect(backend).toContain('bootforge_qualification_audit_bundle_review');
    expect(backend).toContain('auditBundleFingerprint: Some(audit_bundle_fingerprint.clone())');
    expect(backend).toContain('"auditBundleFingerprint": grant.auditBundleFingerprint');
    expect(backend).toContain('Production-qualified grant is missing its audit-bundle fingerprint');
    expect(desktop).toContain('auditBundleFingerprint?: string | null');
    expect(consoleUi).toContain('/^[a-f0-9]{64}$/i.test(grant.auditBundleFingerprint)');
    expect(consoleUi).toContain('Audit bundle binding:');
    expect(consoleUi).toContain('review?.dossierFingerprint');
    expect(consoleUi).toContain('readinessCertificatePath,');
  });
});


describe('macOS signed notarized release contract', () => {
  it('keeps Developer ID signing and notarization behind an explicit credential-gated release lane', () => {
    const workflow = read('.github/workflows/bobfwtools-macos-release.yml');
    const notarize = read('scripts/notarize-bobfwtools.sh');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('BOBFW_DEVELOPER_ID_P12_BASE64');
    expect(workflow).toContain('APPLE_APP_SPECIFIC_PASSWORD');
    expect(workflow).toContain('Import Developer ID certificate');
    expect(workflow).toContain('Cleanup temporary signing material');
    expect(workflow).not.toContain('tauri:build:macos:qualified:ci');

    expect(notarize).toContain('xcrun notarytool submit');
    expect(notarize).toContain('[[ "$STATUS" == "Accepted" ]]');
    expect(notarize).toContain('xcrun stapler staple');
    expect(notarize).toContain('xcrun stapler validate');
    expect(notarize).toContain('spctl -a -vv --type execute');

    const releaseReceipt = read('scripts/create-bobfwtools-release-receipt.sh');
    expect(workflow).toContain('Create release provenance receipt');
    expect(workflow).toContain('Sanitize release label');
    expect(workflow).toContain("tr -cs 'A-Za-z0-9._-' '-'");
    expect(workflow).toContain('steps.release_label.outputs.safe');
    expect(workflow).toContain('actions/checkout@v7');
    expect(workflow).toContain('actions/setup-node@v7');
    expect(workflow).toContain('actions/upload-artifact@v7');
    expect(workflow).toContain('package-manager-cache: false');
    expect(workflow).toContain('bobfwtools-release-receipt.json');
    expect(releaseReceipt).toContain('com.bobbyblanco.bobfwtools.release-receipt.v1');
    expect(releaseReceipt).toContain('"qualifiedDestructiveWriterIncluded": False');
    expect(releaseReceipt).toContain('"submissionId": submission_id');
    expect(releaseReceipt).toContain('"gatekeeperAccepted": True');
    expect(releaseReceipt).toContain('"executableSha256": binary_sha256');
    const signScript = read('scripts/sign-bobfwtools-developer-id.sh');
    expect(workflow).toContain('BOBFW_EXPECTED_TEAM_ID');
    expect(signScript).toContain('Developer ID TeamIdentifier does not match the expected Apple team');
  });
});


describe('One-click hardware flow readiness orchestrator', () => {
  it('runs safe probes together and classifies all supported service lanes', () => {
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/HardwareFlowReadiness.tsx');
    const commandCenter = read('src/components/RepairCommandCenter.tsx');

    expect(desktop).toContain('buildHardwareFlowReadinessReport');
    expect(desktop).toContain('Promise.all([');
    expect(desktop).toContain("id: 'adb-service'");
    expect(desktop).toContain("id: 'fastboot'");
    expect(desktop).toContain("id: 'mtp-usb'");
    expect(desktop).toContain("id: 'samsung-download'");
    expect(desktop).toContain("id: 'qualcomm-edl'");
    expect(desktop).toContain("id: 'mediatek-download'");
    expect(desktop).toContain('bundle.planningReady && Boolean(bundle.packageFingerprint)');
    expect(desktop).toContain('Authorized programmer/service-loader evidence and designated-device physical qualification remain required before writes');

    expect(ui).toContain('Run full safe hardware audit');
    expect(ui).toContain('SOFTWARE READY');
    expect(ui).toContain('Hardware write approval gates');
    expect(ui).toContain('REQUIRED FOR WRITE LANES');
    expect(commandCenter).toContain('<HardwareFlowReadiness />');
  });

  it('keeps destructive approval as provable gates instead of an automatic bypass', () => {
    const desktop = read('src/lib/desktop.ts');

    for (const gate of [
      'workstation',
      'driver-claim',
      'device-identity',
      'verified-firmware',
      'recovery-job',
      'backup-rollback',
      'qualification-dossier',
      'bench-evidence',
      'human-decision',
      'audit-bundle',
      'write-authority',
    ]) {
      expect(desktop).toContain(`id: '${gate}'`);
    }
    expect(desktop).toContain('Production grant is intentionally unavailable until all prior hardware gates are satisfied');
    expect(desktop).toContain("id: 'device-identity'");
    expect(desktop).toContain('Transport detection is not exact identity proof.');
    expect(desktop).toContain("title: 'Verified package + exact-device binding'");
    expect(desktop).toContain('this gate stays missing until one package is bound to the independently proven live model/board/SKU');
    expect(desktop).toContain('satisfied: false');
  });
});


describe('Automatic target selection and exact-device firmware withholding', () => {
  it('auto-selects the only live repair target and clears stale selections', () => {
    const commandCenter = read('src/components/RepairCommandCenter.tsx');

    expect(commandCenter).toContain('targets.length === 1 ? targets[0].key :');
    expect(commandCenter).toContain('targets.some((target) => target.key === current)');
  });

  it('does not expose vendor-only firmware as an exact-device recovery match', () => {
    const desktop = read('src/lib/desktop.ts');

    expect(desktop).toContain('intentionally withheld until exact device model/board/SKU identity is independently proven');
    expect(desktop).toContain('Prove exact device model/board/SKU first');
    expect(desktop).toContain("firmwareCandidates: []");
  });
});


describe('Hardware readiness workflow policy binding', () => {
  it('shows authoritative physical qualification state per supported lane', () => {
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/HardwareFlowReadiness.tsx');

    expect(desktop).toContain('workflowPolicies');
    expect(desktop).toContain("workflowPolicyId: 'android.adb-authorized'");
    expect(desktop).toContain("workflowPolicyId: 'samsung.odin-plan'");
    expect(desktop).toContain("workflowPolicyId: 'qualcomm.edl-plan'");
    expect(desktop).toContain("workflowPolicyId: 'mediatek.brom-plan'");
    expect(desktop).toContain("physicallyQualified: workflowPolicy('qualcomm.edl-plan')?.physicallyQualified ?? null");

    expect(ui).toContain('physical qualification');
    expect(ui).toContain("lane.physicallyQualified ? 'complete' : 'pending'");
  });
});


describe('Hardware readiness catalog completeness', () => {
  it('accounts for every active workflow and shows reserved workflows explicitly', () => {
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/HardwareFlowReadiness.tsx');

    expect(desktop).toContain('representedPolicyIds');
    expect(desktop).toContain('item.activeInBobfwtools && !representedPolicyIds.has(item.id)');
    expect(desktop).toContain('Physical qualification is still pending for this workflow.');
    expect(desktop).toContain("state: 'blocked'");

    expect(ui).toContain('Reserved / inactive workflows');
    expect(ui).toContain('.filter((policy) => !policy.activeInBobfwtools)');
    expect(ui).toContain('RESERVED');
  });
});


describe('Exact device identity gate for verified firmware', () => {
  it('withholds firmware until model board and SKU are locked and exactly matched', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('captureRecoveryIdentityFromAdb');
    expect(app).toContain('lockRecoveryIdentity');
    expect(app).toContain('sameIdentityValue(bundle.model, lockedRecoveryIdentity.model)');
    expect(app).toContain('sameIdentityValue(bundle.board, lockedRecoveryIdentity.board)');
    expect(app).toContain('sameIdentityValue(bundle.sku, lockedRecoveryIdentity.sku)');
    expect(app).toContain('trustedForWrite: true');
    expect(app).toContain('trustedForWrite: false');
    expect(app).toContain('PLANNING ONLY');
    expect(app).toContain('WRITE-QUALIFIED');
    expect(app).toContain('NOT LOCKED — verified firmware remains withheld');
    expect(app).toContain('Write-qualified recovery requires independently captured exact device identity.');
    expect(app).toContain('The selected firmware bundle does not exactly match the locked device model/board/SKU identity.');
  });
});


describe('Pending physical qualification queue', () => {
  it('derives bench evidence tasks from every active unqualified workflow policy', () => {
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/HardwareFlowReadiness.tsx');

    expect(desktop).toContain('qualificationQueue');
    expect(desktop).toContain('policy.activeInBobfwtools && !policy.physicallyQualified');
    expect(desktop).toContain('Designated physical-device bench result with post-operation verification');
    expect(desktop).toContain('Verified backup or rollback evidence');
    expect(desktop).toContain('Audit ledger evidence with input/output fingerprints');
    expect(desktop).toContain('qualificationPacketForWorkflow');
    for (const workflowId of [
      'qualcomm.edl-plan',
      'mediatek.brom-plan',
      'calibration.backup',
      'calibration.restore',
      'hardware.storage-identify',
      'hardware.chip-off-plan',
      'bootforge.media',
    ]) {
      expect(desktop).toContain(`'${workflowId}'`);
    }
    expect(desktop).toContain('Execute only the designated one-partition qualification trial');
    expect(desktop).toContain('manual specialist procedure');
    expect(desktop).toContain('destination media identity');

    expect(ui).toContain('Physical qualification queue');
    expect(ui).toContain('BENCH PENDING');
    expect(ui).toContain('Exact target evidence');
    expect(ui).toContain('Host / tooling requirements');
    expect(ui).toContain('Dry-run artifact');
    expect(ui).toContain('Backup / rollback requirement');
    expect(ui).toContain('Designated bench action');
    expect(ui).toContain('Post-operation verification');
    expect(ui).toContain('Policy evidence required');
    expect(ui).toContain('Export packet');
    expect(ui).toContain('Qualification packet exported');
    expect(desktop).toContain('exportHardwareQualificationPacket');
    expect(desktop).toContain('hardware_qualification_packet_export');
  });
});


describe('Machine-readable hardware qualification packet export', () => {
  it('exports bench-pending evidence without granting write authority', () => {
    const backend = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/HardwareFlowReadiness.tsx');

    expect(backend).toContain('hardware_qualification_packet_export');
    expect(backend).toContain('com.bobbyblanco.bobfwtools.hardware-qualification-packet.v1');
    expect(backend).toContain('"executionPerformed": false');
    expect(backend).toContain('"qualificationStatus": "bench-pending"');
    expect(backend).toContain('"packetDoesNotGrantWriteAuthority": true');
    expect(backend).toContain('"packetFingerprint": packet_fingerprint');
    expect(backend).toContain('write-authority-granted:false');
    expect(backend).toContain('hardware_qualification_packet_export,');
    expect(backend).toContain('hardware_qualification_packet_review');
    expect(backend).toContain('Qualification packet fingerprint does not match its payload');
    expect(backend).toContain('review never grants write authority');
    expect(backend).toContain('hardware_qualification_packet_review,');

    expect(desktop).toContain('exportHardwareQualificationPacket');
    expect(desktop).toContain("title: 'Export hardware qualification packet'");
    expect(ui).toContain('Export packet');
  });
});


describe('Bench evidence binds the workflow qualification packet', () => {
  it('requires an integrity-reviewed packet and freezes its fingerprint into bench evidence', () => {
    const backend = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');
    const consoleUi = read('src/components/QualifiedFlashConsole.tsx');

    expect(backend).toContain('qualificationPacketPath: String');
    expect(backend).toContain('hardware_qualification_packet_review(input.qualificationPacketPath.clone())');
    expect(backend).toContain('qualification_packet_fingerprint: String');
    expect(backend).toContain('"qualificationPacketFingerprint": receipt.qualification_packet_fingerprint');
    expect(backend).toContain('Qualification bench evidence qualification-packet fingerprint is missing or malformed');
    expect(backend).toContain('qualification-packet-fingerprint:{}');

    expect(desktop).toContain('reviewHardwareQualificationPacket');
    expect(desktop).toContain('qualificationPacketPath: string');

    expect(consoleUi).toContain('Select + verify qualification packet');
    expect(consoleUi).toContain('PACKET VERIFIED');
    expect(consoleUi).toContain('qualificationPacketReview?.safeToReview');
    expect(consoleUi).toContain('qualificationPacketPath: qualificationPacketReview.path');
  });
});


describe('Qualification packet fingerprint survives to production authority', () => {
  it('binds packet, bench evidence, human decision, audit bundle, grant, and executor validation', () => {
    const backend = read('src-tauri/src/main.rs');
    const desktop = read('src/lib/desktop.ts');

    expect(backend).toContain('qualification_packet_fingerprint: Option<String>');
    expect(backend).toContain('"qualificationPacketFingerprint": receipt.qualification_packet_fingerprint');
    expect(backend).toContain('Decision and bench evidence are bound to different qualification packets');
    expect(backend).toContain('"qualificationPacketFingerprint": bench.qualification_packet_fingerprint');
    expect(backend).toContain('qualification_packet_fingerprint: Option<String>');
    expect(backend).toContain('qualificationPacketFingerprint: Option<String>');
    expect(backend).toContain('Production grant audit bundle is bound to a different qualification packet');
    expect(backend).toContain('Production grant decision is bound to a different qualification packet');
    expect(backend).toContain('qualificationPacketFingerprint: Some(bench_receipt.qualification_packet_fingerprint.clone())');
    expect(backend).toContain('Production-qualified grant is missing its qualification-packet fingerprint');
    expect(backend).toContain('Bench qualification trial must not carry production audit-bundle or qualification-packet authority');
    expect(backend).toContain('qualification-packet-fingerprint:{}');

    expect(desktop).toContain('qualificationPacketFingerprint?: string | null');
  });
});


describe('Audit bundle revalidates qualification packet identity', () => {
  it('requires the same packet fingerprint across bundle, bench evidence, and decision', () => {
    const backend = read('src-tauri/src/main.rs');

    expect(backend).toContain('Audit bundle bench evidence is bound to a different qualification packet');
    expect(backend).toContain('Audit bundle human decision is bound to a different qualification packet');
    expect(backend).toContain('Nested decision and bench evidence reference different qualification packets');
    expect(backend).toContain('Nested bench evidence does not match the audit bundle qualification packet');
  });
});


describe('Diagnostic readiness is distinct from write readiness', () => {
  it('never treats general tooling readiness as destructive write approval', () => {
    const desktop = read('src/lib/desktop.ts');
    const ui = read('src/components/HardwareFlowReadiness.tsx');

    expect(desktop).toContain('writeReady: boolean');
    expect(desktop).toContain("const writeReady = approvalGates");
    expect(desktop).toContain(".filter((gate) => gate.requiredForWrites)");
    expect(desktop).toContain(".every((gate) => gate.satisfied)");

    expect(ui).toContain('Diagnostic software readiness');
    expect(ui).toContain('DIAGNOSTICS READY');
    expect(ui).toContain('Destructive write readiness');
    expect(ui).toContain('WRITE GATES INCOMPLETE');
  });
});
