import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export type MtpStorageSummary = {
  description: string;
  freeSpaceBytes: number;
};

export type MtpStatus = {
  connected: boolean;
  manufacturer: string;
  model: string;
  serialNumber: string;
  deviceFamily: string;
  storages: MtpStorageSummary[];
  capabilities: string[];
  evidenceSource: string;
};

export type MtpRootObject = {
  handle: string;
  filename: string;
  isFolder: boolean;
};

export type UsbDeviceRecord = {
  deviceUid: string;
  vendorId: number;
  productId: number;
  manufacturer?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  class: number;
  subclass: number;
  protocol: number;
  busNumber: number;
  deviceAddress: number;
  speed: string;
  platformHint: string;
  mode: string;
  transport: string;
  evidenceSource: string;
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getNativeUsbDevices(): Promise<UsbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<UsbDeviceRecord[]>('bootforgeusb_scan');
}

export async function getMtpStatus(): Promise<MtpStatus | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<MtpStatus>('mtp_status');
  } catch {
    return null;
  }
}

export async function listMtpRoot(storageIndex: number): Promise<MtpRootObject[]> {
  if (!isTauriRuntime()) return [];
  return invoke<MtpRootObject[]>('mtp_list_root', { storageIndex });
}

export { isTauriRuntime };


export type MtpTransferResult = {
  operation: 'upload' | 'download';
  filename: string;
  bytes: number;
  verified: boolean;
  destination: string;
  evidenceSource: string;
};

export async function chooseUploadSource(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Choose a file to send to Android',
  });
  return typeof selected === 'string' ? selected : null;
}

export async function chooseDownloadDestination(defaultName: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return save({
    title: 'Save Android file to Mac',
    defaultPath: defaultName,
  });
}

export async function uploadMtpFile(
  storageIndex: number,
  sourcePath: string,
  parentHandle?: string | null,
): Promise<MtpTransferResult> {
  return invoke<MtpTransferResult>('mtp_upload_file', {
    storageIndex,
    sourcePath,
    parentHandle: parentHandle ?? null,
  });
}

export async function downloadMtpFile(
  storageIndex: number,
  handle: string,
  destinationPath: string,
): Promise<MtpTransferResult> {
  return invoke<MtpTransferResult>('mtp_download_file', {
    storageIndex,
    handle,
    destinationPath,
  });
}


export type AdbDeviceRecord = {
  serial: string;
  state: string;
  details: string[];
  authorized: boolean;
  evidenceSource: string;
};

export type AdbDeviceInfo = {
  serial: string;
  properties: Record<string, string>;
  verified: boolean;
  evidenceSource: string;
};

export type AdbTextResult = {
  serial: string;
  workflow: string;
  output: string;
  verified: boolean;
  evidenceSource: string;
};

export type AdbFileResult = {
  serial: string;
  workflow: string;
  destination: string;
  bytes: number;
  verified: boolean;
  evidenceSource: string;
};

export async function scanAdbDevices(): Promise<AdbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  try {
    return await invoke<AdbDeviceRecord[]>('adb_scan');
  } catch {
    return [];
  }
}

export async function getAdbDeviceInfo(serial: string): Promise<AdbDeviceInfo> {
  return invoke<AdbDeviceInfo>('adb_device_info', { serial });
}

export async function getAdbLogcatSnapshot(serial: string, lines = 250): Promise<AdbTextResult> {
  return invoke<AdbTextResult>('adb_logcat_snapshot', { serial, lines });
}

export async function saveAdbScreenshot(serial: string): Promise<AdbFileResult | null> {
  if (!isTauriRuntime()) return null;
  const destination = await save({
    title: 'Save Android screenshot to Mac',
    defaultPath: 'android-screenshot.png',
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
  if (!destination) return null;
  return invoke<AdbFileResult>('adb_screenshot', { serial, destinationPath: destination });
}


export type WorkflowCapability = {
  id: string;
  transport: string;
  enabled: boolean;
  reason: string;
  evidence: string[];
};

export type DeviceCapabilityMatrix = {
  usbDevicesSeen: number;
  adbDevicesSeen: number;
  mtpConnected: boolean;
  workflows: WorkflowCapability[];
};

export async function getWorkflowCapabilities(): Promise<DeviceCapabilityMatrix | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DeviceCapabilityMatrix>('workflow_capabilities');
}


export type AdbActionResult = {
  serial: string;
  workflow: string;
  accepted: boolean;
  verified: boolean;
  message: string;
  evidenceSource: string;
};

export async function prepareAdb(): Promise<AdbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<AdbDeviceRecord[]>('adb_prepare');
}

export async function getAdbBatteryInfo(serial: string): Promise<AdbTextResult> {
  return invoke<AdbTextResult>('adb_battery_info', { serial });
}

export async function rebootAdbDevice(
  serial: string,
  mode: 'normal' | 'recovery' | 'bootloader' | 'download',
): Promise<AdbActionResult> {
  return invoke<AdbActionResult>('adb_reboot_mode', { serial, mode });
}

export async function openAndroidNetworkSettings(serial: string): Promise<AdbActionResult> {
  return invoke<AdbActionResult>('adb_open_network_settings', { serial });
}

export async function openAndroidFactoryResetSettings(serial: string): Promise<AdbActionResult> {
  return invoke<AdbActionResult>('adb_open_factory_reset_settings', { serial });
}

export async function installApkOnDevice(serial: string): Promise<AdbActionResult | null> {
  if (!isTauriRuntime()) return null;
  const apkPath = await open({
    multiple: false,
    directory: false,
    title: 'Choose APK to install',
    filters: [{ name: 'Android package', extensions: ['apk'] }],
  });
  if (typeof apkPath !== 'string') return null;
  return invoke<AdbActionResult>('adb_install_apk', { serial, apkPath });
}


export type AdbPackageRecord = {
  packageName: string;
};

export async function listAdbUserPackages(serial: string): Promise<AdbPackageRecord[]> {
  return invoke<AdbPackageRecord[]>('adb_list_user_packages', { serial });
}

export async function runAdbPackageAction(
  serial: string,
  packageName: string,
  action: 'enable' | 'disable-user' | 'clear-data' | 'uninstall-user',
): Promise<AdbActionResult> {
  return invoke<AdbActionResult>('adb_package_action', { serial, packageName, action });
}


export type DiagnosticEvidence = {
  source: string;
  detail: string;
};

export type DiagnosticFinding = {
  id: string;
  severity: 'ok' | 'warning' | 'error';
  title: string;
  detail: string;
  recommendation: string | null;
};

export type UsbConnectionSummary = {
  vendorId: number;
  productId: number;
  manufacturer: string | null;
  productName: string | null;
  serialNumber: string | null;
  platformHint: string;
  mode: string;
  busNumber: number;
  deviceAddress: number;
  speed: string;
  evidenceSource: string;
};

export type DiagnosticDeviceSummary = {
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  androidVersion: string | null;
  sdk: string | null;
  securityPatch: string | null;
  bootloader: string | null;
  verifiedBootState: string | null;
  batterySummary: string | null;
};

export type PhoneDiagnosticReport = {
  usbDevicesSeen: number;
  androidUsbDevicesSeen: number;
  usbConnections: UsbConnectionSummary[];
  connectionGrade: 'excellent' | 'usable' | 'limited' | 'none';
  connectionSummary: string;
  adbDevicesSeen: number;
  authorizedAdbDevices: number;
  mtpConnected: boolean;
  fastbootPresent: boolean;
  selectedAdbSerial: string | null;
  device: DiagnosticDeviceSummary;
  availableWorkflows: string[];
  blockedWorkflows: string[];
  findings: DiagnosticFinding[];
  evidence: DiagnosticEvidence[];
};

export async function diagnosePhone(): Promise<PhoneDiagnosticReport> {
  return invoke<PhoneDiagnosticReport>('diagnose_phone');
}


export type WorkflowJobRecord = {
  id: string;
  workflowId: string;
  serial: string | null;
  state: 'running' | 'accepted' | 'completed' | 'failed' | 'cancelled';
  retryOf: string | null;
  startedAtMs: number;
  finishedAtMs: number | null;
  verified: boolean;
  summary: string;
  evidence: string[];
  error: string | null;
};

export async function startWorkflowJob(
  workflowId: string,
  serial?: string | null,
): Promise<WorkflowJobRecord> {
  return invoke<WorkflowJobRecord>('workflow_job_start', { workflowId, serial: serial ?? null });
}

export async function listWorkflowJobs(): Promise<WorkflowJobRecord[]> {
  return invoke<WorkflowJobRecord[]>('workflow_job_list');
}

export async function getWorkflowJob(id: string): Promise<WorkflowJobRecord> {
  return invoke<WorkflowJobRecord>('workflow_job_get', { id });
}


export async function retryWorkflowJob(id: string): Promise<WorkflowJobRecord> {
  return invoke<WorkflowJobRecord>('workflow_job_retry', { id });
}


export type MtpBrowserObject = {
  filename: string;
  path: string[];
  isFolder: boolean;
  sizeBytes: number;
};

export async function listMtpDirectory(
  storageIndex: number,
  path: string[],
): Promise<MtpBrowserObject[]> {
  if (!isTauriRuntime()) return [];
  return invoke<MtpBrowserObject[]>('mtp_list_directory', { storageIndex, path });
}

export async function downloadMtpPath(
  storageIndex: number,
  objectPath: string[],
  destinationPath: string,
): Promise<MtpTransferResult> {
  return invoke<MtpTransferResult>('mtp_download_path', {
    storageIndex,
    objectPath,
    destinationPath,
  });
}

export async function uploadMtpPath(
  storageIndex: number,
  folderPath: string[],
  sourcePath: string,
): Promise<MtpTransferResult> {
  return invoke<MtpTransferResult>('mtp_upload_path', {
    storageIndex,
    folderPath,
    sourcePath,
  });
}


export type CableDoctorReport = {
  grade: 'healthy' | 'limited' | 'unstable' | 'no-device';
  summary: string;
  samples: number;
  androidPresentSamples: number;
  reconnectEvents: number;
  observedSpeeds: string[];
  observedModes: string[];
  adbState: string;
  mtpConnected: boolean;
  fastbootPresent: boolean;
  recommendations: string[];
  evidence: DiagnosticEvidence[];
};

export async function runUsbCableDoctor(): Promise<CableDoctorReport> {
  return invoke<CableDoctorReport>('usb_cable_doctor');
}

export type RecoveryWorkflow = 'qualcomm-edl' | 'mediatek-download';

export type RecoveryCandidate = {
  deviceUid: string;
  vendorId: number;
  productId: number;
  detectedMode: string;
  workflow: RecoveryWorkflow;
  productName?: string | null;
  serialNumber?: string | null;
};

export type RecoveryArtifact = {
  path: string;
  role: string;
  size: number;
  structurallyValid: boolean;
  notes: string[];
};

export type RecoveryPlan = {
  workflow: RecoveryWorkflow;
  protocol: string;
  modeRequired: string;
  executionEnabled: boolean;
  destructive: boolean;
  requiresExplicitApproval: boolean;
  requiresVendorAuthentication: boolean;
  artifacts: RecoveryArtifact[];
  prerequisitesMet: boolean;
  missingPrerequisites: string[];
  safetyChecks: string[];
  warnings: string[];
};

export type RecoveryArtifactDigest = {
  path: string;
  role: string;
  size: number;
  sha256: string;
};

export type RecoveryPartitionOperation = {
  partitionName?: string | null;
  filename: string;
  start?: number | null;
  length?: number | null;
  physicalPartition?: number | null;
  region?: string | null;
  operation: string;
};

export type RecoveryJob = {
  workflow: RecoveryWorkflow;
  protocol: string;
  identity: {
    deviceUid: string;
    vendorId: number;
    productId: number;
    mode: string;
    serialNumber?: string | null;
    busNumber?: number | null;
    deviceAddress?: number | null;
  };
  artifactDigests: RecoveryArtifactDigest[];
  operations: RecoveryPartitionOperation[];
  destructive: boolean;
  requiresExplicitApproval: boolean;
  prerequisitesMet: boolean;
  identityRevalidated: boolean;
  executorQualified: boolean;
  executionReady: boolean;
  blockers: string[];
};

export async function scanRecoveryCandidates(): Promise<RecoveryCandidate[]> {
  if (!isTauriRuntime()) return [];
  return invoke<RecoveryCandidate[]>('bootforge_recovery_scan');
}

export async function chooseRecoveryArtifacts(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    multiple: true,
    directory: false,
    title: 'Choose recovery firmware / service artifacts',
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function buildRecoveryPlan(
  kind: RecoveryWorkflow,
  paths: string[],
): Promise<RecoveryPlan> {
  return invoke<RecoveryPlan>('bootforge_recovery_plan', { kind, paths });
}

export async function prepareRecoveryJob(
  candidate: RecoveryCandidate,
  paths: string[],
): Promise<RecoveryJob> {
  return invoke<RecoveryJob>('bootforge_recovery_prepare', { candidate, paths });
}

export async function revalidateRecoveryJob(job: RecoveryJob): Promise<RecoveryJob> {
  return invoke<RecoveryJob>('bootforge_recovery_revalidate', { job });
}
