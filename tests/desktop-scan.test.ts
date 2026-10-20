import {afterEach, expect, test, vi} from 'vitest';
import {invoke} from '@tauri-apps/api/core';
import {createDesktopScanner} from '../src/lib/desktop-scan';
import {createReadOnlyProbeRunner} from '../src/lib/hardware-probes';
import {isAndroidUsbCandidate} from '../src/lib/phone-usb-candidates';
vi.mock('@tauri-apps/api/core', () => ({invoke:vi.fn()}));
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();});
const usb = {deviceUid:'internal-controller', platformHint:'apple', mode:'usb', vendorId:0x05ac, productId:0x8104};
function host(overrides: Record<string, () => unknown> = {}) {
  vi.stubGlobal('window', {__TAURI_INTERNALS__:{}});
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (command:string) => {
    if (command in overrides) return await overrides[command]() as never;
    const replies: Record<string, unknown> = {
      frontend_backend_handshake:{status:'ready'}, bootforgeusb_scan:[usb],
      bootforge_recovery_scan:[], adb_scan:[], fastboot_mode_devices:[],
      mtp_status:{connected:false,storages:[]}, workflow_capabilities:{capabilities:[]},
      firmware_library_scan:{bundles:[]}, workflow_job_list:[],
    };
    if (!(command in replies)) throw new Error('Unexpected command '+command);
    return replies[command] as never;
  });
}
test('host controller and unrelated peripherals never become Android phone candidates', () => {
  expect(isAndroidUsbCandidate(usb)).toBe(false);
  expect(isAndroidUsbCandidate({platformHint:'unknown',mode:'usb'})).toBe(false);
  expect(isAndroidUsbCandidate({platformHint:'android-samsung',mode:'usb'})).toBe(true);
  for (const mode of ['adb','mtp','fastboot','samsung-download','qualcomm-edl','mediatek-brom','mediatek-preloader'])
    expect(isAndroidUsbCandidate({platformHint:'unknown',mode})).toBe(true);
});
test('denied transports retain USB evidence, invalidate stale capabilities and expose every failure', async () => {
  host({adb_scan:()=>{throw new Error('EPERM');}, fastboot_mode_devices:()=>{throw new Error('EPERM');},
    mtp_status:()=>{throw new Error('No usable MTP device');},
    workflow_capabilities:()=>{throw new Error('Unavailable');}});
  const result = await createDesktopScanner()(0, ['stale']);
  expect(result.usb).toEqual([usb]);
  expect(result.adb).toEqual([]);
  expect(result.mtp).toBeNull();
  expect(result.capabilities).toBeNull();
  expect(result.directory).toEqual({objects:[],storageIndex:0,path:[]});
  expect(result.failures.map(f=>f.probe)).toEqual(['adb','capabilities','fastboot','mtp']);
});
test('a hung native probe bounds the complete scan and is not launched again after a UI timeout', async () => {
  vi.useFakeTimers();
  let resolveAdb!: (devices:unknown[])=>void;
  host({adb_scan:()=>new Promise(resolve=>{resolveAdb=resolve;})});
  const scan=createDesktopScanner(50);
  const first=scan();
  await vi.advanceTimersByTimeAsync(50);
  const snapshot=await first;
  expect(snapshot.failures).toEqual([{probe:'adb',message:'Read-only probe timed out; status is unverified.'}]);
  const second=scan();
  await vi.advanceTimersByTimeAsync(50);
  expect((await second).failures.map(f=>f.probe)).toContain('adb');
  expect(vi.mocked(invoke).mock.calls.filter(([command])=>command==='adb_scan')).toHaveLength(1);
  resolveAdb([{serial:'late',authorized:false}]);
  await vi.advanceTimersByTimeAsync(0);
  expect(snapshot.adb).toEqual([]);
});
test('device-specific mode probes share the same overall deadline', async () => {
  vi.useFakeTimers();
  host({adb_scan:()=>[{serial:'phone-one',authorized:true}],
    adb_mode_capabilities:()=>new Promise(()=>{})});
  const work=createDesktopScanner(75)();
  await vi.advanceTimersByTimeAsync(75);
  const result=await work;
  expect(result.modes).toEqual({});
  expect(result.failures[0].probe).toBe('adb-mode:phone-one');
});
test('failed folder listing falls back to root without retaining another folder contents', async () => {
  host({mtp_status:()=>({connected:true,storages:[{}]}),mtp_list_directory:()=>{throw new Error('Disconnected');}});
  const result=await createDesktopScanner()(99,['old-folder']);
  expect(result.directory).toEqual({objects:[],storageIndex:0,path:[]});
  expect(result.failures.filter(f=>f.probe.startsWith('mtp-directory:'))).toHaveLength(2);
});
test('coalescing releases its slot on rejection so a later safe rescan can retry', async () => {
  const run=createReadOnlyProbeRunner();
  const failures: {probe:string;message:string}[]=[];
  const probe=vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce('real');
  expect(await run('usb',probe,'fallback',failures,50)).toBe('fallback');
  expect(await run('usb',probe,'fallback',failures,50)).toBe('real');
  expect(probe).toHaveBeenCalledTimes(2);
});

test('a late response from an expired scan cannot populate a later scan', async () => {
  vi.useFakeTimers();
  let release!: (value:unknown[])=>void;
  let calls=0;
  host({adb_scan:()=> ++calls===1 ? new Promise(resolve=>{release=resolve;}) :
    [{serial:'fresh-target',authorized:false}]});
  const scan=createDesktopScanner(50);
  const old=scan();
  await vi.advanceTimersByTimeAsync(50);
  expect((await old).adb).toEqual([]);
  const during=await scan();
  expect(during.adb).toEqual([]);
  expect(during.failures).toContainEqual({probe:'adb',
    message:'Previous read-only probe is still running; status is unverified.'});
  release([{serial:'stale-target',authorized:false}]);
  await vi.advanceTimersByTimeAsync(0);
  expect(during.adb).toEqual([]);
  expect((await scan()).adb).toEqual([{serial:'fresh-target',authorized:false}]);
  expect(calls).toBe(2);
});
