import type { AdbDeviceRecord, MtpStatus, UsbDeviceRecord } from './desktop';
import { isAndroidUsbCandidate } from './phone-usb-candidates';

export type WorkspaceTaskState = 'available' | 'setup' | 'planning' | 'unverified' | 'unavailable';
export type WorkspaceTaskAvailability = {
  state: WorkspaceTaskState; label: string; detail: string; executionAuthorized: false;
};
export type WorkspaceTaskId = 'diagnose' | 'files' | 'firmware';
const status = (state: WorkspaceTaskState, label: string, detail: string): WorkspaceTaskAvailability =>
  ({state, label, detail, executionAuthorized:false});

export function deriveWorkspaceAvailability(input: {
  nativeRuntime: boolean; checking: boolean; failedProbes: string[];
  adb: AdbDeviceRecord[]; usb: UsbDeviceRecord[]; mtp: MtpStatus | null; fastboot: string[];
}): Record<WorkspaceTaskId, WorkspaceTaskAvailability> {
  if (!input.nativeRuntime) return {
    diagnose:status('unavailable','Desktop required','Open the desktop app to inspect real connections.'),
    files:status('unavailable','Desktop required','Real file and app operations require the desktop app.'),
    firmware:status('unavailable','Desktop required','Package inspection requires the native file picker.'),
  };
  if (input.checking) return {
    diagnose:status('unverified','Checking','Connection evidence is being refreshed.'),
    files:status('unverified','Checking','File and app connections are being checked.'),
    firmware:status('planning','Inspection only','Package inspection never authorizes a device write.'),
  };
  const adbReady = !input.failedProbes.includes('adb') && input.adb.some(device => device.authorized === true);
  const mtpReady = !input.failedProbes.includes('mtp') && input.mtp?.connected === true;
  const phoneSeen = input.usb.some(isAndroidUsbCandidate) || input.adb.length > 0 || input.fastboot.length > 0 || mtpReady;
  return {
    diagnose: input.failedProbes.some(name => ['usb','adb','mtp','fastboot'].includes(name))
      ? status('unverified','Check setup','Some connection checks are unavailable. Open diagnostics for the exact reason.')
      : phoneSeen ? status('available','Read checks','Inspect observed connections and verified device information.')
      : status('setup','Connect a phone','Use a data cable, then rescan. A brand name alone does not establish support.'),
    files:mtpReady || adbReady
      ? status('available',mtpReady ? 'File connection' : 'Authorized ADB','Operations use the connection and device named in the Files & apps view.')
      : input.failedProbes.some(name => ['mtp','adb'].includes(name))
        ? status('unverified','Connection unverified','Resolve the failed connection checks before using device actions.')
        : status('setup','Connection needed','File browsing needs MTP. App management needs authorized ADB.'),
    firmware:status('planning','Inspection only','Supported package inspection and recovery planning are separate from device flashing.'),
  };
}

// Presence in the policy catalog is not an executable implementation or device qualification.
export function workflowImplementation(id: string): 'read' | 'backup' | 'planning' | null {
  switch (id) {
    case 'diagnostics.usb-scan':
    case 'android.adb-authorized': return 'read';
    case 'calibration.backup': return 'backup';
    case 'samsung.odin-plan':
    case 'qualcomm.edl-plan':
    case 'mediatek.brom-plan': return 'planning';
    default:return null;
  }
}

/** A saved diagnostic profile cannot make a disconnected or changed target current. */
export function resolveObservedDiagnosticTarget(input: {
  nativeRuntime:boolean; checking:boolean; scanCompleted:boolean; failedProbes:string[];
  usb:UsbDeviceRecord[];
  reviewed:Pick<UsbDeviceRecord,'deviceUid'|'vendorId'|'productId'|'mode'|'serialNumber'>|null;
}):UsbDeviceRecord|null {
  const {reviewed}=input;
  if(!input.nativeRuntime || input.checking || !input.scanCompleted ||
    input.failedProbes.includes('usb') || !reviewed)return null;
  const observed=input.usb.find(device=>device.deviceUid===reviewed.deviceUid);
  if(!observed || !isAndroidUsbCandidate(observed))return null;
  return observed.vendorId===reviewed.vendorId && observed.productId===reviewed.productId &&
    observed.mode===reviewed.mode &&
    (observed.serialNumber?.trim() || '')===(reviewed.serialNumber?.trim() || '')
    ? observed : null;
}

export function hasMatchingFastbootSerial(
  target:Pick<UsbDeviceRecord,'serialNumber'>, serials:string[],
):boolean {
  const serial=target.serialNumber?.trim();
  return Boolean(serial && serials.includes(serial));
}
