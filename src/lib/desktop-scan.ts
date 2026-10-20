import {
  frontendBackendHandshake, getNativeUsbDevices, scanRecoveryCandidates,
  scanAdbDevices, getFastbootModeDevices, getMtpStatus, getWorkflowCapabilities,
  scanFirmwareLibrary, listWorkflowJobs, getAdbModeCapabilities, listMtpDirectory,
  isTauriRuntime, type AdbModeCapabilities, type MtpBrowserObject,
} from './desktop';
import { createReadOnlyProbeRunner, type HardwareProbeFailure } from './hardware-probes';

/** One bounded, read-only scan. Late native results never update a returned snapshot. */
export function createDesktopScanner(timeoutMs = 12000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid scan timeout');
  const runProbe = createReadOnlyProbeRunner();
  return async (storageIndex = 0, path: string[] = []) => {
    const failures: HardwareProbeFailure[] = [];
    const deadline = Date.now() + timeoutMs;
    const probe = <T,>(key: string, run: () => Promise<T>, fallback: T): Promise<T> => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        failures.push({probe:key, message:'Read-only scan deadline reached; status is unverified.'});
        return Promise.resolve(fallback);
      }
      return runProbe(key, run, fallback, failures, remaining);
    };
    const adbTask = probe('adb', () => scanAdbDevices(true), []);
    const mtpTask = probe('mtp', () => getMtpStatus(true), null);
    const modesTask = adbTask.then(async devices => {
      const pairs = await Promise.all(devices.filter(device => device.authorized).map(async device => {
        const mode = await probe<AdbModeCapabilities | null>(
          'adb-mode:' + device.serial, () => getAdbModeCapabilities(device.serial), null);
        return mode ? [device.serial, mode] as const : null;
      }));
      return Object.fromEntries(pairs.filter(
        (pair): pair is readonly [string, AdbModeCapabilities] => pair !== null));
    });
    const directoryTask = mtpTask.then(async mtp => {
      if (!mtp?.connected || !mtp.storages.length) return {objects:[] as MtpBrowserObject[], storageIndex:0, path:[] as string[]};
      const index = Math.max(0, Math.min(storageIndex, mtp.storages.length - 1));
      const list = (parts: string[]) => probe<MtpBrowserObject[] | null>(
        'mtp-directory:' + JSON.stringify([index, parts]), () => listMtpDirectory(index, parts), null);
      const objects = await list(path);
      if (objects !== null) return {objects, storageIndex:index, path};
      return {objects:path.length ? await list([]) ?? [] : [], storageIndex:index, path:[] as string[]};
    });
    const [handshake, usb, recovery, adb, fastboot, mtp, capabilities, firmware, jobs, modes, directory] = await Promise.all([
      probe('handshake', frontendBackendHandshake, null),
      probe('usb', getNativeUsbDevices, []),
      probe('recovery', scanRecoveryCandidates, []),
      adbTask,
      probe('fastboot', getFastbootModeDevices, []),
      mtpTask,
      probe('capabilities', getWorkflowCapabilities, null),
      probe('firmware', scanFirmwareLibrary, null),
      probe('jobs', () => isTauriRuntime() ? listWorkflowJobs() : Promise.resolve([]), []),
      modesTask,
      directoryTask,
    ]);
    failures.sort((a,b) => a.probe.localeCompare(b.probe));
    return {handshake, usb, recovery, adb, fastboot, mtp, capabilities, firmware, jobs, modes, directory, failures};
  };
}
