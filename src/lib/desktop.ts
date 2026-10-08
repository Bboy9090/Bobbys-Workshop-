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
  grantMac: string;
};

export type QualifiedFlashApprovalInput = {
  dossierPath: string;
  reviewDecisionPath?: string | null;
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
): Promise<RecoveryJob> {
  return invoke<RecoveryJob>('bootforge_recovery_prepare', { candidate, paths });
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
