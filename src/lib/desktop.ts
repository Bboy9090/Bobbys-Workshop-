import { runHardwareProbe, type HardwareProbeFailure } from './hardware-probes';
import { isSamsungDownloadTransport } from './hardware-lane-visibility';
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

export type FrontendBackendHandshake = {
  protocol: string;
  backend: string;
  status: 'ready' | string;
  greeting: string;
  correlation_id: string;
};

export async function frontendBackendHandshake(): Promise<FrontendBackendHandshake | null> {
  if (!isTauriRuntime()) return null;
  return invoke<FrontendBackendHandshake>('frontend_backend_handshake');
}

export async function getNativeUsbDevices(): Promise<UsbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<UsbDeviceRecord[]>('bootforgeusb_scan');
}

export type FastbootModeActionResult = {
  serial: string;
  requestedMode: string;
  accepted: boolean;
  verified: boolean;
  message: string;
  evidenceSource: string;
};

export async function getFastbootModeDevices(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>('fastboot_mode_devices');
}

export async function fastbootRebootMode(
  serial: string,
  mode: 'normal' | 'bootloader' | 'recovery',
): Promise<FastbootModeActionResult> {
  return invoke<FastbootModeActionResult>('fastboot_reboot_mode', { serial, mode });
}

export type ModeTransitionVerification = {
  serial: string;
  requestedMode: string;
  observedMode?: string | null;
  verified: boolean;
  identityConfidence: string;
  evidence: string[];
  blockers: string[];
};

export async function verifyModeTransition(
  serial: string,
  requestedMode: 'normal' | 'recovery' | 'bootloader' | 'download',
): Promise<ModeTransitionVerification> {
  return invoke<ModeTransitionVerification>('mode_transition_verify', { serial, requestedMode });
}

export async function getMtpStatus(strict = false): Promise<MtpStatus | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<MtpStatus>('mtp_status');
  } catch (error) {
    if (strict) throw error;
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

export type AdbModeCapabilities = {
  serial: string;
  manufacturer: string;
  model: string;
  normal: boolean;
  recovery: boolean;
  bootloader: boolean;
  download: boolean;
  qualcommEdl: boolean;
  mediatekBrom: boolean;
  notes: string[];
};

export async function getAdbModeCapabilities(serial: string): Promise<AdbModeCapabilities> {
  return invoke<AdbModeCapabilities>('adb_mode_capabilities', { serial });
}

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

export async function scanAdbDevices(strict = false): Promise<AdbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  try {
    return await invoke<AdbDeviceRecord[]>('adb_scan');
  } catch (error) {
    if (strict) throw error;
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
  deviceUid: string;
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

export async function runUsbCableDoctor(targetDeviceUid?: string | null): Promise<CableDoctorReport> {
  return invoke<CableDoctorReport>('usb_cable_doctor', {
    targetDeviceUid: targetDeviceUid?.trim() || null,
  });
}


export type WorkflowRiskLevel = 'read-only' | 'low' | 'elevated' | 'destructive' | 'restricted';

export type WorkflowPolicy = {
  id: string;
  category: string;
  platform: string;
  risk: WorkflowRiskLevel;
  authorizationRequired: boolean;
  deviceIdentityVerification: boolean;
  dryRunSupported: boolean;
  backupOrRollbackRequired: boolean;
  auditLoggingRequired: boolean;
  explicitConfirmationRequired: boolean;
  physicallyQualified: boolean;
  activeInBobfwtools: boolean;
  notes: string;
};

export async function getWorkflowPolicyCatalog(): Promise<WorkflowPolicy[]> {
  if (!isTauriRuntime()) return [];
  return invoke<WorkflowPolicy[]>('workflow_policy_catalog');
}

export async function getCalibrationPartitionAllowlist(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>('calibration_partition_allowlist');
}

export async function getEdl9008Devices(): Promise<UsbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<UsbDeviceRecord[]>('edl_9008_devices');
}


export type CalibrationBackupResult = {
  deviceUid: string;
  adbSerial: string;
  partition: string;
  resolvedBlockPath: string;
  backupPath: string;
  manifestPath: string;
  expectedBytes: number;
  actualBytes: number;
  sha256: string;
  verified: boolean;
  accessMode: string;
};

export async function chooseCalibrationBackupDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: true,
    title: 'Choose calibration backup folder',
  });
  return typeof selected === 'string' ? selected : null;
}

export async function backupCalibrationPartition(
  adbSerial: string,
  partition: string,
  destinationDir: string,
): Promise<CalibrationBackupResult> {
  return invoke<CalibrationBackupResult>('backup_calibration_partition', {
    adbSerial,
    partition,
    destinationDir,
  });
}


export type EdlProgrammerRecord = {
  path: string;
  sha256: string;
  bytes: number;
  deviceFamily?: string | null;
  authorized: boolean;
  authorizationSource?: string | null;
  enrolledAtUnixMs?: number | null;
};

export async function chooseEdlProgrammer(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Choose OEM/service Firehose programmer',
    filters: [{ name: 'EDL programmer', extensions: ['elf', 'mbn'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function inspectEdlProgrammer(
  path: string,
  deviceFamily?: string | null,
): Promise<EdlProgrammerRecord> {
  return invoke<EdlProgrammerRecord>('edl_inspect_programmer', {
    path,
    deviceFamily: deviceFamily ?? null,
  });
}

export async function enrollEdlProgrammer(
  record: EdlProgrammerRecord,
  authorizationSource: string,
  confirmation: string,
): Promise<EdlProgrammerRecord> {
  return invoke<EdlProgrammerRecord>('edl_enroll_programmer', {
    record,
    authorizationSource,
    confirmation,
  });
}

export async function listEdlProgrammers(): Promise<EdlProgrammerRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<EdlProgrammerRecord[]>('edl_list_programmers');
}


export type DriverElevationStatus = {
  required: boolean;
  elevated: boolean;
  detail: string;
};

export async function getDriverElevationStatus(): Promise<DriverElevationStatus> {
  if (!isTauriRuntime()) {
    return { required: false, elevated: true, detail: 'Windows elevation is not applicable outside the desktop runtime.' };
  }
  return invoke<DriverElevationStatus>('driver_binding_elevation_status');
}

export type DriverBindingRecord = {
  instanceId: string;
  friendlyName: string;
  status: string;
  className: string;
  service?: string | null;
  driverInf?: string | null;
  hardwareIds: string[];
  vendorId?: number | null;
  productId?: number | null;
  expectedFamily: string;
  physicalDeviceKey: string;
  interfaceId?: string | null;
  compositeSiblingCount: number;
  claimHardwareIdVerified: boolean;
  claimMatchScope: string;
  bindingState: string;
  detail: string;
};

export type DriverReleaseResult = {
  instanceId: string;
  released: boolean;
  rescanned: boolean;
  detail: string;
  evidence: string[];
};

export type DriverBindingSnapshot = {
  schema: string;
  createdAtMs: number;
  instanceId: string;
  physicalDeviceKey: string;
  interfaceId?: string | null;
  hardwareIds: string[];
  expectedFamily: string;
  service?: string | null;
  driverInf?: string | null;
  bindingState: string;
  fingerprint: string;
};

export type DriverSnapshotResult = {
  path: string;
  snapshot: DriverBindingSnapshot;
};

export type DriverRollbackPlan = {
  snapshotPath: string;
  exactDevicePresent: boolean;
  hardwareIdentityMatches: boolean;
  priorInfAvailable: boolean;
  snapshotFingerprintValid: boolean;
  rollbackReady: boolean;
  priorInf?: string | null;
  currentInf?: string | null;
  blockers: string[];
  nextSteps: string[];
};

export async function createDriverBindingSnapshot(instanceId: string): Promise<DriverSnapshotResult> {
  return invoke<DriverSnapshotResult>('driver_binding_snapshot', { instanceId });
}

export async function getDriverRollbackPlan(snapshotPath: string): Promise<DriverRollbackPlan> {
  return invoke<DriverRollbackPlan>('driver_binding_rollback_plan', { snapshotPath });
}

export type DriverCleanupRecommendation = {
  instanceId: string;
  infName: string;
  disposition: string;
  reason: string;
  currentClaim: boolean;
  exactInterfaceMatch: boolean;
  compatibilityScore: number;
  matchedHardwareIds: string[];
};

export type DriverCleanupReport = {
  instanceId: string;
  protectedCurrentInf?: string | null;
  recommendations: DriverCleanupRecommendation[];
  safeToConsiderCleanup: boolean;
  summary: string;
  blockers: string[];
};

export async function getDriverCleanupReport(instanceId: string): Promise<DriverCleanupReport> {
  return invoke<DriverCleanupReport>('driver_binding_cleanup_report', { instanceId });
}

export type DriverClaimSample = {
  sample: number;
  present: boolean;
  instanceId?: string | null;
  service?: string | null;
  driverInf?: string | null;
  bindingState?: string | null;
};

export type DriverClaimStabilityReport = {
  requestedInstanceId: string;
  samples: DriverClaimSample[];
  presentSamples: number;
  claimChanges: number;
  disappearanceEvents: number;
  stable: boolean;
  summary: string;
  recommendations: string[];
};

export async function runDriverClaimStabilityTest(instanceId: string): Promise<DriverClaimStabilityReport> {
  return invoke<DriverClaimStabilityReport>('driver_binding_stability_test', { instanceId });
}

export type DriverConflictPlan = {
  instanceId: string;
  expectedFamily: string;
  currentInf?: string | null;
  currentService?: string | null;
  bindingState: string;
  compositeInterface?: string | null;
  siblingCount: number;
  candidateCount: number;
  exactInterfaceCandidateCount: number;
  conflictLevel: string;
  recommendedAction: string;
  nextSteps: string[];
  blockers: string[];
  evidence: string[];
};

export async function getDriverConflictPlan(instanceId: string): Promise<DriverConflictPlan> {
  return invoke<DriverConflictPlan>('driver_binding_conflict_plan', { instanceId });
}

export type InstalledDriverCandidate = {
  instanceId: string;
  infName: string;
  infPath: string;
  matchedHardwareIds: string[];
  exactInterfaceMatch: boolean;
  currentClaim: boolean;
  compatibilityScore: number;
  provider?: string | null;
  driverVersion?: string | null;
  catalogFile?: string | null;
  detail: string;
};

export async function getInstalledDriverCandidates(instanceId: string): Promise<InstalledDriverCandidate[]> {
  if (!isTauriRuntime()) return [];
  return invoke<InstalledDriverCandidate[]>('driver_binding_candidates', { instanceId });
}

export type DriverInfInspection = {
  instanceId: string;
  infPath: string;
  deviceHardwareIds: string[];
  infHardwareIds: string[];
  matchedHardwareIds: string[];
  compatible: boolean;
  expectedFamily: string;
  detail: string;
};

export type DriverRelatchResult = {
  instanceId: string;
  infPath: string;
  snapshotPath?: string | null;
  staged: boolean;
  released: boolean;
  rescanned: boolean;
  verifiedClaim: boolean;
  stabilityVerified: boolean;
  stabilitySummary: string;
  observedService?: string | null;
  observedInf?: string | null;
  detail: string;
  evidence: string[];
};

export async function chooseDriverInf(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Choose Windows USB driver INF',
    filters: [{ name: 'Windows driver INF', extensions: ['inf'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function inspectDriverInf(
  instanceId: string,
  infPath: string,
): Promise<DriverInfInspection> {
  return invoke<DriverInfInspection>('driver_binding_inspect_inf', { instanceId, infPath });
}

export async function stageAndRelatchDriver(
  instanceId: string,
  infPath: string,
): Promise<DriverRelatchResult> {
  return invoke<DriverRelatchResult>('driver_binding_stage_and_relatch', { instanceId, infPath });
}

export async function scanDriverBindings(): Promise<DriverBindingRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<DriverBindingRecord[]>('driver_binding_scan');
}

export async function releaseAndRescanDriverBinding(instanceId: string): Promise<DriverReleaseResult> {
  return invoke<DriverReleaseResult>('driver_binding_release_and_rescan', { instanceId });
}

export type WorkstationToolReadiness = {
  id: string;
  present: boolean;
  requiredForCoreAndroidService: boolean;
  detail: string;
};

export type WorkstationDriverReadiness = {
  id: string;
  applicable: boolean;
  evidenceAvailable: boolean;
  detected: boolean;
  detail: string;
  adminRequiredForInstall: boolean;
};

export type WorkspacePathReadiness = {
  id: string;
  path: string;
  exists: boolean;
};

export type WorkstationReadiness = {
  os: string;
  architecture: string;
  workspaceRoot: string;
  workspacePaths: WorkspacePathReadiness[];
  tools: WorkstationToolReadiness[];
  drivers: WorkstationDriverReadiness[];
  driverStoreProbeAvailable: boolean;
  readyForDiagnostics: boolean;
  readyForAndroidService: boolean;
  blockers: string[];
};

export async function getWorkstationReadiness(): Promise<WorkstationReadiness> {
  return invoke<WorkstationReadiness>('workstation_readiness');
}

export async function initializeWorkstation(): Promise<WorkstationReadiness> {
  return invoke<WorkstationReadiness>('workstation_initialize');
}


export type HardwareFlowReadinessLane = {
  id: string;
  title: string;
  workflowPolicyId?: string | null;
  physicallyQualified?: boolean | null;
  state: 'ready' | 'guided' | 'blocked';
  automation: 'automatic-read-only' | 'guided-safe-action' | 'qualified-destructive';
  detected: boolean;
  applicableDevices: string[];
  firmwareCandidates: string[];
  blockers: string[];
  nextSteps: string[];
};

export type HardwareQualificationTask = {
  workflowId: string;
  category: string;
  risk: WorkflowRiskLevel;
  softwareImplemented: boolean;
  physicallyQualified: boolean;
  requiredEvidence: string[];
  targetEvidence: string[];
  hostRequirements: string[];
  dryRunArtifact: string;
  rollbackRequirement: string;
  benchAction: string;
  postVerification: string[];
  notes: string;
};

function qualificationPacketForWorkflow(workflowId: string) {
  const generic = {
    targetEvidence: ['Exact live device identity and transport evidence captured immediately before the bench action.'],
    hostRequirements: ['Required workstation tooling present, exact USB/interface ownership resolved, and current BobFWTools build recorded.'],
    dryRunArtifact: 'Export a dry-run/planning receipt using the exact intended target and inputs before any physical action.',
    rollbackRequirement: 'Document the workflow-specific rollback or recovery path before proceeding.',
    benchAction: 'Run the smallest authorized physical bench action that proves this workflow without broadening scope.',
    postVerification: ['Re-detect the same target.', 'Verify expected state/output.', 'Attach audit fingerprints and operator decision.'],
  };

  const packets: Record<string, typeof generic> = {
    'qualcomm.edl-plan': {
      targetEvidence: ['Qualcomm EDL 9008 target identity, VID/PID, USB path, serial when exposed, and independently proven model/board/SKU.', 'Authorized Firehose programmer/service-loader record bound to the intended device family.'],
      hostRequirements: ['Stable EDL transport with exact driver claim.', 'Qualified Firehose planning path and current recovery executor build recorded.'],
      dryRunArtifact: 'Export the package-bound EDL recovery job and Firehose dry-run/write plan with deterministic firmware and job fingerprints.',
      rollbackRequirement: 'Verified target-specific backup/restore or OEM recovery path must be reviewable before trial authority.',
      benchAction: 'Execute only the designated one-partition qualification trial under qualification-trial authority; no wipe, no automatic reboot, no production grant.',
      postVerification: ['Re-enumerate the exact EDL target.', 'Read back or otherwise verify the trial partition result against the expected digest/size.', 'Export audit bundle and reviewer decision before any production authority.'],
    },
    'mediatek.brom-plan': {
      targetEvidence: ['MediaTek Preloader/BROM target identity, VID/PID, USB path, serial when exposed, and independently proven model/board/SKU.', 'Legitimate OEM/service DA/auth evidence applicable to the exact target.'],
      hostRequirements: ['Stable MediaTek USB transport with exact driver ownership.', 'Current scatter/package inputs and executor build recorded.'],
      dryRunArtifact: 'Export a package-bound MediaTek recovery plan with parsed scatter/partition map, deterministic package fingerprint, and intended single trial partition.',
      rollbackRequirement: 'Verified backup or OEM recovery path for the exact target must exist before trial authority.',
      benchAction: 'Run one explicitly approved partition trial only; do not format, erase broad regions, or escalate around DA/auth requirements.',
      postVerification: ['Re-detect the same target and transport mode.', 'Verify the trial partition result against expected size/hash where readable.', 'Export audit bundle and reviewer decision before production authority.'],
    },
    'calibration.backup': {
      targetEvidence: ['Authorized device identity plus resolved calibration partition/block path from the allowlist.'],
      hostRequirements: ['Required root/service read access verified without bypassing device security controls.', 'Destination storage has enough capacity and is writable.'],
      dryRunArtifact: 'Generate the calibration backup plan showing exact partitions, expected byte counts, destination, and access mode.',
      rollbackRequirement: 'Backup itself is the rollback artifact; its manifest and SHA-256 must be retained with the device identity.',
      benchAction: 'Read and export one approved calibration partition without modifying the device.',
      postVerification: ['Backup byte count matches expectation.', 'Backup SHA-256 is recorded.', 'Manifest binds device UID, partition, path, size, and hash and can pass restore preflight later.'],
    },
    'calibration.restore': {
      targetEvidence: ['Exact live device UID and partition identity matching a previously verified calibration backup manifest.'],
      hostRequirements: ['Required service/write access verified and exact partition allowlist binding intact.'],
      dryRunArtifact: 'Run restore preflight against manifest, live device UID, partition, byte count, and SHA-256 before write authority.',
      rollbackRequirement: 'Preserve the original verified backup plus a second copy or independently verified recovery source before restore.',
      benchAction: 'Restore only the explicitly approved calibration partition bound to the exact manifest and target.',
      postVerification: ['Read back and verify size/hash when supported.', 'Confirm device re-detection and expected calibration/service state.', 'Export audit record tying restore result to the original manifest.'],
    },
    'hardware.storage-identify': {
      targetEvidence: ['Exact physical target identity plus storage bus/device identification evidence.'],
      hostRequirements: ['Read-only identification tooling available and no conflicting USB/storage driver claim.'],
      dryRunArtifact: 'Export a read-only storage identification report before any service action.',
      rollbackRequirement: 'No write action is permitted in this qualification; rollback is not applicable unless a later destructive workflow is opened.',
      benchAction: 'Identify the storage technology/controller and geometry using read-only probes only.',
      postVerification: ['Repeat identification produces the same target/controller result.', 'Attach device identity, transport, and evidence source to the audit record.'],
    },
    'hardware.chip-off-plan': {
      targetEvidence: ['Exact board/device identity, storage package identification, and board-level service authorization.'],
      hostRequirements: ['Documented bench equipment profile, adapter/socket compatibility, and operator safety checklist.'],
      dryRunArtifact: 'Generate a chip-off service plan only; no physical removal or write operation is automated by BobFWTools.',
      rollbackRequirement: 'Document board rework/reassembly and donor/backup strategy before any physical bench procedure.',
      benchAction: 'Qualification is limited to validating the planning packet and hardware identification against a designated bench sample; physical chip removal remains a manual specialist procedure.',
      postVerification: ['Reviewer confirms package/board match and equipment plan.', 'Audit bundle records that BobFWTools performed planning/evidence only, not automated chip removal.'],
    },
    'bootforge.media': {
      targetEvidence: ['Exact destination media identity, capacity, removable status, and selected source image identity.'],
      hostRequirements: ['Exclusive destination claim, source image verification, and sufficient host permissions for raw-media service.'],
      dryRunArtifact: 'Export the media-write plan with source hash, destination identity/capacity, partition/layout intent, and no-execution receipt.',
      rollbackRequirement: 'Confirm the destination is disposable/recoverable and preserve any required user data before qualification.',
      benchAction: 'Write only to the designated removable qualification medium using the approved image and verify no other disk is addressable by the job.',
      postVerification: ['Re-scan the same media identity.', 'Verify resulting partition/layout and source-derived hashes where applicable.', 'Record safe eject/remount result and audit fingerprints.'],
    },
  };

  return packets[workflowId] ?? generic;
}

export async function exportHardwareQualificationPacket(
  task: HardwareQualificationTask,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const destinationPath = await save({
    title: 'Export hardware qualification packet',
    defaultPath: `${task.workflowId.replace(/[^a-zA-Z0-9._-]+/g, '-')}-qualification-packet.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (typeof destinationPath !== 'string' || !destinationPath.trim()) return null;
  return invoke<string>('hardware_qualification_packet_export', {
    packet: task,
    destinationPath,
  });
}

export type HardwareApprovalGate = {
  id: string;
  title: string;
  satisfied: boolean;
  requiredForWrites: boolean;
  detail: string;
};

export type HardwareFlowReadinessReport = {
  probeFailures: HardwareProbeFailure[];
  generatedAtMs: number;
  softwareReady: boolean;
  writeReady: boolean;
  physicalApprovalRequired: boolean;
  approvalGates: HardwareApprovalGate[];
  workflowPolicies: WorkflowPolicy[];
  qualificationQueue: HardwareQualificationTask[];
  workstation: WorkstationReadiness;
  adbDevices: AdbDeviceRecord[];
  fastbootSerials: string[];
  mtpConnected: boolean;
  transportDevices: TransportDevice[];
  recoveryCandidates: RecoveryCandidate[];
  firmwareBundles: FirmwareBundleSummary[];
  driverBindings: DriverBindingRecord[];
  driverElevation: DriverElevationStatus;
  lanes: HardwareFlowReadinessLane[];
  blockers: string[];
};

export async function buildHardwareFlowReadinessReport(): Promise<HardwareFlowReadinessReport> {
  const probeFailures: HardwareProbeFailure[] = [];
  const probe = <T,>(name: string, run: () => Promise<T>, fallback: T) =>
    runHardwareProbe(name, run, fallback, probeFailures);
  const [
    workstation,
    adbDevices,
    fastbootSerials,
    mtp,
    transportDevices,
    recoveryCandidates,
    firmware,
    driverBindings,
    driverElevation,
    workflowPolicies,
  ] = await Promise.all([
    probe('workstation', getWorkstationReadiness, {
      os: 'unverified', architecture: 'unverified', workspaceRoot: '', workspacePaths: [],
      tools: [], drivers: [], driverStoreProbeAvailable: false, readyForDiagnostics: false,
      readyForAndroidService: false, blockers: ['Workstation probe unavailable.'],
    }),
    probe('adb', () => scanAdbDevices(true), []),
    probe('fastboot', getFastbootModeDevices, []),
    probe('mtp', () => getMtpStatus(true), null),
    probe('usb', scanTransportDevices, []),
    probe('recovery', scanRecoveryCandidates, []),
    probe('firmware', scanFirmwareLibrary, null),
    probe('drivers', scanDriverBindings, []),
    probe('elevation', getDriverElevationStatus, {
      required: true, elevated: false, detail: 'Elevation status is unverified.',
    }),
    probe('policies', getWorkflowPolicyCatalog, []),
  ]);
  const bundles = firmware?.bundles ?? [];
  const workflowPolicy = (id: string) => workflowPolicies.find((policy) => policy.id === id) || null;

  const verifiedBundles = bundles.filter(
    (bundle) => bundle.planningReady && Boolean(bundle.packageFingerprint),
  );
  const qualcommBundles = verifiedBundles.filter((bundle) => bundle.vendorHint === 'qualcomm');
  const mediatekBundles = verifiedBundles.filter((bundle) => bundle.vendorHint === 'mediatek');
  const authorizedAdb = adbDevices.filter((device) => device.authorized);
  const unmatchedDrivers = driverBindings.filter((binding) => binding.bindingState !== 'matched');

  const samsungDevices = transportDevices.filter(isSamsungDownloadTransport);
  const qualcommRecovery = recoveryCandidates.filter((candidate) => candidate.workflow === 'qualcomm-edl');
  const mediatekRecovery = recoveryCandidates.filter((candidate) => candidate.workflow === 'mediatek-download');

  const lanes: HardwareFlowReadinessLane[] = [
    {
      id: 'adb-service',
      title: 'ADB authorized service',
      workflowPolicyId: 'android.adb-authorized',
      physicallyQualified: workflowPolicy('android.adb-authorized')?.physicallyQualified ?? null,
      state: authorizedAdb.length && workstation.readyForAndroidService ? 'ready' : 'blocked',
      automation: 'automatic-read-only',
      detected: adbDevices.length > 0,
      applicableDevices: adbDevices.map((device) => device.serial),
      firmwareCandidates: [],
      blockers: [
        ...(!workstation.readyForAndroidService ? workstation.blockers : []),
        ...(adbDevices.length && !authorizedAdb.length ? ['ADB device is present but not authorized.'] : []),
        ...(!adbDevices.length ? ['No ADB device detected.'] : []),
      ],
      nextSteps: authorizedAdb.length
        ? ['Run diagnostics, identity reads, screenshots, logs, package inventory, and safe mode capability checks automatically.']
        : ['Unlock the phone and approve the host RSA prompt when lawful ADB access is available.'],
    },
    {
      id: 'fastboot',
      title: 'Fastboot / bootloader service',
      state: fastbootSerials.length && workstation.readyForAndroidService ? 'ready' : 'blocked',
      automation: 'guided-safe-action',
      detected: fastbootSerials.length > 0,
      applicableDevices: fastbootSerials,
      firmwareCandidates: [],
      blockers: [
        ...(!fastbootSerials.length ? ['No Fastboot device detected.'] : []),
        ...(!workstation.readyForAndroidService ? workstation.blockers : []),
      ],
      nextSteps: ['Keep identity-bound Fastboot actions guided; destructive partition writes remain qualification-gated.'],
    },
    {
      id: 'mtp-usb',
      title: 'MTP / USB file service',
      state: mtp?.connected ? 'ready' : 'blocked',
      automation: 'automatic-read-only',
      detected: Boolean(mtp?.connected),
      applicableDevices: mtp?.connected
        ? [mtp.model || mtp.manufacturer || mtp.serialNumber || 'MTP device']
        : [],
      firmwareCandidates: [],
      blockers: mtp?.connected ? [] : ['No MTP device is currently connected.'],
      nextSteps: ['Browse and copy files from the device. Uploads modify device storage and require a separate guided action.'],
    },
    {
      id: 'samsung-download',
      title: 'Samsung Download Mode',
      workflowPolicyId: 'samsung.odin-plan',
      physicallyQualified: workflowPolicy('samsung.odin-plan')?.physicallyQualified ?? null,
      state: samsungDevices.length ? 'guided' : 'blocked',
      automation: 'qualified-destructive',
      detected: samsungDevices.length > 0,
      applicableDevices: samsungDevices.map((device) => device.deviceUid),
      firmwareCandidates: [],
      blockers: samsungDevices.length
        ? ['Stock Samsung package still requires exact-device package verification and physical qualification before flash execution.']
        : ['No Samsung Download Mode transport detected.'],
      nextSteps: ['Inspect stock AP/BL/CP/CSC packages, verify MD5/package structure, then route into qualification rather than auto-flashing.'],
    },
    {
      id: 'qualcomm-edl',
      title: 'Qualcomm EDL / Sahara / Firehose',
      workflowPolicyId: 'qualcomm.edl-plan',
      physicallyQualified: workflowPolicy('qualcomm.edl-plan')?.physicallyQualified ?? null,
      state: qualcommRecovery.length && qualcommBundles.length ? 'guided' : 'blocked',
      automation: 'qualified-destructive',
      detected: qualcommRecovery.length > 0,
      applicableDevices: qualcommRecovery.map((candidate) => candidate.deviceUid),
      firmwareCandidates: [],
      blockers: [
        ...(!qualcommRecovery.length ? ['No Qualcomm EDL 9008 recovery target detected.'] : []),
        ...(!qualcommBundles.length
          ? ['No verified Qualcomm firmware bundle with provenance + package fingerprint is available.']
          : [`${qualcommBundles.length} verified Qualcomm bundle(s) are indexed but intentionally withheld until exact device model/board/SKU identity is independently proven.`]),
        'Authorized programmer/service-loader evidence and designated-device physical qualification remain required before writes.',
      ],
      nextSteps: ['Prove exact device model/board/SKU first; only then may a matching verified Qualcomm package be promoted into recovery planning.'],
    },
    {
      id: 'mediatek-download',
      title: 'MediaTek Preloader / Download',
      workflowPolicyId: 'mediatek.brom-plan',
      physicallyQualified: workflowPolicy('mediatek.brom-plan')?.physicallyQualified ?? null,
      state: mediatekRecovery.length && mediatekBundles.length ? 'guided' : 'blocked',
      automation: 'qualified-destructive',
      detected: mediatekRecovery.length > 0,
      applicableDevices: mediatekRecovery.map((candidate) => candidate.deviceUid),
      firmwareCandidates: [],
      blockers: [
        ...(!mediatekRecovery.length ? ['No MediaTek Preloader/Download recovery target detected.'] : []),
        ...(!mediatekBundles.length
          ? ['No verified MediaTek firmware bundle with provenance + package fingerprint is available.']
          : [`${mediatekBundles.length} verified MediaTek bundle(s) are indexed but intentionally withheld until exact device model/board/SKU identity is independently proven.`]),
        'Legitimate OEM/service DA/auth requirements and designated-device physical qualification remain required before writes.',
      ],
      nextSteps: ['Prove exact device model/board/SKU first; only then may a matching verified MediaTek package be promoted into recovery planning.'],
    },
  ];

  const representedPolicyIds = new Set(
    lanes.map((lane) => lane.workflowPolicyId).filter((value): value is string => Boolean(value)),
  );

  for (const policy of workflowPolicies.filter(
    (item) => item.activeInBobfwtools && !representedPolicyIds.has(item.id),
  )) {
    const destructiveLike = policy.risk === 'destructive' || policy.risk === 'restricted' || policy.risk === 'elevated';
    lanes.push({
      id: `catalog:${policy.id}`,
      title: policy.category + ' · ' + policy.id,
      workflowPolicyId: policy.id,
      physicallyQualified: policy.physicallyQualified,
      state: 'blocked',
      automation: destructiveLike ? 'qualified-destructive' : 'guided-safe-action',
      detected: false,
      applicableDevices: [],
      firmwareCandidates: [],
      blockers: [
        'This catalog workflow has no dedicated auto-detection binding in the current readiness sweep; target/evidence selection remains guided.',
        ...(!policy.physicallyQualified ? ['Physical qualification is still pending for this workflow.'] : []),
      ],
      nextSteps: [policy.notes],
    });
  }

  if (unmatchedDrivers.length) {
    lanes.push({
      id: 'windows-driver-claim',
      title: 'Windows USB driver claim',
      state: 'blocked',
      automation: 'guided-safe-action',
      detected: true,
      applicableDevices: unmatchedDrivers.map((binding) => binding.instanceId),
      firmwareCandidates: [],
      blockers: unmatchedDrivers.map(
        (binding) => `${binding.friendlyName || binding.instanceId}: ${binding.detail}`,
      ),
      nextSteps: [
        driverElevation.elevated
          ? 'Build the exact-interface conflict plan and use only hardware-ID-verified relatch.'
          : 'Restart BobFWTools as Administrator before any driver mutation.',
      ],
    });
  }

  const dependencies: Record<string, string[]> = {
    'adb-service': ['workstation', 'adb', 'drivers'],
    fastboot: ['workstation', 'fastboot', 'drivers'],
    'mtp-usb': ['mtp'],
    'samsung-download': ['usb', 'policies'],
    'qualcomm-edl': ['recovery', 'firmware', 'policies'],
    'mediatek-download': ['recovery', 'firmware', 'policies'],
    'windows-driver-claim': ['drivers', 'elevation'],
  };
  for (const lane of lanes) {
    const failures = probeFailures.filter(failure =>
      (dependencies[lane.id] ?? ['policies']).includes(failure.probe));
    if (failures.length) {
      lane.state = 'blocked';
      lane.blockers = failures.map(failure => `${failure.probe} probe unavailable: ${failure.message}`);
    }
  }
  probeFailures.sort((a, b) => a.probe.localeCompare(b.probe));

  const globalBlockers = [
    ...probeFailures.map(failure => `${failure.probe} check BLOCKED: ${failure.message}`),
    ...workstation.blockers,
    ...unmatchedDrivers.map((binding) => `Driver claim unresolved: ${binding.instanceId}`),
  ];

  const softwareReady =
    probeFailures.length === 0 &&
    workstation.readyForDiagnostics &&
    unmatchedDrivers.length === 0 &&
    lanes.some((lane) => lane.state !== 'blocked');

  const qualificationQueue: HardwareQualificationTask[] = workflowPolicies
    .filter((policy) => policy.activeInBobfwtools && !policy.physicallyQualified)
    .map((policy) => {
      const requiredEvidence = [
        ...(policy.authorizationRequired ? ['Operator/device authorization evidence'] : []),
        ...(policy.deviceIdentityVerification ? ['Exact target identity evidence immediately before execution'] : []),
        ...(policy.dryRunSupported ? ['Dry-run / planning receipt using the exact intended inputs'] : []),
        ...(policy.backupOrRollbackRequired ? ['Verified backup or rollback evidence'] : []),
        ...(policy.auditLoggingRequired ? ['Audit ledger evidence with input/output fingerprints'] : []),
        ...(policy.explicitConfirmationRequired ? ['Explicit human confirmation tied to the exact target'] : []),
        'Designated physical-device bench result with post-operation verification',
      ];
      const packet = qualificationPacketForWorkflow(policy.id);
      return {
        workflowId: policy.id,
        category: policy.category,
        risk: policy.risk,
        softwareImplemented: policy.activeInBobfwtools,
        physicallyQualified: policy.physicallyQualified,
        requiredEvidence,
        ...packet,
        notes: policy.notes,
      };
    });

  const packageBoundFirmwareIndexed = verifiedBundles.length > 0;
  const approvalGates: HardwareApprovalGate[] = [
    {
      id: 'workstation',
      title: 'Workstation diagnostics ready',
      satisfied: workstation.readyForDiagnostics,
      requiredForWrites: true,
      detail: workstation.readyForDiagnostics
        ? 'Required host tooling/workspace checks are satisfied.'
        : workstation.blockers.join(' · ') || 'Host diagnostics readiness is incomplete.',
    },
    {
      id: 'driver-claim',
      title: 'Exact USB driver claim resolved',
      satisfied: !probeFailures.some(failure => failure.probe === 'drivers') && unmatchedDrivers.length === 0,
      requiredForWrites: true,
      detail: probeFailures.some(failure => failure.probe === 'drivers')
        ? 'Driver claim probe is unavailable; driver status is unverified.'
        : unmatchedDrivers.length
        ? `${unmatchedDrivers.length} present Windows USB interface(s) still have an unresolved driver claim.`
        : 'No unresolved present Windows USB driver claims were found.',
    },
    {
      id: 'device-identity',
      title: 'Exact hardware identity',
      satisfied: false,
      requiredForWrites: true,
      detail: 'Transport detection is not exact identity proof. This gate stays missing until one live target is explicitly locked to verified model/board/SKU evidence in the recovery handoff.',
    },
    {
      id: 'verified-firmware',
      title: 'Verified package + exact-device binding',
      satisfied: false,
      requiredForWrites: true,
      detail: packageBoundFirmwareIndexed
        ? `${verifiedBundles.length} planning-ready bundle(s) are indexed, but this gate stays missing until one package is bound to the independently proven live model/board/SKU and its deterministic fingerprint is revalidated for the recovery job.`
        : 'No planning-ready firmware bundle with a deterministic package fingerprint is available.',
    },
    {
      id: 'recovery-job',
      title: 'Package-bound recovery job',
      satisfied: false,
      requiredForWrites: true,
      detail: 'Satisfied only after a verified bundle is bound into a prepared recovery job whose job fingerprint validates.',
    },
    {
      id: 'backup-rollback',
      title: 'Backup / rollback evidence',
      satisfied: false,
      requiredForWrites: true,
      detail: 'Satisfied only after the target-specific backup/rollback path is exported and reviewable.',
    },
    {
      id: 'qualification-dossier',
      title: 'Designated-device qualification dossier',
      satisfied: false,
      requiredForWrites: true,
      detail: 'Must prove exact device, workstation, transport stability, authorized programmer/service evidence, and current executor build.',
    },
    {
      id: 'bench-evidence',
      title: 'One-partition bench evidence',
      satisfied: false,
      requiredForWrites: true,
      detail: 'Exactly one approved trial partition must complete with post-write verification before production authority.',
    },
    {
      id: 'human-decision',
      title: 'Human qualification decision',
      satisfied: false,
      requiredForWrites: true,
      detail: 'A reviewer decision must explicitly accept the physical qualification evidence.',
    },
    {
      id: 'audit-bundle',
      title: 'Verified audit bundle',
      satisfied: false,
      requiredForWrites: true,
      detail: 'The final audit bundle must recompute and match all qualification fingerprints.',
    },
    {
      id: 'write-authority',
      title: 'Short-lived production write authority',
      satisfied: false,
      requiredForWrites: true,
      detail: 'Production grant is intentionally unavailable until all prior hardware gates are satisfied.',
    },
  ];

  const writeReady = approvalGates
    .filter((gate) => gate.requiredForWrites)
    .every((gate) => gate.satisfied);

  return {
    probeFailures,
    generatedAtMs: Date.now(),
    softwareReady,
    writeReady,
    physicalApprovalRequired: lanes.some((lane) => lane.automation === 'qualified-destructive' && lane.detected),
    approvalGates,
    workflowPolicies,
    qualificationQueue,
    workstation,
    adbDevices,
    fastbootSerials,
    mtpConnected: Boolean(mtp?.connected),
    transportDevices,
    recoveryCandidates,
    firmwareBundles: verifiedBundles,
    driverBindings,
    driverElevation,
    lanes,
    blockers: globalBlockers,
  };
}

export type AuditEvent = {
  timestampMs: number;
  category: string;
  action: string;
  risk: string;
  status: string;
  deviceUid?: string | null;
  detail: string;
  evidence: string[];
};

export async function getRecentAuditEvents(limit = 100): Promise<AuditEvent[]> {
  return invoke<AuditEvent[]>('audit_recent', { limit });
}

export async function getAuditLogPath(): Promise<string> {
  return invoke<string>('audit_log_path');
}


export type FirehoseWriteRequest = {
  imageBytes: number;
  startSector: number;
  physicalPartition: number;
  sectorSize: number;
  chunkSize: number;
  partitionStartSector?: number | null;
  partitionSectorCount?: number | null;
};

export type FirehoseChunk = {
  index: number;
  fileOffset: number;
  bytes: number;
};

export type FirehoseWritePlan = {
  allowed: boolean;
  reasons: string[];
  warnings: string[];
  startSector: number;
  physicalPartition: number;
  sectorSize: number;
  imageBytes: number;
  numPartitionSectors: number;
  paddedBytes: number;
  endSectorExclusive: number;
  chunkSize: number;
  chunks: FirehoseChunk[];
  dryRunOnly: boolean;
  executorQualified: boolean;
};

export async function buildFirehoseWritePlan(request: FirehoseWriteRequest): Promise<FirehoseWritePlan> {
  return invoke<FirehoseWritePlan>('firehose_write_plan', { request });
}


export type TransportEndpointRecord = {
  configuration: number;
  interface: number;
  alternateSetting: number;
  address: number;
  direction: string;
  transferType: string;
  maxPacketSize: number;
  interval: number;
};

export type TransportDevice = {
  deviceUid: string;
  vendorId: number;
  productId: number;
  busNumber: number;
  deviceAddress: number;
  manufacturer?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  mode: string;
  endpoints: TransportEndpointRecord[];
  bulkIn: number[];
  bulkOut: number[];
};

export async function scanTransportDevices(): Promise<TransportDevice[]> {
  if (!isTauriRuntime()) return [];
  return invoke<TransportDevice[]>('bootforgeusb_transport_scan');
}

export type SamsungFirmwareEntry = {
  path: string;
  size: number;
  kind: string;
  candidatePartition?: string | null;
};

export type SamsungFirmwareArchiveReport = {
  path: string;
  role: string;
  fileSize: number;
  md5Verified?: boolean | null;
  embeddedMd5?: string | null;
  calculatedMd5?: string | null;
  containsPit: boolean;
  containsUserdata: boolean;
  containsMetadata: boolean;
  downloadList: string[];
  entries: SamsungFirmwareEntry[];
  warnings: string[];
};

export type SamsungFlashPlan = {
  protocol: string;
  modeRequired: string;
  executionEnabled: boolean;
  destructive: boolean;
  requiresExplicitApproval: boolean;
  preservesUserdataByDesign: boolean;
  roles: string[];
  packagePaths: string[];
  plannedPayloads: string[];
  safetyChecks: string[];
  warnings: string[];
};

export async function chooseSamsungFirmwarePackages(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    multiple: true,
    directory: false,
    title: 'Choose Samsung stock firmware packages',
    filters: [{ name: 'Samsung firmware packages', extensions: ['md5', 'tar'] }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function inspectSamsungFirmwarePackages(
  paths: string[],
): Promise<SamsungFirmwareArchiveReport[]> {
  if (!isTauriRuntime() || !paths.length) return [];
  return invoke<SamsungFirmwareArchiveReport[]>('bootforge_firmware_inspect', { paths });
}

export async function buildSamsungFirmwarePlan(paths: string[]): Promise<SamsungFlashPlan> {
  return invoke<SamsungFlashPlan>('bootforge_samsung_plan', { paths });
}

export type QualificationBuildIdentity = {
  packageVersion: string;
  sourceRevision: string;
  sourceRevisionAvailable: boolean;
  buildProfile: string;
  qualifiedFlashCompiled: boolean;
  executorBuildFingerprint: string;
};

export async function getQualificationBuildIdentity(): Promise<QualificationBuildIdentity | null> {
  if (!isTauriRuntime()) return null;
  return invoke<QualificationBuildIdentity>('bootforge_qualification_build_identity');
}

export type QualificationDossierReview = {
  path: string;
  schemaValid: boolean;
  dossierFingerprintValid: boolean;
  recoveryJobFingerprintValid: boolean;
  recoveryJobMatchesExpected: boolean;
  executorBuildMatchesCurrent: boolean;
  bindingReadyClaimed: boolean;
  liveDeviceIdentityMatch: boolean;
  workstationEvidenceReady: boolean;
  transportObservationReady: boolean;
  programmerEvidenceReady: boolean;
  bindingSemanticsValid: boolean;
  qualificationStatusPending: boolean;
  executorQualifiedClaimed: boolean;
  executionEnabledClaimed: boolean;
  safeToReview: boolean;
  blockers: string[];
  dossierFingerprint?: string | null;
  recoveryJobFingerprint?: string | null;
  executorBuildFingerprint?: string | null;
};

export async function reviewQualificationDossier(
  expectedRecoveryJobFingerprint?: string | null,
): Promise<QualificationDossierReview | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Review BobFWTools qualification dossier',
    filters: [{ name: 'JSON qualification dossier', extensions: ['json'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<QualificationDossierReview>('bootforge_qualification_review', {
    path: selected,
    expectedRecoveryJobFingerprint: expectedRecoveryJobFingerprint?.trim() || null,
  });
}

export async function reviewQualificationDossierPath(
  path: string,
  expectedRecoveryJobFingerprint?: string | null,
): Promise<QualificationDossierReview | null> {
  if (!isTauriRuntime() || !path.trim()) return null;
  return invoke<QualificationDossierReview>('bootforge_qualification_review', {
    path: path.trim(),
    expectedRecoveryJobFingerprint: expectedRecoveryJobFingerprint?.trim() || null,
  });
}


export type HardwareQualificationPacketReview = {
  path: string;
  schemaValid: boolean;
  packetFingerprintValid: boolean;
  qualificationStatusBenchPending: boolean;
  executionPerformedClaimed: boolean;
  writeAuthorityClaimed: boolean;
  safeToReview: boolean;
  blockers: string[];
  workflowId?: string | null;
  packetFingerprint?: string | null;
};

export async function reviewHardwareQualificationPacket(): Promise<HardwareQualificationPacketReview | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Review hardware qualification packet',
    filters: [{ name: 'JSON qualification packet', extensions: ['json'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<HardwareQualificationPacketReview>('hardware_qualification_packet_review', { path: selected });
}

export async function reviewHardwareQualificationPacketPath(
  path: string,
): Promise<HardwareQualificationPacketReview | null> {
  if (!isTauriRuntime() || !path.trim()) return null;
  return invoke<HardwareQualificationPacketReview>('hardware_qualification_packet_review', { path: path.trim() });
}

export type QualifiedFlashPartition = {
  name: string;
  imagePath: string;
  size: number;
  expectedSha256: string;
};

export type QualifiedFlashPhysicalChecks = {
  repeatedEnumerationStable: boolean;
  expectedModeConfirmed: boolean;
  endpointStabilityConfirmed: boolean;
  programmerHashVerified: boolean;
  preflightMatched: boolean;
  partitionBoundsVerified: boolean;
  backupEvidencePresent: boolean;
  destructiveBenchWritePassed: boolean;
  postWriteVerificationPassed: boolean;
};

export type QualifiedFlashPartitionGrant = {
  name: string;
  imageSha256: string;
};

export type QualifiedFlashGrant = {
  schema: string;
  qualificationStatus: string;
  executorQualified: boolean;
  deviceSerial: string;
  executorBuildFingerprint: string;
  recoveryJobFingerprint: string;
  approvedPartitions: QualifiedFlashPartitionGrant[];
  wipeUserDataAllowed: boolean;
  autoRebootAllowed: boolean;
  issuedAtUnixSeconds: number;
  expiresAtUnixSeconds: number;
  dossierFingerprint: string;
  auditBundleFingerprint?: string | null;
  qualificationPacketFingerprint?: string | null;
  grantMac: string;
};

export type QualifiedFlashApprovalInput = {
  dossierPath: string;
  benchEvidencePath?: string | null;
  reviewDecisionPath?: string | null;
  auditBundlePath?: string | null;
  expectedRecoveryJobFingerprint: string;
  deviceSerial: string;
  partitions: QualifiedFlashPartition[];
  wipeUserDataAllowed: boolean;
  autoRebootAllowed: boolean;
  reviewer: string;
  reviewerNotes: string;
  confirmation: string;
  expiresInMinutes: number;
  physicalChecks: QualifiedFlashPhysicalChecks;
};

export type QualificationBenchEvidenceInput = {
  dossierPath: string;
  qualificationPacketPath: string;
  expectedRecoveryJobFingerprint: string;
  deviceSerial: string;
  reviewer: string;
  reviewerNotes: string;
  partitions: QualifiedFlashPartition[];
  physicalChecks: QualifiedFlashPhysicalChecks;
};

export async function exportQualificationBenchEvidence(
  input: QualificationBenchEvidenceInput,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const destinationPath = await save({
    title: 'Export physical bench qualification evidence',
    defaultPath: 'bobfwtools-qualification-bench-evidence.json',
    filters: [{ name: 'JSON bench evidence', extensions: ['json'] }],
  });
  if (!destinationPath) return null;
  return invoke<string>('bootforge_qualification_bench_evidence_export', {
    input,
    destinationPath,
  });
}

export type QualificationDecisionInput = {
  dossierPath: string;
  benchEvidencePath?: string | null;
  expectedRecoveryJobFingerprint: string;
  deviceSerial: string;
  reviewer: string;
  reviewerNotes: string;
  decision: 'accept-evidence' | 'reject-evidence';
  physicalChecks: QualifiedFlashPhysicalChecks;
};

export async function exportQualificationDecision(
  input: QualificationDecisionInput,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const destinationPath = await save({
    title: 'Export qualification review decision',
    defaultPath: 'bobfwtools-qualification-decision.json',
    filters: [{ name: 'JSON qualification decision', extensions: ['json'] }],
  });
  if (!destinationPath) return null;
  return invoke<string>('bootforge_qualification_decision_export', {
    input,
    destinationPath,
  });
}

export type QualificationAuditBundleInput = {
  dossierPath: string;
  benchEvidencePath: string;
  decisionPath: string;
  readinessCertificatePath?: string | null;
  expectedRecoveryJobFingerprint: string;
  deviceSerial: string;
  reviewer: string;
};

export type QualificationAuditBundleReview = {
  path: string;
  schemaValid: boolean;
  bundleFingerprintValid: boolean;
  recoveryJobMatchesExpected: boolean;
  executorBuildMatchesCurrent: boolean;
  sourceFilesMatch: boolean;
  sourceSemanticsValid: boolean;
  nestedEvidenceChainValid: boolean;
  grantsExecutionAuthorityClaimed: boolean;
  executionPerformedClaimed: boolean;
  safeToReview: boolean;
  blockers: string[];
  bundleFingerprint?: string | null;
  recoveryJobFingerprint?: string | null;
  executorBuildFingerprint?: string | null;
  qualificationPacketFingerprint?: string | null;
};

export async function reviewQualificationAuditBundle(
  expectedRecoveryJobFingerprint?: string | null,
): Promise<QualificationAuditBundleReview | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Review qualification audit bundle',
    filters: [{ name: 'JSON qualification audit bundle', extensions: ['json'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<QualificationAuditBundleReview>(
    'bootforge_qualification_audit_bundle_review',
    {
      path: selected,
      expectedRecoveryJobFingerprint: expectedRecoveryJobFingerprint?.trim() || null,
    },
  );
}

export async function reviewQualificationAuditBundlePath(
  path: string,
  expectedRecoveryJobFingerprint?: string | null,
): Promise<QualificationAuditBundleReview | null> {
  if (!isTauriRuntime() || !path.trim()) return null;
  return invoke<QualificationAuditBundleReview>(
    'bootforge_qualification_audit_bundle_review',
    {
      path: path.trim(),
      expectedRecoveryJobFingerprint: expectedRecoveryJobFingerprint?.trim() || null,
    },
  );
}

export async function exportQualificationAuditBundle(
  input: QualificationAuditBundleInput,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const suppliedReadiness = input.readinessCertificatePath?.trim() || null;
  const readinessCertificatePath = suppliedReadiness
    ? suppliedReadiness
    : await open({
        multiple: false,
        directory: false,
        title: 'Optional: choose recovery readiness certificate',
        filters: [{ name: 'JSON readiness certificate', extensions: ['json'] }],
      });
  const normalizedReadiness =
    typeof readinessCertificatePath === 'string' && readinessCertificatePath.trim()
      ? readinessCertificatePath.trim()
      : null;

  const destinationPath = await save({
    title: 'Export qualification audit bundle',
    defaultPath: 'bobfwtools-qualification-audit-bundle.json',
    filters: [{ name: 'JSON qualification audit bundle', extensions: ['json'] }],
  });
  if (!destinationPath) return null;

  return invoke<string>('bootforge_qualification_audit_bundle_export', {
    input: {
      ...input,
      readinessCertificatePath: normalizedReadiness,
    },
    destinationPath,
  });
}

export type QualifiedFlashStartResponse = {
  jobId: string;
  status: string;
};

export async function getQualifiedFastbootDevices(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>('bootforge_qualified_fastboot_devices');
}

export async function chooseAndInspectQualifiedFlashImage(
  name: string,
): Promise<QualifiedFlashPartition | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Choose image for ' + name,
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<QualifiedFlashPartition>('bootforge_qualified_flash_inspect_image', {
    name,
    path: selected,
  });
}

export async function issueQualificationTrialGrant(
  input: QualifiedFlashApprovalInput,
): Promise<QualifiedFlashGrant> {
  return invoke<QualifiedFlashGrant>('bootforge_issue_qualification_trial_grant', { input });
}

export async function issueQualifiedFlashGrant(
  input: QualifiedFlashApprovalInput,
): Promise<QualifiedFlashGrant> {
  return invoke<QualifiedFlashGrant>('bootforge_issue_qualified_flash_grant', { input });
}

export async function startQualifiedFastbootFlash(
  deviceSerial: string,
  partitions: QualifiedFlashPartition[],
  qualificationGrant: QualifiedFlashGrant,
  options?: { wipeUserData?: boolean; autoReboot?: boolean },
): Promise<QualifiedFlashStartResponse> {
  return invoke<QualifiedFlashStartResponse>('flash_start', {
    config: {
      deviceSerial,
      deviceBrand: 'Qualified bench target',
      flashMethod: 'fastboot',
      partitions,
      verifyAfterFlash: true,
      autoReboot: Boolean(options?.autoReboot),
      wipeUserData: Boolean(options?.wipeUserData),
      qualificationGrant,
    },
  });
}

export type QualificationRecoveryIdentity = {
  deviceUid: string;
  vendorId: number;
  productId: number;
  mode: string;
  serialNumber?: string | null;
};

export type QualificationTransportObservationSample = {
  observedUnixMs: number;
  device: TransportDevice;
};

export type QualificationTransportObservation = {
  expectedDeviceUid: string;
  attemptedSamples: number;
  samples: QualificationTransportObservationSample[];
};

export type QualificationDossierInput = {
  device: TransportDevice;
  workstation: WorkstationReadiness;
  authorizedProgrammers: EdlProgrammerRecord[];
  recoveryJobFingerprint: string;
  preparedRecoveryIdentity?: QualificationRecoveryIdentity | null;
  transportObservation?: QualificationTransportObservation | null;
  operatorNotes: string;
};

export async function exportQualificationDossier(input: QualificationDossierInput): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const destinationPath = await save({
    title: 'Export designated-device qualification dossier',
    defaultPath: 'bobfwtools-qualification-dossier.json',
    filters: [{ name: 'JSON qualification dossier', extensions: ['json'] }],
  });
  if (!destinationPath) return null;
  return invoke<string>('bootforge_qualification_export', { input, destinationPath });
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
  sourceOffset?: number | null;
  physicalPartition?: number | null;
  region?: string | null;
  operation: string;
};

export type RecoveryJob = {
  workflow: RecoveryWorkflow;
  protocol: string;
  jobFingerprint: string;
  packageFingerprint?: string | null;
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
  payloadDigests: RecoveryArtifactDigest[];
  operations: RecoveryPartitionOperation[];
  integrityChecksPassed: boolean;
  integrityFindings: string[];
  highRiskPartitions: string[];
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

export async function autodiscoverRecoveryArtifacts(kind: RecoveryWorkflow): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  return invoke<string[]>('bootforge_recovery_autodiscover', { kind });
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
  packageFingerprint?: string | null,
): Promise<RecoveryJob> {
  return invoke<RecoveryJob>('bootforge_recovery_prepare', {
    candidate,
    paths,
    packageFingerprint: packageFingerprint?.trim() || null,
  });
}

export async function revalidateRecoveryJob(job: RecoveryJob): Promise<RecoveryJob> {
  return invoke<RecoveryJob>('bootforge_recovery_revalidate', { job });
}

export async function exportRecoveryEvidence(
  job: RecoveryJob,
  plan: RecoveryPlan | null,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const destinationPath = await save({
    title: 'Export BobFWTools recovery evidence receipt',
    defaultPath: 'bobfwtools-recovery-evidence.json',
    filters: [{ name: 'JSON evidence receipt', extensions: ['json'] }],
  });
  if (!destinationPath) return null;
  return invoke<string>('bootforge_recovery_export_receipt', {
    job,
    plan,
    destinationPath,
  });
}

export async function exportRecoveryReadinessCertificate(
  job: RecoveryJob,
  plan: RecoveryPlan | null,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const destinationPath = await save({
    title: 'Export BobFWTools recovery readiness certificate',
    defaultPath: 'bobfwtools-recovery-readiness-certificate.json',
    filters: [{ name: 'JSON readiness certificate', extensions: ['json'] }],
  });
  if (!destinationPath) return null;
  return invoke<string>('bootforge_recovery_export_readiness_certificate', {
    job,
    plan,
    destinationPath,
  });
}

export type RecoveryReadinessCertificateReview = {
  path: string;
  schemaValid: boolean;
  fingerprintValid: boolean;
  jobFingerprintValid: boolean;
  jobMatchesExpected: boolean;
  readinessStatusValid: boolean;
  semanticConsistencyValid: boolean;
  grantsExecutionAuthorityClaimed: boolean;
  executionPerformedClaimed: boolean;
  safeToReview: boolean;
  blockers: string[];
  certificateFingerprint?: string | null;
  jobFingerprint?: string | null;
  readinessStatus?: string | null;
};

export async function reviewRecoveryReadinessCertificate(
  expectedJobFingerprint?: string | null,
): Promise<RecoveryReadinessCertificateReview | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Review BobFWTools recovery readiness certificate',
    filters: [{ name: 'JSON readiness certificate', extensions: ['json'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<RecoveryReadinessCertificateReview>(
    'bootforge_recovery_review_readiness_certificate',
    {
      path: selected,
      expectedJobFingerprint: expectedJobFingerprint?.trim() || null,
    },
  );
}

export async function reviewRecoveryReadinessCertificatePath(
  path: string,
  expectedJobFingerprint?: string | null,
): Promise<RecoveryReadinessCertificateReview | null> {
  if (!isTauriRuntime() || !path.trim()) return null;
  return invoke<RecoveryReadinessCertificateReview>(
    'bootforge_recovery_review_readiness_certificate',
    {
      path: path.trim(),
      expectedJobFingerprint: expectedJobFingerprint?.trim() || null,
    },
  );
}


export type FirmwareChipsetProfile = {
  vendor: 'qualcomm' | 'mediatek' | string;
  family: string;
  marketedAs: string[];
  aliases: string[];
  serviceModes: string[];
  loaderKinds: string[];
  commonStorage: string[];
  packageMarkers: string[];
  securityNote: string;
};

export type FirmwareLibraryEntry = {
  path: string;
  relativePath: string;
  name: string;
  bytes: number;
  sha256: string;
  modifiedUnixMs: number | null;
  vendorHint: string;
  artifactKind: string;
  chipsetMatches: string[];
  blocked: boolean;
  eligibleForPlanning: boolean;
  warnings: string[];
};

export type FirmwareBundleSummary = {
  directory: string;
  vendorHint: string;
  chipsetMatches: string[];
  artifactKinds: string[];
  files: number;
  bytes: number;
  blocked: boolean;
  planningReady: boolean;
  missingRequired: string[];
  provenancePresent: boolean;
  provenanceValid: boolean;
  exactIdentityPresent: boolean;
  model?: string | null;
  board?: string | null;
  sku?: string | null;
  sourceCategory?: string | null;
  sourceReference?: string | null;
  packageFingerprint?: string | null;
  warnings: string[];
};

export type FirmwareLibraryReport = {
  root: string;
  entries: FirmwareLibraryEntry[];
  vendorCounts: Record<string, number>;
  artifactCounts: Record<string, number>;
  blockedCount: number;
  bundles: FirmwareBundleSummary[];
  warnings: string[];
};

export async function getFirmwareChipsetCatalog(): Promise<FirmwareChipsetProfile[]> {
  if (!isTauriRuntime()) return [];
  return invoke<FirmwareChipsetProfile[]>('firmware_chipset_catalog');
}

export async function lookupFirmwareChipset(query: string): Promise<FirmwareChipsetProfile[]> {
  if (!isTauriRuntime() || !query.trim()) return [];
  return invoke<FirmwareChipsetProfile[]>('firmware_chipset_lookup', { query });
}

export type FirmwareProvenanceWriteInput = {
  directory: string;
  vendor: 'qualcomm' | 'mediatek' | string;
  chipsetFamily: string;
  oem: string;
  model: string;
  board: string;
  sku: string;
  region?: string | null;
  carrier?: string | null;
  buildVersion: string;
  bootloaderRevision?: string | null;
  storage?: string | null;
  sourceCategory: 'official-oem' | 'authorized-service' | string;
  sourceReference: string;
};

export type FirmwareProvenanceWriteResult = {
  path: string;
  artifactsBound: number;
};

export async function writeFirmwareProvenance(
  input: FirmwareProvenanceWriteInput,
): Promise<FirmwareProvenanceWriteResult> {
  return invoke<FirmwareProvenanceWriteResult>('firmware_provenance_write', { input });
}

export async function getVerifiedFirmwareBundleArtifacts(directory: string): Promise<string[]> {
  if (!isTauriRuntime() || !directory.trim()) return [];
  return invoke<string[]>('firmware_bundle_planning_artifacts', { directory });
}

export async function scanFirmwareLibrary(): Promise<FirmwareLibraryReport | null> {
  if (!isTauriRuntime()) return null;
  return invoke<FirmwareLibraryReport>('firmware_library_scan');
}


export type FirmwareManifestArtifact = {
  path: string;
  sha256: string;
  role: string;
  bytes: number | null;
};

export type FirmwareManifest = {
  schema: string;
  vendor: string;
  chipset: string;
  oem: string;
  models: string[];
  variants: string[];
  regions: string[];
  buildId: string;
  bootloaderRevision: string | null;
  sourceKind: string;
  sourceReference: string;
  artifacts: FirmwareManifestArtifact[];
};

export type ManifestArtifactVerification = {
  path: string;
  exists: boolean;
  expectedSha256: string;
  actualSha256: string | null;
  bytes: number | null;
  hashMatch: boolean;
};

export type FirmwareManifestInspection = {
  manifestPath: string;
  manifest: FirmwareManifest;
  validationErrors: string[];
  artifacts: ManifestArtifactVerification[];
  allArtifactsPresent: boolean;
  allHashesMatch: boolean;
  metadataValid: boolean;
  packageVerified: boolean;
};

export type DeviceFirmwareIdentity = {
  vendor: string | null;
  chipset: string | null;
  oem: string | null;
  model: string | null;
  variant: string | null;
  region: string | null;
  bootloaderRevision: string | null;
};

export type FirmwareCompatibilityReport = {
  manifestValid: boolean;
  identityComplete: boolean;
  candidateCompatible: boolean;
  executionAuthorized: boolean;
  matchedFields: string[];
  blockers: string[];
  warnings: string[];
};

export async function chooseFirmwareManifest(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Choose bobfwtools-firmware.json',
    filters: [{ name: 'BobFWTools firmware manifest', extensions: ['json'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function inspectFirmwareManifest(path: string): Promise<FirmwareManifestInspection> {
  return invoke<FirmwareManifestInspection>('firmware_manifest_inspect', { path });
}

export async function compareFirmwareManifest(
  path: string,
  device: DeviceFirmwareIdentity,
): Promise<FirmwareCompatibilityReport> {
  return invoke<FirmwareCompatibilityReport>('firmware_manifest_compare', { path, device });
}
