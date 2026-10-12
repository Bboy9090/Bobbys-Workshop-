import { useMemo, useState } from 'react';
import {
  diagnosePhone,
  exportHardwareApprovalGapReport,
  exportHardwareQualificationCandidate,
  getCalibrationPartitionAllowlist,
  getDriverConflictPlan,
  getDriverElevationStatus,
  getHardwareExecutorCapabilities,
  getFastbootModeDevices,
  getQualificationBuildIdentity,
  getQualifiedFastbootDevices,
  getWorkflowCapabilities,
  getWorkflowPolicyCatalog,
  getWorkstationReadiness,
  initializeWorkstation,
  isTauriRuntime,
  listEdlProgrammers,
  prepareAdb,
  runDriverClaimStabilityTest,
  scanAdbDevices,
  scanDriverBindings,
  scanFirmwareLibrary,
  scanRecoveryCandidates,
  scanTransportDevices,
  startWorkflowJob,
  type DeviceCapabilityMatrix,
  type DriverBindingRecord,
  type DriverClaimStabilityReport,
  type DriverConflictPlan,
  type FirmwareLibraryReport,
  type HardwareExecutorCapability,
  type PhoneDiagnosticReport,
  type QualificationBuildIdentity,
  type RecoveryCandidate,
  type TransportDevice,
  type WorkflowPolicy,
  type WorkstationReadiness,
  type WorkflowJobRecord,
} from '../lib/desktop';

type FlowState = 'ready' | 'planning-ready' | 'executor-gated' | 'bench-gated' | 'blocked';

type FlowRow = {
  id: string;
  label: string;
  state: FlowState;
  summary: string;
  next: string;
  evidence: string[];
};

type SweepSnapshot = {
  scannedAt: number;
  workstation: WorkstationReadiness | null;
  capabilities: DeviceCapabilityMatrix | null;
  diagnostic: PhoneDiagnosticReport | null;
  transports: TransportDevice[];
  recoveryCandidates: RecoveryCandidate[];
  firmware: FirmwareLibraryReport | null;
  qualificationBuild: QualificationBuildIdentity | null;
  fastbootDevices: string[];
  qualifiedFastbootDevices: string[];
  driverBindings: DriverBindingRecord[];
  calibrationAllowlist: string[];
  driverStability: Record<string, DriverClaimStabilityReport>;
  driverConflicts: Record<string, DriverConflictPlan>;
  policies: WorkflowPolicy[];
  executors: HardwareExecutorCapability[];
  authorizedProgrammers: number;
  adminRequired: boolean;
  adminReady: boolean;
  errors: string[];
};

const emptySnapshot = (): SweepSnapshot => ({
  scannedAt: 0,
  workstation: null,
  capabilities: null,
  diagnostic: null,
  transports: [],
  recoveryCandidates: [],
  firmware: null,
  qualificationBuild: null,
  fastbootDevices: [],
  qualifiedFastbootDevices: [],
  driverBindings: [],
  calibrationAllowlist: [],
  driverStability: {},
  driverConflicts: {},
  policies: [],
  executors: [],
  authorizedProgrammers: 0,
  adminRequired: false,
  adminReady: true,
  errors: [],
});

function stateClasses(state: FlowState): string {
  if (state === 'ready') return 'border-emerald-900/60 bg-emerald-950/15 text-emerald-200';
  if (state === 'planning-ready') return 'border-cyan-900/60 bg-cyan-950/15 text-cyan-200';
  if (state === 'executor-gated') return 'border-fuchsia-900/60 bg-fuchsia-950/15 text-fuchsia-200';
  if (state === 'bench-gated') return 'border-amber-900/60 bg-amber-950/15 text-amber-200';
  return 'border-rose-900/60 bg-rose-950/15 text-rose-200';
}

function stateLabel(state: FlowState): string {
  if (state === 'ready') return 'READY';
  if (state === 'planning-ready') return 'PLANNING READY';
  if (state === 'executor-gated') return 'EXECUTOR GATED';
  if (state === 'bench-gated') return 'BENCH GATED';
  return 'BLOCKED';
}

async function safeCall<T>(label: string, fn: () => Promise<T>, errors: string[]): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export default function HardwareFlowOrchestrator() {
  const nativeRuntime = useMemo(() => isTauriRuntime(), []);
  const [snapshot, setSnapshot] = useState<SweepSnapshot>(emptySnapshot);
  const [busy, setBusy] = useState<'sweep' | 'setup' | 'automation' | 'export' | null>(null);
  const [automationResults, setAutomationResults] = useState<WorkflowJobRecord[]>([]);
  const [automationNote, setAutomationNote] = useState<string | null>(null);
  const [gapReportPath, setGapReportPath] = useState<string | null>(null);
  const [candidatePaths, setCandidatePaths] = useState<Record<string, string>>({});

  const collectSweep = async () => {
    const errors: string[] = [];

    const executors = await safeCall(
      'hardware executor capability inventory',
      getHardwareExecutorCapabilities,
      errors,
    );
    const qualifiedWriterCompiled = Boolean(
      executors?.find((item) => item.id === 'qualified-fastboot-writer')?.compiled,
    );

    const [
      workstation,
      capabilities,
      diagnostic,
      transports,
      recoveryCandidates,
      firmware,
      qualificationBuild,
      fastbootDevices,
      qualifiedFastbootDevices,
      driverBindings,
      calibrationAllowlist,
      policies,
      programmers,
      elevation,
      adbDevices,
    ] = await Promise.all([
      safeCall('workstation readiness', getWorkstationReadiness, errors),
      safeCall('workflow capabilities', getWorkflowCapabilities, errors),
      safeCall('phone diagnostics', diagnosePhone, errors),
      safeCall('USB transport scan', scanTransportDevices, errors),
      safeCall('recovery candidate scan', scanRecoveryCandidates, errors),
      safeCall('firmware library scan', scanFirmwareLibrary, errors),
      safeCall('qualified writer build identity', getQualificationBuildIdentity, errors),
      safeCall('fastboot scan', getFastbootModeDevices, errors),
      qualifiedWriterCompiled
        ? safeCall('qualified fastboot scan', getQualifiedFastbootDevices, errors)
        : Promise.resolve<string[] | null>([]),
      safeCall('driver claim scan', scanDriverBindings, errors),
      safeCall('calibration partition allowlist', getCalibrationPartitionAllowlist, errors),
      safeCall('workflow policy catalog', getWorkflowPolicyCatalog, errors),
      safeCall('authorized programmer inventory', listEdlProgrammers, errors),
      safeCall('Windows elevation readiness', getDriverElevationStatus, errors),
      safeCall('ADB scan', scanAdbDevices, errors),
    ]);

    const driverStability: Record<string, DriverClaimStabilityReport> = {};
    const driverConflicts: Record<string, DriverConflictPlan> = {};
    for (const binding of driverBindings ?? []) {
      if (binding.bindingState === 'matched') {
        const report = await safeCall(
          `driver stability ${binding.instanceId}`,
          () => runDriverClaimStabilityTest(binding.instanceId),
          errors,
        );
        if (report) driverStability[binding.instanceId] = report;
      } else {
        const plan = await safeCall(
          `driver conflict plan ${binding.instanceId}`,
          () => getDriverConflictPlan(binding.instanceId),
          errors,
        );
        if (plan) driverConflicts[binding.instanceId] = plan;
      }
    }

    const normalizedCapabilities = capabilities ?? null;
    if (normalizedCapabilities && adbDevices) {
      normalizedCapabilities.adbDevicesSeen = adbDevices.length;
    }

    setSnapshot({
      scannedAt: Date.now(),
      workstation: workstation ?? null,
      capabilities: normalizedCapabilities,
      diagnostic: diagnostic ?? null,
      transports: transports ?? [],
      recoveryCandidates: recoveryCandidates ?? [],
      firmware: firmware ?? null,
      qualificationBuild: qualificationBuild ?? null,
      fastbootDevices: fastbootDevices ?? [],
      qualifiedFastbootDevices: qualifiedFastbootDevices ?? [],
      driverBindings: driverBindings ?? [],
      calibrationAllowlist: calibrationAllowlist ?? [],
      driverStability,
      driverConflicts,
      policies: policies ?? [],
      executors: executors ?? [],
      authorizedProgrammers: (programmers ?? []).filter((item) => item.authorized).length,
      adminRequired: elevation?.required ?? false,
      adminReady: elevation?.elevated ?? true,
      errors,
    });
  };

  const runSweep = async () => {
    if (!nativeRuntime || busy) return;
    setBusy('sweep');
    try {
      await collectSweep();
    } finally {
      setBusy(null);
    }
  };

  const automateSafeSetup = async () => {
    if (!nativeRuntime || busy) return;
    setBusy('setup');
    try {
      await initializeWorkstation();
      await prepareAdb();
      await collectSweep();
    } finally {
      setBusy(null);
    }
  };

  const runAllSafeAutomations = async () => {
    if (!nativeRuntime || busy) return;
    setBusy('automation');
    setAutomationResults([]);
    setAutomationNote(null);
    const results: WorkflowJobRecord[] = [];
    try {
      results.push(await startWorkflowJob('diagnose-phone'));
      results.push(await startWorkflowJob('usb-cable-doctor'));

      const adb = await scanAdbDevices();
      const authorized = adb.filter((device) => device.authorized);
      if (authorized.length === 1) {
        const serial = authorized[0].serial;
        for (const workflowId of ['adb-device-info', 'adb-battery-info', 'adb-logcat']) {
          results.push(await startWorkflowJob(workflowId, serial));
        }
        setAutomationNote(`Safe ADB checks were bound to exact authorized serial ${serial}.`);
      } else if (authorized.length > 1) {
        setAutomationNote(
          `Found ${authorized.length} authorized ADB devices. Device-specific safe jobs were not auto-run because BobFWTools will not guess which serial to use.`,
        );
      } else {
        setAutomationNote('No authorized ADB target was present, so device-specific ADB checks were skipped.');
      }

      setAutomationResults(results);
      await collectSweep();
    } finally {
      setBusy(null);
    }
  };

  const flows = useMemo<FlowRow[]>(() => {
    const ws = snapshot.workstation;
    const diag = snapshot.diagnostic;
    const firmware = snapshot.firmware;
    const qcomCandidate = snapshot.recoveryCandidates.some((item) => item.workflow === 'qualcomm-edl');
    const mtkCandidate = snapshot.recoveryCandidates.some((item) => item.workflow === 'mediatek-download');
    const samsungDetected = snapshot.transports.some((item) => item.mode === 'samsung-download');
    const qcomBundle = firmware?.bundles.some(
      (bundle) => bundle.planningReady && bundle.vendorHint === 'qualcomm' && Boolean(bundle.packageFingerprint),
    ) ?? false;
    const mtkBundle = firmware?.bundles.some(
      (bundle) => bundle.planningReady && bundle.vendorHint === 'mediatek' && Boolean(bundle.packageFingerprint),
    ) ?? false;
    const anyVerifiedBundle = firmware?.bundles.some(
      (bundle) => bundle.planningReady && Boolean(bundle.packageFingerprint),
    ) ?? false;
    const authorizedAdb = (diag?.authorizedAdbDevices ?? 0) > 0;
    const fastbootPresent = snapshot.fastbootDevices.length > 0;
    const qFastbootPresent = snapshot.qualifiedFastbootDevices.length > 0;
    const buildQualified = Boolean(snapshot.qualificationBuild?.qualifiedFlashCompiled);
    const activeRestricted = snapshot.policies.filter((policy) => policy.activeInBobfwtools && policy.risk === 'restricted');
    const unqualifiedDestructive = snapshot.policies.filter(
      (policy) => policy.activeInBobfwtools && policy.risk === 'destructive' && !policy.physicallyQualified,
    );
    const driverMismatches = snapshot.driverBindings.filter((binding) => binding.bindingState !== 'matched');
    const unstableDriverClaims = Object.values(snapshot.driverStability).filter((report) => !report.stable);
    const enabledOneClick = snapshot.capabilities?.workflows.filter((workflow) => workflow.enabled).length ?? 0;
    const observedDeviceModel = diag?.device.model?.trim() || null;
    const exactModelBundles = observedDeviceModel
      ? (firmware?.bundles.filter(
          (bundle) =>
            bundle.planningReady &&
            Boolean(bundle.packageFingerprint) &&
            Boolean(bundle.model) &&
            bundle.model!.trim().toLowerCase() === observedDeviceModel.toLowerCase(),
        ) ?? [])
      : [];
    const executorById = (id: string) => snapshot.executors.find((executor) => executor.id === id);
    const samsungExecutor = executorById('samsung-odin-writer');
    const qcomExecutor = executorById('qualcomm-firehose-writer');
    const mtkExecutor = executorById('mediatek-download-writer');
    const qualifiedFastbootExecutor = executorById('qualified-fastboot-writer');
    const calibrationBackupExecutor = executorById('calibration-backup-reader');
    const calibrationRestoreExecutor = executorById('calibration-restore-writer');
    const hardwareStorageExecutor = executorById('hardware-storage-service');
    const bootforgeMediaExecutor = executorById('bootforge-media-writer');

    const rows: FlowRow[] = [];

    rows.push({
      id: 'diagnostics',
      label: 'USB + device diagnostics',
      state: ws?.readyForDiagnostics && (diag?.usbDevicesSeen ?? 0) > 0 ? 'ready' : 'blocked',
      summary: ws?.readyForDiagnostics
        ? `${diag?.usbDevicesSeen ?? 0} USB device signal(s) observed; diagnostics workstation is ready.`
        : 'Workstation diagnostics prerequisites are incomplete.',
      next: ws?.readyForDiagnostics
        ? ((diag?.usbDevicesSeen ?? 0) > 0 ? 'No software blocker.' : 'Connect a data-capable device and rerun the sweep.')
        : 'Run Automate safe setup, then resolve any remaining workstation blocker.',
      evidence: [
        `workstation diagnostics=${Boolean(ws?.readyForDiagnostics)}`,
        `usb devices=${diag?.usbDevicesSeen ?? 0}`,
      ],
    });

    rows.push({
      id: 'adb',
      label: 'ADB authorized service',
      state: ws?.readyForAndroidService && authorizedAdb ? 'ready' : 'blocked',
      summary: authorizedAdb
        ? 'At least one ADB target is authorized and available for safe automated Android service.'
        : 'No authorized ADB target is currently proven.',
      next: authorizedAdb
        ? 'Safe one-click ADB workflows may run against the selected exact serial.'
        : 'Unlock the device, accept its ADB authorization prompt, then rerun the sweep.',
      evidence: [
        `android service workstation=${Boolean(ws?.readyForAndroidService)}`,
        `authorized adb=${diag?.authorizedAdbDevices ?? 0}`,
      ],
    });

    rows.push({
      id: 'fastboot',
      label: 'Fastboot mode control',
      state: fastbootPresent ? 'ready' : 'blocked',
      summary: fastbootPresent
        ? `${snapshot.fastbootDevices.length} exact Fastboot serial(s) detected.`
        : 'No Fastboot target is currently detected.',
      next: fastbootPresent
        ? 'Mode/reboot controls are available. Flash authority remains separately qualification-gated.'
        : 'Transition an authorized device to bootloader/Fastboot and rerun the sweep.',
      evidence: snapshot.fastbootDevices.map((serial) => `fastboot:${serial}`),
    });

    rows.push({
      id: 'samsung',
      label: 'Samsung Download Mode',
      state: samsungDetected
        ? (samsungExecutor?.compiled ? 'bench-gated' : 'executor-gated')
        : 'blocked',
      summary: samsungDetected
        ? `Samsung Download Mode is physically detected. Executor state: ${samsungExecutor?.implementationState || 'unknown'}.`
        : 'No Samsung Download Mode target is currently detected.',
      next: samsungDetected
        ? 'The Samsung lane is planning-only today (executionEnabled=false). Finish exact model/package verification and implement a separately qualified Samsung executor before physical bench qualification can authorize writes.'
        : 'Connect the intended Samsung target in Download Mode.',
      evidence: snapshot.transports
        .filter((item) => item.mode === 'samsung-download')
        .map((item) => `${item.deviceUid}:${item.mode}`),
    });

    const qcomState: FlowState = qcomCandidate && qcomBundle && snapshot.authorizedProgrammers > 0
      ? (qcomExecutor?.compiled ? 'bench-gated' : 'executor-gated')
      : qcomCandidate || qcomBundle
        ? 'planning-ready'
        : 'blocked';
    rows.push({
      id: 'qualcomm',
      label: 'Qualcomm EDL / Firehose',
      state: qcomState,
      summary: `EDL target=${qcomCandidate}; verified Qualcomm bundle=${qcomBundle}; authorized programmer(s)=${snapshot.authorizedProgrammers}; executor=${qcomExecutor?.implementationState || 'unknown'}.`,
      next: qcomState === 'executor-gated'
        ? 'Software evidence is assembled, but Qualcomm recovery execution is still disabled and Firehose is dry-run-only. Implement and separately qualify an authenticated executor before any bench write.'
        : 'Connect the exact EDL target, import an official/authorized hash-bound bundle, and enroll a legitimate authorized programmer.',
      evidence: [
        `edl target=${qcomCandidate}`,
        `verified bundle=${qcomBundle}`,
        `authorized programmers=${snapshot.authorizedProgrammers}`,
      ],
    });

    const mtkState: FlowState = mtkCandidate && mtkBundle
      ? (mtkExecutor?.compiled ? 'bench-gated' : 'executor-gated')
      : mtkCandidate || mtkBundle
        ? 'planning-ready'
        : 'blocked';
    rows.push({
      id: 'mediatek',
      label: 'MediaTek BROM / Preloader',
      state: mtkState,
      summary: `MediaTek recovery target=${mtkCandidate}; verified MediaTek bundle=${mtkBundle}; executor=${mtkExecutor?.implementationState || 'unknown'}.`,
      next: mtkState === 'executor-gated'
        ? 'Use only legitimate OEM/service DA/auth material. The current MediaTek lane is planning-only; implement and qualify a real authenticated executor before destructive bench qualification.'
        : 'Connect the target in BROM/Preloader and import an official/authorized hash-bound package.',
      evidence: [`mtk target=${mtkCandidate}`, `verified bundle=${mtkBundle}`],
    });

    rows.push({
      id: 'firmware',
      label: 'Verified firmware library',
      state: anyVerifiedBundle ? 'ready' : 'blocked',
      summary: anyVerifiedBundle
        ? `${firmware?.bundles.filter((bundle) => bundle.planningReady && Boolean(bundle.packageFingerprint)).length ?? 0} package(s) are provenance-valid, exact-identity-bound, and fingerprinted.`
        : 'No package currently satisfies verified provenance + exact identity + deterministic package fingerprint.',
      next: anyVerifiedBundle
        ? 'Verified packages can feed package-bound recovery jobs.'
        : 'Import official/authorized firmware and build exact provenance for model/board/SKU.',
      evidence: [`blocked artifacts=${firmware?.blockedCount ?? 0}`],
    });

    rows.push({
      id: 'target-identity',
      label: 'Exact firmware target identity preflight',
      state: observedDeviceModel && exactModelBundles.length > 0 ? 'planning-ready' : 'blocked',
      summary: observedDeviceModel
        ? `Observed device model=${observedDeviceModel}; exact-model verified bundle candidates=${exactModelBundles.length}.`
        : 'No independently observed device model is currently available for firmware target matching.',
      next: observedDeviceModel && exactModelBundles.length > 0
        ? 'Model evidence is only the first gate. Obtain independently verified bootloader revision and partition-layout identity, then run firmware_target_preflight with destructive=true before any write authority can be issued.'
        : 'Connect/authorize the device, obtain independent device identity evidence, and require an exact verified package match.',
      evidence: [
        `device model=${observedDeviceModel || '<unavailable>'}`,
        `exact-model verified packages=${exactModelBundles.length}`,
        'destructive layout identity is never inferred from chipset/model alone',
      ],
    });

    rows.push({
      id: 'drivers',
      label: 'Windows exact-interface driver ownership',
      state: !snapshot.adminRequired
        ? 'ready'
        : driverMismatches.length === 0 && unstableDriverClaims.length === 0 && snapshot.adminReady
          ? 'ready'
          : 'blocked',
      summary: !snapshot.adminRequired
        ? 'Windows driver mutation gating is not applicable on this host.'
        : driverMismatches.length
          ? `${driverMismatches.length} Windows USB interface claim(s) are not verified.`
          : unstableDriverClaims.length
            ? `${unstableDriverClaims.length} verified claim(s) showed service/INF or presence churn during the stability sample.`
            : snapshot.adminReady
              ? 'Driver claims are verified, stable, and Administrator mutation readiness is available.'
              : 'Driver inspection is available, but Administrator rights are not active.',
      next: !snapshot.adminRequired
        ? 'No action on this host.'
        : driverMismatches.length
          ? 'Use the automatically generated conflict plan, exact-interface candidates, and verified relatch path before service.'
          : unstableDriverClaims.length
            ? 'Resolve cable/port or competing-driver claim churn and require CLAIM STABLE before firmware service.'
            : snapshot.adminReady
              ? 'No driver blocker.'
              : 'Restart BobFWTools as Administrator before PnP mutation.',
      evidence: [
        `driver bindings=${snapshot.driverBindings.length}`,
        `mismatches=${driverMismatches.length}`,
        `unstable claims=${unstableDriverClaims.length}`,
        `conflict plans=${Object.keys(snapshot.driverConflicts).length}`,
        `admin ready=${snapshot.adminReady}`,
      ],
    });

    rows.push({
      id: 'qualified-writer',
      label: 'Qualified destructive writer',
      state: buildQualified && qFastbootPresent && qualifiedFastbootExecutor?.compiled
        ? 'bench-gated'
        : buildQualified
          ? 'planning-ready'
          : 'blocked',
      summary: buildQualified
        ? `Qualified writer is compiled; ${snapshot.qualifiedFastbootDevices.length} qualified Fastboot target(s) currently detected; executor=${qualifiedFastbootExecutor?.implementationState || 'unknown'}.`
        : `This build does not expose the qualified destructive writer; executor=${qualifiedFastbootExecutor?.implementationState || 'unknown'}.`,
      next: buildQualified && qFastbootPresent
        ? 'Complete dossier → one-partition bench trial → bench evidence → human decision → audit bundle → short-lived production grant.'
        : buildQualified
          ? 'Connect the designated Fastboot bench target and collect physical qualification evidence.'
          : 'Use the qualified-writer build lane; do not bypass the build-time gate.',
      evidence: [
        `qualified build=${buildQualified}`,
        `qualified fastboot targets=${snapshot.qualifiedFastbootDevices.length}`,
      ],
    });

    rows.push({
      id: 'automation',
      label: 'One-click safe automation',
      state: enabledOneClick > 0 ? 'ready' : 'blocked',
      summary: `${enabledOneClick} workflow capability/capabilities are currently enabled by detected evidence.`,
      next: enabledOneClick > 0
        ? 'Run only workflows shown as enabled for the selected device; completed jobs retain audit evidence.'
        : 'Connect/authorize a supported target and rerun the sweep.',
      evidence: snapshot.capabilities?.workflows.map(
        (workflow) => `${workflow.id}=${workflow.enabled ? 'enabled' : 'blocked'}`,
      ) ?? [],
    });

    const policyById = (id: string) => snapshot.policies.find((policy) => policy.id === id);

    const calibrationBackup = policyById('calibration.backup');
    const calibrationBackupPrequalified =
      Boolean(calibrationBackup?.activeInBobfwtools) &&
      authorizedAdb &&
      snapshot.calibrationAllowlist.length > 0;
    rows.push({
      id: 'calibration-backup',
      label: 'Calibration / identity partition backup',
      state: calibrationBackupPrequalified && calibrationBackupExecutor?.compiled
        ? 'planning-ready'
        : calibrationBackup?.activeInBobfwtools
          ? 'planning-ready'
          : 'blocked',
      summary: calibrationBackup?.activeInBobfwtools
        ? `Allowlisted backup policy is active; ${snapshot.calibrationAllowlist.length} protected partition name(s) are allowlisted; authorized ADB target=${authorizedAdb}. No backup is assumed captured until a verified manifest exists.`
        : 'Calibration backup policy is not active.',
      next: calibrationBackup?.activeInBobfwtools
        ? (calibrationBackupPrequalified
            ? 'Choose an explicit backup destination and prove legitimate block/service access, then capture hash-bound same-device backup manifests. The sweep does not auto-read protected partitions.'
            : 'Authorize exactly one ADB target and confirm the calibration allowlist before any backup attempt.')
        : 'Enable only the approved allowlisted backup lane; do not add identity-editing behavior.',
      evidence: calibrationBackup ? [
        `${calibrationBackup.id}:${calibrationBackup.risk}:physical=${calibrationBackup.physicallyQualified}`,
        `allowlist count=${snapshot.calibrationAllowlist.length}`,
        `authorized adb=${authorizedAdb}`,
        'backup evidence captured=false unless a verified manifest is explicitly created',
      ] : [],
    });

    const calibrationRestore = policyById('calibration.restore');
    rows.push({
      id: 'calibration-restore',
      label: 'Calibration restore',
      state: calibrationRestore?.activeInBobfwtools
        ? (calibrationRestoreExecutor?.compiled ? 'bench-gated' : 'executor-gated')
        : 'blocked',
      summary: calibrationRestore?.activeInBobfwtools
        ? 'Same-device restore policy is active, destructive, and still not physically qualified.'
        : 'Calibration restore policy is not active.',
      next: calibrationRestore?.activeInBobfwtools
        ? 'Require a verified same-device backup manifest, hash/size match, exact partition binding, rollback evidence, and designated-device bench qualification. Never expose IMEI/identity rewriting.'
        : 'Keep restore unavailable until the protected same-device evidence path is enabled.',
      evidence: calibrationRestore ? [`${calibrationRestore.id}:${calibrationRestore.risk}:physical=${calibrationRestore.physicallyQualified}`] : [],
    });

    const storageIdentify = policyById('hardware.storage-identify');
    rows.push({
      id: 'storage-identify',
      label: 'ISP / JTAG / eMMC / UFS storage identification',
      state: storageIdentify?.activeInBobfwtools
        ? (hardwareStorageExecutor?.compiled ? 'bench-gated' : 'planning-ready')
        : 'blocked',
      summary: storageIdentify?.activeInBobfwtools
        ? 'Hardware-service planning is active and intentionally begins read-only.'
        : 'Hardware storage-identification planning is inactive.',
      next: storageIdentify?.activeInBobfwtools
        ? 'Capture board/storage evidence, exact chip geometry, voltage/pinout references, and backup strategy before any invasive bench operation.'
        : 'Keep invasive hardware work disabled until a read-only evidence profile exists.',
      evidence: storageIdentify ? [`${storageIdentify.id}:${storageIdentify.risk}:physical=${storageIdentify.physicallyQualified}`] : [],
    });

    const chipOff = policyById('hardware.chip-off-plan');
    rows.push({
      id: 'chip-off',
      label: 'Chip-off / reball planning',
      state: chipOff?.activeInBobfwtools
        ? (hardwareStorageExecutor?.compiled ? 'bench-gated' : 'executor-gated')
        : 'blocked',
      summary: chipOff?.activeInBobfwtools
        ? 'Chip-off/reball is planning-only and not physically qualified.'
        : 'Chip-off/reball planning is inactive.',
      next: chipOff?.activeInBobfwtools
        ? 'Require designated bench procedures, board-specific thermal profile, storage backup/read verification, and independent physical qualification before execution.'
        : 'Do not expose chip-off execution from generic desktop automation.',
      evidence: chipOff ? [`${chipOff.id}:${chipOff.risk}:physical=${chipOff.physicallyQualified}`] : [],
    });

    const bootforgeMedia = policyById('bootforge.media');
    rows.push({
      id: 'bootforge-media',
      label: 'BootForge removable-media provisioning',
      state: bootforgeMedia?.activeInBobfwtools
        ? (bootforgeMediaExecutor?.compiled ? 'bench-gated' : 'executor-gated')
        : 'blocked',
      summary: bootforgeMedia?.activeInBobfwtools
        ? 'Destructive removable-media provisioning is active in policy but remains physically unqualified.'
        : 'BootForge media provisioning is inactive.',
      next: bootforgeMedia?.activeInBobfwtools
        ? 'Require target re-identification immediately before each destructive step, backup/rollback evidence, and designated-media qualification.'
        : 'Keep media writes disabled.',
      evidence: bootforgeMedia ? [`${bootforgeMedia.id}:${bootforgeMedia.risk}:physical=${bootforgeMedia.physicallyQualified}`] : [],
    });

    rows.push({
      id: 'policy',
      label: 'Safety / approval policy',
      state: activeRestricted.length > 0
        ? 'blocked'
        : unqualifiedDestructive.length > 0
          ? 'bench-gated'
          : 'ready',
      summary: activeRestricted.length
        ? `${activeRestricted.length} restricted workflow(s) are active and must be disabled.`
        : unqualifiedDestructive.length
          ? `${unqualifiedDestructive.length} destructive workflow(s) remain correctly physical-qualification-gated.`
          : 'No active restricted workflow is exposed and active destructive policies are qualified.',
      next: activeRestricted.length
        ? 'Disable restricted/bypass-class workflow exposure before release.'
        : unqualifiedDestructive.length
          ? 'Finish physical qualification; do not convert this gate into a software-only approval.'
          : 'Policy layer has no current release blocker.',
      evidence: snapshot.policies.map(
        (policy) => `${policy.id}:${policy.risk}:active=${policy.activeInBobfwtools}:physical=${policy.physicallyQualified}`,
      ),
    });

    return rows;
  }, [snapshot]);

  const counts = useMemo(() => ({
    ready: flows.filter((flow) => flow.state === 'ready').length,
    planning: flows.filter((flow) => flow.state === 'planning-ready').length,
    executor: flows.filter((flow) => flow.state === 'executor-gated').length,
    bench: flows.filter((flow) => flow.state === 'bench-gated').length,
    blocked: flows.filter((flow) => flow.state === 'blocked').length,
  }), [flows]);

  const exportGapReport = async () => {
    if (!nativeRuntime || busy || snapshot.scannedAt === 0) return;
    setBusy('export');
    try {
      const path = await exportHardwareApprovalGapReport({
        scannedAt: snapshot.scannedAt,
        counts,
        flows,
        sweepErrors: snapshot.errors,
      });
      if (path) setGapReportPath(path);
    } finally {
      setBusy(null);
    }
  };

  const exportQualificationCandidate = async (flow: FlowRow) => {
    if (!nativeRuntime || busy || flow.state !== 'executor-gated') return;
    const executorIdByFlow: Record<string, string> = {
      samsung: 'samsung-odin-writer',
      qualcomm: 'qualcomm-firehose-writer',
      mediatek: 'mediatek-download-writer',
      'calibration-restore': 'calibration-restore-writer',
      'chip-off': 'hardware-storage-service',
      'bootforge-media': 'bootforge-media-writer',
    };
    const executor = snapshot.executors.find((item) => item.id === executorIdByFlow[flow.id]);
    const packageFingerprints = snapshot.firmware?.bundles
      .filter((bundle) => {
        if (!bundle.packageFingerprint) return false;
        if (flow.id === 'qualcomm') return bundle.vendorHint === 'qualcomm';
        if (flow.id === 'mediatek') return bundle.vendorHint === 'mediatek';
        return false;
      })
      .map((bundle) => bundle.packageFingerprint!)
      ?? [];

    const deviceEvidence = snapshot.transports.map(
      (device) =>
        `${device.deviceUid}|${device.mode}|${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}|${device.serialNumber || '<none>'}`,
    );
    const driverEvidence = [
      ...snapshot.driverBindings.map(
        (binding) => `${binding.instanceId}|${binding.bindingState}|${binding.claimMatchScope}`,
      ),
      ...Object.values(snapshot.driverStability).map(
        (report) => `${report.requestedInstanceId}|stable=${report.stable}|changes=${report.claimChanges}|disappearances=${report.disappearanceEvents}`,
      ),
    ];

    const requiredPhysicalChecks = [
      'Repeated exact-device enumeration stability',
      'Expected service/recovery mode confirmed',
      'Endpoint or transport stability confirmed',
      'Exact firmware target identity including partition layout',
      'Backup/rollback evidence captured where required',
      'Partition/range bounds independently verified',
      'One designated-device bench trial if a qualified executor exists',
      'Post-write verification before production authority',
    ];

    setBusy('export');
    try {
      const path = await exportHardwareQualificationCandidate({
        flowId: flow.id,
        executorState: executor?.implementationState || 'unknown',
        deviceEvidence,
        packageFingerprints,
        workstationReady: Boolean(snapshot.workstation?.readyForDiagnostics),
        driverEvidence,
        requiredPhysicalChecks,
        blockers: [
          flow.next,
          ...(executor?.compiled ? [] : ['Production executor is not compiled/enabled for this flow.']),
        ],
      });
      if (path) {
        setCandidatePaths((current) => ({ ...current, [flow.id]: path }));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-4 rounded-lg border border-violet-900/60 bg-violet-950/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400">Hardware Flow Approval Matrix</div>
          <h2 className="mt-1 text-base font-semibold text-white">One sweep for every hardware lane</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Automates every safe software check it can prove. Destructive execution stays stopped at the physical bench gate until real designated-device evidence exists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!nativeRuntime || Boolean(busy)}
            onClick={() => void runSweep()}
            className="rounded border border-violet-700 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-40 hover:bg-violet-950/40"
          >
            {busy === 'sweep' ? 'Sweeping…' : 'Run full safe sweep'}
          </button>
          <button
            type="button"
            disabled={!nativeRuntime || Boolean(busy)}
            onClick={() => void automateSafeSetup()}
            className="rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-violet-600"
          >
            {busy === 'setup' ? 'Setting up…' : 'Automate safe setup'}
          </button>
          <button
            type="button"
            disabled={!nativeRuntime || Boolean(busy)}
            onClick={() => void runAllSafeAutomations()}
            className="rounded border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40 hover:bg-cyan-950/40"
          >
            {busy === 'automation' ? 'Running safe checks…' : 'Run all safe automated checks'}
          </button>
          <button
            type="button"
            disabled={!nativeRuntime || Boolean(busy) || snapshot.scannedAt === 0}
            onClick={() => void exportGapReport()}
            className="rounded border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40 hover:bg-slate-800"
          >
            {busy === 'export' ? 'Exporting…' : 'Export approval gap report'}
          </button>
        </div>
      </div>

      {!nativeRuntime && (
        <div className="mt-3 rounded border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-200">
          Hardware approval sweeps require the native BobFWTools desktop runtime.
        </div>
      )}

      {snapshot.scannedAt > 0 && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Ready</div>
              <div className="mt-1 text-xl font-semibold text-emerald-300">{counts.ready}</div>
            </div>
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Planning ready</div>
              <div className="mt-1 text-xl font-semibold text-cyan-300">{counts.planning}</div>
            </div>
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Executor gated</div>
              <div className="mt-1 text-xl font-semibold text-fuchsia-300">{counts.executor}</div>
            </div>
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Bench gated</div>
              <div className="mt-1 text-xl font-semibold text-amber-300">{counts.bench}</div>
            </div>
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Blocked</div>
              <div className="mt-1 text-xl font-semibold text-rose-300">{counts.blocked}</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {flows.map((flow) => (
              <div key={flow.id} className={`rounded border p-3 ${stateClasses(flow.state)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">{flow.label}</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-300">{flow.summary}</div>
                  </div>
                  <span className="rounded border border-current/30 px-2 py-1 text-[10px] font-semibold">{stateLabel(flow.state)}</span>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-slate-400">
                  <span className="font-semibold text-slate-300">Next:</span> {flow.next}
                </div>
                {flow.state === 'executor-gated' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void exportQualificationCandidate(flow)}
                      className="rounded border border-fuchsia-800 px-2 py-1 text-[10px] font-semibold text-fuchsia-300 disabled:opacity-40 hover:bg-fuchsia-950/30"
                    >
                      Export qualification candidate
                    </button>
                    {candidatePaths[flow.id] && (
                      <span className="break-all font-mono text-[9px] text-slate-600">
                        {candidatePaths[flow.id]}
                      </span>
                    )}
                  </div>
                )}
                {flow.evidence.length > 0 && (
                  <div className="mt-2 break-all font-mono text-[9px] leading-4 text-slate-600">
                    {flow.evidence.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {gapReportPath && (
            <div className="mt-4 rounded border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-300">
              Approval gap report saved: <span className="break-all font-mono">{gapReportPath}</span>
              <div className="mt-1 text-[10px] text-slate-500">Evidence only. The report grants no execution authority.</div>
            </div>
          )}

          {snapshot.errors.length > 0 && (
            <div className="mt-4 rounded border border-amber-900/50 bg-amber-950/20 p-3">
              <div className="text-xs font-semibold text-amber-200">Sweep warnings</div>
              {snapshot.errors.map((error) => (
                <div key={error} className="mt-1 text-[10px] leading-4 text-amber-300">{error}</div>
              ))}
            </div>
          )}
        </>
      )}

      {(automationResults.length > 0 || automationNote) && (
        <div className="mt-4 rounded border border-cyan-900/50 bg-cyan-950/10 p-3">
          <div className="text-xs font-semibold text-cyan-200">Safe automation batch</div>
          {automationNote && <div className="mt-1 text-[11px] leading-5 text-slate-400">{automationNote}</div>}
          {automationResults.length > 0 && (
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {automationResults.map((job) => (
                <div key={job.id} className="rounded border border-slate-800 bg-black/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-slate-300">{job.workflowId}</span>
                    <span className={job.verified ? 'text-[10px] text-emerald-300' : 'text-[10px] text-amber-300'}>
                      {job.state}{job.verified ? ' · verified' : ''}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-500">{job.summary}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 text-[10px] leading-4 text-slate-600">
            This batch excludes reboot/mode-change, settings, firmware writes, calibration restore, and every destructive/restricted workflow.
          </div>
        </div>
      )}

      {snapshot.scannedAt === 0 && (
        <div className="mt-4 rounded border border-slate-800 bg-black/20 p-4 text-sm text-slate-500">
          Run the safe sweep to build the current approval matrix. No destructive command is executed by this panel.
        </div>
      )}
    </section>
  );
}
