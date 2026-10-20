import {expect,test} from 'vitest';
import {deriveWorkspaceAvailability,workflowImplementation} from '../src/lib/workspace-availability';
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
  const result=deriveWorkspaceAvailability({...base,failedProbes:['adb','fastboot'],mtp:{connected:true} as MtpStatus});
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
