import {afterEach, expect, test, vi} from 'vitest';
import {invoke} from '@tauri-apps/api/core';
import {runHardwareProbe, type HardwareProbeFailure} from '../src/lib/hardware-probes';
import {buildHardwareFlowReadinessReport} from '../src/lib/desktop';

vi.mock('@tauri-apps/api/core', () => ({invoke: vi.fn()}));
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();});

function host(failing: string[], overrides: Record<string,unknown> = {}) {
  vi.stubGlobal('window', {__TAURI_INTERNALS__:{}});
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (failing.includes(command)) throw new Error('Operation not permitted (os error 1)');
    const replies: Record<string, unknown> = {
      workstation_readiness: {os:'macos',architecture:'x86_64',workspaceRoot:'',workspacePaths:[],
        tools:[],drivers:[],driverStoreProbeAvailable:false,readyForDiagnostics:true,
        readyForAndroidService:true,blockers:[]},
      adb_scan: [],
      fastboot_mode_devices: [],
      mtp_status: {connected:false,manufacturer:'',model:'',serialNumber:'',deviceFamily:'',
        storages:[],capabilities:[],evidenceSource:'native'},
      bootforgeusb_transport_scan: [{deviceUid:'usb-one',vendorId:0x04e8,productId:0x6860,
        mode:'usb',busNumber:1,deviceAddress:1,endpoints:[],bulkIn:[],bulkOut:[]}],
      bootforge_recovery_scan: [],
      firmware_library_scan: {bundles:[]},
      driver_binding_scan: [],
      driver_binding_elevation_status: {required:false,elevated:true,detail:'not Windows'},
      workflow_policy_catalog: [],
      ...overrides,
    };
    if (!(command in replies)) throw new Error('Unexpected command: '+command);
    return replies[command] as never;
  });
}
test('a denied Fastboot probe preserves successful native USB evidence and write gates', async () => {
  host(['fastboot_mode_devices']);
  const report=await buildHardwareFlowReadinessReport();
  expect(report.transportDevices.map(device=>device.deviceUid)).toEqual(['usb-one']);
  expect(report.probeFailures).toEqual([{probe:'fastboot',message:'Operation not permitted (os error 1)'}]);
  expect(report.lanes.find(lane=>lane.id==='fastboot')?.blockers.join(' ')).toContain('probe unavailable');
  expect(report.lanes.find(lane=>lane.id==='samsung-download')?.detected).toBe(false);
  expect(report.softwareReady).toBe(false);
  expect(report.writeReady).toBe(false);
});
test('strict audit probes expose ADB/MTP failures and cannot prove an unavailable driver claim', async () => {
  host(['adb_scan','mtp_status','driver_binding_scan']);
  const report=await buildHardwareFlowReadinessReport();
  expect(report.probeFailures.map(failure=>failure.probe)).toEqual(['adb','drivers','mtp']);
  expect(report.approvalGates.find(gate=>gate.id==='driver-claim')?.satisfied).toBe(false);
  expect(report.approvalGates.find(gate=>gate.id==='driver-claim')?.detail).toContain('unverified');
  expect(report.transportDevices).toHaveLength(1);
  expect(report.writeReady).toBe(false);
});
test('a stalled read-only probe releases the UI wait with explicit unverified status', async () => {
  vi.useFakeTimers();
  const failures: HardwareProbeFailure[]=[];
  const result=runHardwareProbe('mtp',()=>new Promise<null>(()=>{}),null,failures,50);
  await vi.advanceTimersByTimeAsync(50);
  expect(await result).toBeNull();
  expect(failures).toEqual([{probe:'mtp',message:'Read-only probe timed out; status is unverified.'}]);
});

const policy=(id:string,activeInBobfwtools:unknown=true)=>({
  id,category:'test',platform:'android',risk:'destructive',authorizationRequired:true,
  deviceIdentityVerification:true,dryRunSupported:true,backupOrRollbackRequired:true,
  auditLoggingRequired:true,explicitConfirmationRequired:true,physicallyQualified:true,
  activeInBobfwtools,notes:'Synthetic policy; no device evidence.',
});
test('catalog claims cannot qualify the current device or remove its bench task', async () => {
  host([], {workflow_policy_catalog:[
    policy('android.adb-authorized'),policy('samsung.odin-plan'),
    policy('qualcomm.edl-plan'),policy('mediatek.brom-plan'),
  ]});
  const report=await buildHardwareFlowReadinessReport();
  expect(report.qualificationQueue).toHaveLength(4);
  expect(report.qualificationQueue.every(row=>row.softwareImplemented && row.physicallyQualified===false)).toBe(true);
  for(const id of ['adb-service','samsung-download','qualcomm-edl','mediatek-download'])
    expect(report.lanes.find(row=>row.id===id)?.physicallyQualified).toBeNull();
  expect(report.writeReady).toBe(false);
});
test('missing executors and malformed activation flags never become available workflows', async () => {
  host([], {workflow_policy_catalog:[
    policy('diagnostics.usb-scan'),policy('calibration.restore'),policy('apple.dfu'),
    policy('unknown.workflow'),policy('calibration.backup','true'),
  ]});
  const report=await buildHardwareFlowReadinessReport();
  expect(report.qualificationQueue.map(row=>row.workflowId)).toEqual(['diagnostics.usb-scan']);
  expect(report.lanes.some(row=>['calibration.restore','apple.dfu','unknown.workflow','calibration.backup'].includes(row.workflowPolicyId || ''))).toBe(false);
  expect(report.writeReady).toBe(false);
});
test('implemented planning workflows retain every independent bench evidence requirement', async () => {
  host([], {workflow_policy_catalog:[policy('qualcomm.edl-plan')]});
  const report=await buildHardwareFlowReadinessReport();
  const task=report.qualificationQueue[0];
  expect(task.workflowId).toBe('qualcomm.edl-plan');
  expect(task.requiredEvidence).toEqual(expect.arrayContaining([
    'Operator/device authorization evidence',
    'Exact target identity evidence immediately before execution',
    'Dry-run / planning receipt using the exact intended inputs',
    'Verified backup or rollback evidence',
    'Audit ledger evidence with input/output fingerprints',
    'Explicit human confirmation tied to the exact target',
    'Designated physical-device bench result with post-operation verification',
  ]));
  expect(task.targetEvidence.length).toBeGreaterThan(0);
  expect(task.postVerification.length).toBeGreaterThan(0);
  expect(task.physicallyQualified).toBe(false);
  expect(report.writeReady).toBe(false);
});
