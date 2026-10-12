import { useMemo, useState } from 'react';
import {
  diagnosePhone,
  getDriverElevationStatus,
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
  scanAdbDevices,
  scanDriverBindings,
  scanFirmwareLibrary,
  scanRecoveryCandidates,
  scanTransportDevices,
  type DeviceCapabilityMatrix,
  type DriverBindingRecord,
  type FirmwareLibraryReport,
  type PhoneDiagnosticReport,
  type QualificationBuildIdentity,
  type RecoveryCandidate,
  type TransportDevice,
  type WorkflowPolicy,
  type WorkstationReadiness,
} from '../lib/desktop';

type FlowState = 'ready' | 'planning-ready' | 'bench-gated' | 'blocked';

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
  policies: WorkflowPolicy[];
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
  policies: [],
  authorizedProgrammers: 0,
  adminRequired: false,
  adminReady: true,
  errors: [],
});

function stateClasses(state: FlowState): string {
  if (state === 'ready') return 'border-emerald-900/60 bg-emerald-950/15 text-emerald-200';
  if (state === 'planning-ready') return 'border-cyan-900/60 bg-cyan-950/15 text-cyan-200';
  if (state === 'bench-gated') return 'border-amber-900/60 bg-amber-950/15 text-amber-200';
  return 'border-rose-900/60 bg-rose-950/15 text-rose-200';
}

function stateLabel(state: FlowState): string {
  if (state === 'ready') return 'READY';
  if (state === 'planning-ready') return 'PLANNING READY';
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
  const [busy, setBusy] = useState<'sweep' | 'setup' | null>(null);

  const collectSweep = async () => {
    const errors: string[] = [];

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
      safeCall('qualified fastboot scan', getQualifiedFastbootDevices, errors),
      safeCall('driver claim scan', scanDriverBindings, errors),
      safeCall('workflow policy catalog', getWorkflowPolicyCatalog, errors),
      safeCall('authorized programmer inventory', listEdlProgrammers, errors),
      safeCall('Windows elevation readiness', getDriverElevationStatus, errors),
      safeCall('ADB scan', scanAdbDevices, errors),
    ]);

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
      policies: policies ?? [],
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
    const enabledOneClick = snapshot.capabilities?.workflows.filter((workflow) => workflow.enabled).length ?? 0;

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
      state: samsungDetected ? 'bench-gated' : 'blocked',
      summary: samsungDetected
        ? 'Samsung Download Mode is physically detected. Firmware inspection/planning may proceed.'
        : 'No Samsung Download Mode target is currently detected.',
      next: samsungDetected
        ? 'Verify exact stock firmware identity, backup/recovery evidence, then complete the designated-device bench qualification before any destructive write.'
        : 'Connect the intended Samsung target in Download Mode.',
      evidence: snapshot.transports
        .filter((item) => item.mode === 'samsung-download')
        .map((item) => `${item.deviceUid}:${item.mode}`),
    });

    const qcomState: FlowState = qcomCandidate && qcomBundle && snapshot.authorizedProgrammers > 0
      ? 'bench-gated'
      : qcomCandidate || qcomBundle
        ? 'planning-ready'
        : 'blocked';
    rows.push({
      id: 'qualcomm',
      label: 'Qualcomm EDL / Firehose',
      state: qcomState,
      summary: `EDL target=${qcomCandidate}; verified Qualcomm bundle=${qcomBundle}; authorized programmer(s)=${snapshot.authorizedProgrammers}.`,
      next: qcomState === 'bench-gated'
        ? 'Software evidence is assembled. Complete repeated-enumeration, endpoint, backup, one-partition bench-write, and post-write verification on the designated device.'
        : 'Connect the exact EDL target, import an official/authorized hash-bound bundle, and enroll a legitimate authorized programmer.',
      evidence: [
        `edl target=${qcomCandidate}`,
        `verified bundle=${qcomBundle}`,
        `authorized programmers=${snapshot.authorizedProgrammers}`,
      ],
    });

    const mtkState: FlowState = mtkCandidate && mtkBundle ? 'bench-gated' : mtkCandidate || mtkBundle ? 'planning-ready' : 'blocked';
    rows.push({
      id: 'mediatek',
      label: 'MediaTek BROM / Preloader',
      state: mtkState,
      summary: `MediaTek recovery target=${mtkCandidate}; verified MediaTek bundle=${mtkBundle}.`,
      next: mtkState === 'bench-gated'
        ? 'Use only legitimate OEM/service DA/auth material and complete designated-device physical qualification before destructive execution.'
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
      id: 'drivers',
      label: 'Windows exact-interface driver ownership',
      state: !snapshot.adminRequired
        ? 'ready'
        : driverMismatches.length === 0 && snapshot.adminReady
          ? 'ready'
          : 'blocked',
      summary: !snapshot.adminRequired
        ? 'Windows driver mutation gating is not applicable on this host.'
        : driverMismatches.length
          ? `${driverMismatches.length} Windows USB interface claim(s) are not verified.`
          : snapshot.adminReady
            ? 'Driver claims are verified and Administrator mutation readiness is available.'
            : 'Driver inspection is available, but Administrator rights are not active.',
      next: !snapshot.adminRequired
        ? 'No action on this host.'
        : driverMismatches.length
          ? 'Use Driver Claim Inspector, exact-interface candidates, conflict plan, and stability test before any relatch.'
          : snapshot.adminReady
            ? 'No driver blocker.'
            : 'Restart BobFWTools as Administrator before PnP mutation.',
      evidence: [
        `driver bindings=${snapshot.driverBindings.length}`,
        `mismatches=${driverMismatches.length}`,
        `admin ready=${snapshot.adminReady}`,
      ],
    });

    rows.push({
      id: 'qualified-writer',
      label: 'Qualified destructive writer',
      state: buildQualified && qFastbootPresent ? 'bench-gated' : buildQualified ? 'planning-ready' : 'blocked',
      summary: buildQualified
        ? `Qualified writer is compiled; ${snapshot.qualifiedFastbootDevices.length} qualified Fastboot target(s) currently detected.`
        : 'This build does not expose the qualified destructive writer.',
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
    bench: flows.filter((flow) => flow.state === 'bench-gated').length,
    blocked: flows.filter((flow) => flow.state === 'blocked').length,
  }), [flows]);

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
        </div>
      </div>

      {!nativeRuntime && (
        <div className="mt-3 rounded border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-200">
          Hardware approval sweeps require the native BobFWTools desktop runtime.
        </div>
      )}

      {snapshot.scannedAt > 0 && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Ready</div>
              <div className="mt-1 text-xl font-semibold text-emerald-300">{counts.ready}</div>
            </div>
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Planning ready</div>
              <div className="mt-1 text-xl font-semibold text-cyan-300">{counts.planning}</div>
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
                {flow.evidence.length > 0 && (
                  <div className="mt-2 break-all font-mono text-[9px] leading-4 text-slate-600">
                    {flow.evidence.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>

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

      {snapshot.scannedAt === 0 && (
        <div className="mt-4 rounded border border-slate-800 bg-black/20 p-4 text-sm text-slate-500">
          Run the safe sweep to build the current approval matrix. No destructive command is executed by this panel.
        </div>
      )}
    </section>
  );
}
