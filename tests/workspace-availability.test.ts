import {expect,test} from 'vitest';
import {deriveWorkspaceAvailability,workflowImplementation,resolveObservedDiagnosticTarget,hasMatchingFastbootSerial} from '../src/lib/workspace-availability';
import type {AdbDeviceRecord,MtpStatus,UsbDeviceRecord} from '../src/lib/desktop';
const base={nativeRuntime:true,checking:false,failedProbes:[] as string[],adb:[] as AdbDeviceRecord[],
  usb:[] as UsbDeviceRecord[],mtp:null as MtpStatus|null,fastboot:[] as string[]};
test('host Apple hardware and a claimed brand do not enable phone workflows',()=>{
  const usb={platformHint:'apple',mode:'usb',manufacturer:'Samsung',vendorId:0x05ac,productId:0x8104} as UsbDeviceRecord;
  const result=deriveWorkspaceAvailability({...base,usb:[usb]});
  expect(result.diagnose.state).toBe('setup');expect(result.files.state).toBe('setup');
  expect(result.firmware.state).toBe('planning');
  expect(Object.values(result).every(row=>row.executionAuthorized===false)).toBe(true);
});
test('an observed Android USB connection permits read checks without claiming ADB or files',()=>{
  const result=deriveWorkspaceAvailability({...base,usb:[{platformHint:'android-generic',mode:'usb'} as UsbDeviceRecord]});
  expect(result.diagnose.state).toBe('available');expect(result.files.state).toBe('setup');
});
test('unauthorized or truthy malformed ADB authorization never enables app actions',()=>{
  for(const authorized of [false,'true',1]){
    const result=deriveWorkspaceAvailability({...base,adb:[{serial:'phone',authorized} as AdbDeviceRecord]});
    expect(result.files.state).toBe('setup');
  }
});
test('one denied transport does not erase an independent real MTP connection',()=>{
  const result=deriveWorkspaceAvailability({...base,failedProbes:['adb','fastboot'],mtp:{connected:true,targetId:'a'.repeat(64)} as MtpStatus});
  expect(result.files.state).toBe('available');expect(result.diagnose.state).toBe('unverified');
});
test('rescans and browser previews never advertise current hardware readiness',()=>{
  expect(deriveWorkspaceAvailability({...base,checking:true}).files.state).toBe('unverified');
  expect(Object.values(deriveWorkspaceAvailability({...base,nativeRuntime:false})).every(row=>row.state==='unavailable')).toBe(true);
});
test('Fastboot and package inspection do not imply file access or flash authorization',()=>{
  const result=deriveWorkspaceAvailability({...base,fastboot:['serial']});
  expect(result.diagnose.state).toBe('available');expect(result.files.state).toBe('setup');
  expect(result.firmware).toMatchObject({state:'planning',executionAuthorized:false});
});
test('catalog entries without an active executor remain unavailable',()=>{
  for(const id of ['apple.dfu','calibration.restore','hardware.chip-off-plan','bootforge.media','unknown.workflow'])
    expect(workflowImplementation(id)).toBeNull();
  for(const id of ['samsung.odin-plan','qualcomm.edl-plan','mediatek.brom-plan'])
    expect(workflowImplementation(id)).toBe('planning');
  expect(workflowImplementation('calibration.backup')).toBe('backup');
});

const reviewed={deviceUid:'observed-1',vendorId:0x04e8,productId:0x6860,
  serialNumber:'target-1',mode:'adb',platformHint:'android-samsung'} as UsbDeviceRecord;
const observation={nativeRuntime:true,checking:false,scanCompleted:true,failedProbes:[] as string[],usb:[reviewed],reviewed};
test('a reviewed profile routes only through the latest matching USB observation',()=>{
  const current={...reviewed,productName:'Fresh observation'};
  expect(resolveObservedDiagnosticTarget({...observation,usb:[current]})).toBe(current);
});
test('missing, failed, in-progress and preview observations cannot reuse a saved diagnosis',()=>{
  for(const change of [{nativeRuntime:false},{checking:true},{scanCompleted:false},
    {failedProbes:['usb']},{usb:[]},{reviewed:null}])
    expect(resolveObservedDiagnosticTarget({...observation,...change})).toBeNull();
});
test('a different target, mode, product or serial invalidates saved workflow routing',()=>{
  for(const change of [{deviceUid:'other'},{mode:'samsung-download'},{productId:0x685d},
    {vendorId:0x05ac},{serialNumber:'other'}])
    expect(resolveObservedDiagnosticTarget({...observation,usb:[{...reviewed,...change}]})).toBeNull();
});
test('built-in host components cannot become a phone through a saved diagnostic record',()=>{
  const internal={...reviewed,vendorId:0x05ac,productId:0x8104,mode:'usb',platformHint:'apple'};
  expect(resolveObservedDiagnosticTarget({...observation,reviewed:internal,usb:[internal]})).toBeNull();
});

test('Fastboot guidance requires this exact descriptor serial, not another connected phone',()=>{
  expect(hasMatchingFastbootSerial({serialNumber:'selected'},['another'])).toBe(false);
  expect(hasMatchingFastbootSerial({serialNumber:'selected'},[])).toBe(false);
  for(const serialNumber of ['',null,undefined])
    expect(hasMatchingFastbootSerial({serialNumber},['another'])).toBe(false);
  expect(hasMatchingFastbootSerial({serialNumber:' selected '},['another','selected'])).toBe(true);
});

test('a connected MTP claim without a USB target never enables file workflows',()=>{
  for(const targetId of [undefined,'','Microsoft NVMe Direct Disk v2','A'.repeat(64)]) {
    const result=deriveWorkspaceAvailability({...base,mtp:{connected:true,targetId} as MtpStatus});
    expect(result.files.state).toBe('setup');
    expect(result.diagnose.state).toBe('setup');
  }
});
