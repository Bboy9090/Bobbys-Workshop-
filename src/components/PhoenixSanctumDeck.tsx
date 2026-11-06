import { useCallback, useEffect, useState } from 'react';
import {
  auditSanctumRootPrivilege,
  auditSanctumSiliconFuses,
  chooseSanctumRootArtifact,
  executeSanctumBasebandBackup,
  issueSanctumChamberGrant,
  isTauriRuntime,
  probeSanctumBasebandCrucible,
  probeSanctumEdlSahara,
  probeSanctumMtkBrom,
  stageSanctumRootArtifact,
  verifySanctumShadowChain,
  type AdbDeviceRecord,
  type BasebandCrucibleReport,
  type CalibrationBackupResult,
  type MtkBromLiveProbeResult,
  type RootPrivilegeAuditReport,
  type SaharaLiveProbeResult,
  type SanctumArtifactStageReceipt,
  type SanctumChamberGrant,
  type SanctumChainVerification,
  type SiliconFusePostureReport,
} from '../lib/desktop';

type SanctumTab = 'root-vault' | 'silicon-fuse' | 'baseband-crucible' | 'shadow-chain';

interface PhoenixSanctumDeckProps {
  adbDevices: AdbDeviceRecord[];
  selectedAdbSerial: string | null;
  onSelectAdbSerial: (serial: string) => void;
}

function formatBytes(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value < 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function PhoenixSanctumDeck({
  adbDevices,
  selectedAdbSerial,
  onSelectAdbSerial,
}: PhoenixSanctumDeckProps) {
  const [activeTab, setActiveTab] = useState<SanctumTab>('root-vault');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [grant, setGrant] = useState<SanctumChamberGrant | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rootReport, setRootReport] = useState<RootPrivilegeAuditReport | null>(null);
  const [siliconReport, setSiliconReport] = useState<SiliconFusePostureReport | null>(null);
  const [basebandReport, setBasebandReport] = useState<BasebandCrucibleReport | null>(null);
  const [chainReport, setChainReport] = useState<SanctumChainVerification | null>(null);

  const [rootMethod, setRootMethod] = useState<'magisk' | 'kernelsu' | 'apatch' | 'custom'>('magisk');
  const [artifactPath, setArtifactPath] = useState('');
  const [stageReceipt, setStageReceipt] = useState<SanctumArtifactStageReceipt | null>(null);
  const [edlProbeResult, setEdlProbeResult] = useState<SaharaLiveProbeResult | null>(null);
  const [mtkProbeResult, setMtkProbeResult] = useState<MtkBromLiveProbeResult | null>(null);
  const [backupReceipts, setBackupReceipts] = useState<Record<string, CalibrationBackupResult>>({});

  const nativeRuntime = isTauriRuntime();
  const activeDevice = adbDevices.find((d) => d.serial === selectedAdbSerial) || null;

  const refreshChain = useCallback(async () => {
    if (!nativeRuntime) return;
    try {
      const verified = await verifySanctumShadowChain(35);
      setChainReport(verified);
    } catch {
      // Non-fatal on initial load
    }
  }, [nativeRuntime]);

  useEffect(() => {
    void refreshChain();
  }, [refreshChain]);

  const handleIssueGrant = async () => {
    setBusy('grant');
    setError(null);
    try {
      const issued = await issueSanctumChamberGrant(
        'all',
        selectedAdbSerial,
        confirmationPhrase,
      );
      setGrant(issued);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleRunRootAudit = async () => {
    if (!selectedAdbSerial) {
      setError('Select an authorized ADB target serial before running Root & Privilege interrogation.');
      return;
    }
    if (!grant) {
      setError('Unlock Phoenix Sanctum with an HMAC-SHA256 chamber grant first.');
      return;
    }
    setBusy('root-audit');
    setError(null);
    try {
      const report = await auditSanctumRootPrivilege(selectedAdbSerial, grant);
      setRootReport(report);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleRunSiliconAudit = async () => {
    if (!selectedAdbSerial) {
      setError('Select an authorized ADB target serial before running Silicon & Fuse interrogation.');
      return;
    }
    if (!grant) {
      setError('Unlock Phoenix Sanctum with an HMAC-SHA256 chamber grant first.');
      return;
    }
    setBusy('silicon-audit');
    setError(null);
    try {
      const report = await auditSanctumSiliconFuses(selectedAdbSerial, grant);
      setSiliconReport(report);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleRunBasebandProbe = async () => {
    if (!selectedAdbSerial) {
      setError('Select an authorized ADB target serial before probing the Baseband & EFS Crucible.');
      return;
    }
    if (!grant) {
      setError('Unlock Phoenix Sanctum with an HMAC-SHA256 chamber grant first.');
      return;
    }
    setBusy('baseband-probe');
    setError(null);
    try {
      const report = await probeSanctumBasebandCrucible(selectedAdbSerial, grant);
      setBasebandReport(report);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleProbeEdlSahara = async () => {
    if (!grant) {
      setError('Unlock Phoenix Sanctum with an HMAC-SHA256 chamber grant first.');
      return;
    }
    setBusy('edl-probe');
    setError(null);
    try {
      const res = await probeSanctumEdlSahara(grant, 2500);
      setEdlProbeResult(res);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleProbeMtkBrom = async () => {
    if (!grant) {
      setError('Unlock Phoenix Sanctum with an HMAC-SHA256 chamber grant first.');
      return;
    }
    setBusy('mtk-probe');
    setError(null);
    try {
      const res = await probeSanctumMtkBrom(grant, 2500);
      setMtkProbeResult(res);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleBackupPartition = async (partition: string) => {
    if (!selectedAdbSerial || !grant) return;
    setBusy(`backup-${partition}`);
    setError(null);
    try {
      const receipt = await executeSanctumBasebandBackup(selectedAdbSerial, partition, grant);
      setBackupReceipts((prev) => ({ ...prev, [partition]: receipt }));
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleBrowseArtifact = async () => {
    const picked = await chooseSanctumRootArtifact();
    if (picked) {
      setArtifactPath(picked);
    }
  };

  const handleStageArtifact = async () => {
    if (!selectedAdbSerial) {
      setError('Select a target device serial before staging or flashing a root artifact.');
      return;
    }
    if (!grant) {
      setError('Unlock Phoenix Sanctum with an HMAC-SHA256 chamber grant first.');
      return;
    }
    if (!artifactPath.trim()) {
      setError('Choose or enter a local .apk, .img, or .zip artifact path.');
      return;
    }
    setBusy('stage-artifact');
    setError(null);
    setStageReceipt(null);
    try {
      const receipt = await stageSanctumRootArtifact(
        selectedAdbSerial,
        rootMethod,
        artifactPath.trim(),
        grant,
      );
      setStageReceipt(receipt);
      await refreshChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      id="phoenix-sanctum-deck"
      className="mb-4 rounded-lg border border-purple-900/70 bg-gradient-to-br from-slate-950 via-slate-900/95 to-purple-950/20 p-5 shadow-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-purple-700/80 bg-purple-950/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-300">
              Phoenix Sanctum · Hardware-Rooted Chambers
            </span>
            {grant ? (
              <span className="rounded border border-emerald-700/80 bg-emerald-950/50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                HMAC GRANT ACTIVE · {grant.hmacSignature.slice(0, 12)}…
              </span>
            ) : (
              <span className="rounded border border-amber-800/80 bg-amber-950/50 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                SEALED · REQUIRES OPERATOR PHRASE
              </span>
            )}
          </div>
          <h2 className="mt-2 text-base font-semibold text-white">
            Phoenix Sanctum — Cryptographic Hardware Chambers &amp; Tamper-Evident Audit Chain
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Replaces legacy static-passcode Secret Rooms with hardware-bound HMAC-SHA256 session grants, live ADB/Fastboot
            privilege &amp; silicon fuse telemetry, allowlisted EFS/NVRAM block-node probing, and a SHA-256 hash-chained
            chain-of-custody ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {adbDevices.length > 0 && (
            <select
              value={selectedAdbSerial || ''}
              onChange={(e) => {
                onSelectAdbSerial(e.target.value);
                setGrant(null);
              }}
              className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200"
            >
              <option value="">Unbound / Select ADB Target</option>
              {adbDevices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.serial} ({d.authorized ? 'authorized' : d.state})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Cryptographic Chamber Gate Bar */}
      <div className="mt-4 rounded border border-purple-900/50 bg-black/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder="Type SANCTUM or ROOT to mint HMAC grant…"
              className="w-64 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-purple-500"
            />
            <button
              type="button"
              disabled={!nativeRuntime || busy === 'grant'}
              onClick={() => void handleIssueGrant()}
              className="rounded bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-40"
            >
              {busy === 'grant'
                ? 'Minting HMAC Grant…'
                : grant
                  ? 'Re-Issue Hardware-Bound Grant'
                  : 'Unlock Sanctum Chambers'}
            </button>
            {grant && (
              <button
                type="button"
                onClick={() => setGrant(null)}
                className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Seal Sanctum
              </button>
            )}
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Target Binding:{' '}
            <span className="text-purple-300">
              {grant?.boundSerial || selectedAdbSerial || 'Workstation-Scoped (*)'}
            </span>
          </div>
        </div>

        {grant && (
          <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-slate-800/80 pt-2 font-mono text-[10px] text-slate-500">
            <span>Grant ID: {grant.grantId}</span>
            <span>Workstation FP: {grant.workstationFingerprint.slice(0, 16)}…</span>
            <span>HMAC-SHA256: {grant.hmacSignature.slice(0, 24)}…</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded border border-rose-800/80 bg-rose-950/30 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Chamber Navigation Tabs */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {(
          [
            ['root-vault', '1. Root & Privilege Sanctum'],
            ['silicon-fuse', '2. Silicon & Fuse Posture'],
            ['baseband-crucible', '3. Baseband & EFS Crucible'],
            [
              'shadow-chain',
              `4. Shadow Chain-of-Custody (${chainReport ? `${chainReport.totalEntries} entries` : 'ledger'})`,
            ],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === tabId
                ? 'border border-purple-600 bg-purple-950/50 text-purple-200'
                : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CHAMBER 1: Root & Privilege Sanctum */}
      {activeTab === 'root-vault' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                  Live Privilege &amp; Verified Boot Interrogation
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Probes <code className="text-slate-300">id -u</code>, <code className="text-slate-300">su</code>{' '}
                  vectors, Magisk, KernelSU, APatch, LSPosed, SELinux, <code className="text-slate-300">vbmeta</code>,
                  and bootloader lock state.
                </p>
              </div>
              <button
                type="button"
                disabled={!nativeRuntime || !grant || !activeDevice?.authorized || busy === 'root-audit'}
                onClick={() => void handleRunRootAudit()}
                className="rounded bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-40"
              >
                {busy === 'root-audit' ? 'Interrogating…' : 'Audit Target Privilege'}
              </button>
            </div>

            {!rootReport ? (
              <div className="mt-4 rounded border border-slate-800/80 bg-black/20 p-3 text-xs text-slate-500">
                Unlock the Sanctum and click &ldquo;Audit Target Privilege&rdquo; to inspect live root and verified-boot
                posture on {selectedAdbSerial || 'the selected ADB target'}.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                    <div className="text-[10px] uppercase text-slate-500">Root Status</div>
                    <div
                      className={`mt-1 text-xs font-bold ${
                        rootReport.rooted ? 'text-amber-300' : 'text-emerald-300'
                      }`}
                    >
                      {rootReport.rooted ? 'ROOT DETECTED' : 'UNROOTED STOCK'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                    <div className="text-[10px] uppercase text-slate-500">Bootloader</div>
                    <div
                      className={`mt-1 text-xs font-bold ${
                        rootReport.bootloaderUnlocked ? 'text-amber-300' : 'text-emerald-300'
                      }`}
                    >
                      {rootReport.bootloaderUnlocked ? 'UNLOCKED' : 'LOCKED'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                    <div className="text-[10px] uppercase text-slate-500">SELinux / Verity</div>
                    <div className="mt-1 font-mono text-xs text-white">
                      {rootReport.selinuxMode} · {rootReport.dmVerityState}
                    </div>
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-black/30 p-3 text-xs">
                  <div className="grid grid-cols-2 gap-y-1.5">
                    <span className="text-slate-500">Privilege Tier:</span>
                    <span className="font-mono text-purple-300">{rootReport.privilegeTier}</span>
                    <span className="text-slate-500">Magisk / KernelSU:</span>
                    <span className="font-mono text-slate-200">
                      {rootReport.magiskVersion || 'none'} / {rootReport.kernelsuVersion || 'none'}
                    </span>
                    <span className="text-slate-500">APatch / LSPosed:</span>
                    <span className="font-mono text-slate-200">
                      {rootReport.apatchDetected ? 'APatch present' : 'no APatch'} ·{' '}
                      {rootReport.xposedLsposedDetected ? 'LSPosed/Xposed present' : 'no Xposed'}
                    </span>
                    <span className="text-slate-500">Verified Boot / Slot:</span>
                    <span className="font-mono text-slate-200">
                      {rootReport.verifiedBootState} ({rootReport.activeSlot || 'single-slot'})
                    </span>
                    <span className="text-slate-500">Discovered SU Paths:</span>
                    <span className="break-all font-mono text-[11px] text-slate-300">
                      {rootReport.suBinaryPaths.length ? rootReport.suBinaryPaths.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="mt-2 border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-500">
                    Report SHA-256: {rootReport.reportSha256}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Audited Root Artifact Staging & Boot Image Deployment */}
          <div className="rounded border border-slate-800 bg-slate-950/70 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-300">
              SHA-256 Verified Root Manager &amp; Boot Image Staging
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Hashes your local <code className="text-slate-300">.apk</code>, patched{' '}
              <code className="text-slate-300">boot.img</code>, or module archive before installing via ADB or flashing
              in Fastboot mode, recording the digest into the Sanctum hash chain.
            </p>

            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['magisk', 'kernelsu', 'apatch', 'custom'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRootMethod(m)}
                    className={`rounded border px-2.5 py-1.5 font-mono text-xs uppercase ${
                      rootMethod === m
                        ? 'border-purple-500 bg-purple-950/40 text-purple-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={artifactPath}
                  onChange={(e) => setArtifactPath(e.target.value)}
                  placeholder="/path/to/magisk_patched_boot.img or manager.apk"
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white"
                />
                <button
                  type="button"
                  disabled={!nativeRuntime}
                  onClick={() => void handleBrowseArtifact()}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                >
                  Browse…
                </button>
              </div>

              <button
                type="button"
                disabled={!nativeRuntime || !grant || !selectedAdbSerial || !artifactPath.trim() || busy === 'stage-artifact'}
                onClick={() => void handleStageArtifact()}
                className="w-full rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
              >
                {busy === 'stage-artifact'
                  ? 'Hashing & Deploying Artifact…'
                  : `Verify SHA-256 & Deploy ${rootMethod.toUpperCase()} Artifact`}
              </button>

              {stageReceipt && (
                <div className="rounded border border-emerald-900/70 bg-emerald-950/20 p-3 text-xs text-emerald-200">
                  <div className="font-semibold">{stageReceipt.actionTaken}</div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-300/90">
                    SHA-256: {stageReceipt.artifactSha256}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">
                    Destination: {stageReceipt.deviceStagingPath} · {formatBytes(stageReceipt.artifactBytes)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHAMBER 2: Silicon & Fuse Posture */}
      {activeTab === 'silicon-fuse' && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Silicon Architecture, Fuse &amp; Anti-Rollback Interrogation
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Extracts live SoC platform, hardware SKU, AVB version, warranty/Knox fuse bit, and supported low-level
                boot recovery protocols.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!nativeRuntime || !grant || busy === 'edl-probe'}
                onClick={() => void handleProbeEdlSahara()}
                className="rounded border border-cyan-700 bg-cyan-950/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60 disabled:opacity-40"
              >
                {busy === 'edl-probe' ? 'Probing 9008…' : 'Live Probe Qualcomm 9008 Sahara'}
              </button>
              <button
                type="button"
                disabled={!nativeRuntime || !grant || busy === 'mtk-probe'}
                onClick={() => void handleProbeMtkBrom()}
                className="rounded border border-purple-700 bg-purple-950/60 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-900/60 disabled:opacity-40"
              >
                {busy === 'mtk-probe' ? 'Syncing BROM…' : 'Live Handshake MediaTek BROM'}
              </button>
              <button
                type="button"
                disabled={!nativeRuntime || !grant || !activeDevice?.authorized || busy === 'silicon-audit'}
                onClick={() => void handleRunSiliconAudit()}
                className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40"
              >
                {busy === 'silicon-audit' ? 'Probing Silicon…' : 'Probe Silicon & Fuses'}
              </button>
            </div>
          </div>

          {(edlProbeResult || mtkProbeResult) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {edlProbeResult && (
                <div className="rounded border border-cyan-800/80 bg-cyan-950/20 p-3 font-mono text-xs text-cyan-200">
                  <div className="font-bold">Qualcomm EDL 9008 Sahara HELLO Received</div>
                  <div className="mt-1 text-[11px] text-slate-300">
                    Bus {edlProbeResult.bus} Addr {edlProbeResult.address} · IN 0x
                    {edlProbeResult.inEndpoint.toString(16)} / OUT 0x{edlProbeResult.outEndpoint.toString(16)} · Sahara
                    v{edlProbeResult.hello.version} (Mode {edlProbeResult.hello.mode})
                  </div>
                </div>
              )}
              {mtkProbeResult && (
                <div className="rounded border border-purple-800/80 bg-purple-950/20 p-3 font-mono text-xs text-purple-200">
                  <div className="font-bold">
                    MediaTek BROM Synced: {mtkProbeResult.identity.chipName} ({mtkProbeResult.identity.hwCodeHex})
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300">
                    Bus {mtkProbeResult.bus} Addr {mtkProbeResult.address} · Mode {mtkProbeResult.mode}
                  </div>
                </div>
              )}
            </div>
          )}

          {!siliconReport ? (
            <div className="mt-4 rounded border border-slate-800/80 bg-black/20 p-3 text-xs text-slate-500">
              Click &ldquo;Probe Silicon &amp; Fuses&rdquo; to inspect hardware fuse bits, AVB posture, and BootROM/EDL
              capabilities.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[10px] uppercase text-slate-500">SoC Platform</div>
                  <div className="mt-1 font-mono text-xs font-semibold text-white">
                    {siliconReport.socVendor} · {siliconReport.socPlatform}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Bootloader &amp; SKU</div>
                  <div className="mt-1 font-mono text-xs text-cyan-300">
                    {siliconReport.bootloaderVersion} ({siliconReport.hardwareSku})
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Warranty / Fuse Bit</div>
                  <div className="mt-1 font-mono text-xs text-amber-300">{siliconReport.warrantyBitOrFuse}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[10px] uppercase text-slate-500">AVB &amp; Patch Level</div>
                  <div className="mt-1 font-mono text-xs text-emerald-300">
                    AVB {siliconReport.avbVersion} · {siliconReport.securityPatchLevel}
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-black/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  Applicable Low-Level Silicon Recovery Protocols
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {siliconReport.usbRecoveryCapable.map((cap) => (
                    <span
                      key={cap}
                      className="rounded border border-cyan-900 bg-cyan-950/30 px-2.5 py-1 font-mono text-xs text-cyan-200"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
                <div className="mt-2 font-mono text-[10px] text-slate-500">
                  Report SHA-256: {siliconReport.reportSha256}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHAMBER 3: Baseband & EFS Crucible */}
      {activeTab === 'baseband-crucible' && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Baseband &amp; Calibration Partition Crucible (Allowlisted Non-Destructive Probe)
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Resolves live block paths for allowlisted radio/calibration partitions (
                <code className="text-slate-300">efs</code>, <code className="text-slate-300">modemst1</code>,{' '}
                <code className="text-slate-300">modemst2</code>, <code className="text-slate-300">fsg</code>,{' '}
                <code className="text-slate-300">persist</code>, <code className="text-slate-300">nvram</code>,{' '}
                <code className="text-slate-300">nvdata</code>) to verify preservation backup readiness.
              </p>
            </div>
            <button
              type="button"
              disabled={!nativeRuntime || !grant || !activeDevice?.authorized || busy === 'baseband-probe'}
              onClick={() => void handleRunBasebandProbe()}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
            >
              {busy === 'baseband-probe' ? 'Probing Block Nodes…' : 'Probe Calibration Partitions'}
            </button>
          </div>

          {!basebandReport ? (
            <div className="mt-4 rounded border border-slate-800/80 bg-black/20 p-3 text-xs text-slate-500">
              Click &ldquo;Probe Calibration Partitions&rdquo; to inspect baseband properties and allowlisted calibration
              block nodes on {selectedAdbSerial || 'the selected target'}.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">Baseband Version</div>
                  <div className="mt-1 truncate font-mono text-xs text-white">{basebandReport.basebandVersion}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">RIL Implementation</div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-300">{basebandReport.rilImpl}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">SIM State / Operator</div>
                  <div className="mt-1 font-mono text-xs text-cyan-300">
                    {basebandReport.simState} ({basebandReport.simOperatorAlpha})
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">Raw Block Read Access</div>
                  <div
                    className={`mt-1 text-xs font-bold ${
                      basebandReport.rootBlockAccessAvailable ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {basebandReport.rootBlockAccessAvailable ? 'ROOT BLOCK ACCESS READY' : 'NEEDS SU FOR RAW DUMP'}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Partition</th>
                      <th className="px-3 py-2">Candidate Node</th>
                      <th className="px-3 py-2">Resolved Block Path</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Preservation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 bg-black/20 font-mono text-[11px]">
                    {basebandReport.partitions.map((p) => {
                      const receipt = backupReceipts[p.partition];
                      return (
                        <tr key={p.partition}>
                          <td className="px-3 py-1.5 font-semibold text-white">{p.partition}</td>
                          <td className="px-3 py-1.5 text-slate-400">{p.candidateNode}</td>
                          <td className="px-3 py-1.5 text-cyan-300">{p.resolvedBlockPath || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-300">
                            {p.sizeBytes != null ? formatBytes(p.sizeBytes) : '—'}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={
                                p.readableWithCurrentPrivilege
                                  ? 'text-emerald-300'
                                  : p.resolvedBlockPath
                                    ? 'text-amber-300'
                                    : 'text-slate-500'
                              }
                            >
                              {receipt ? `SAVED (${receipt.sha256.slice(0, 10)}…)` : p.status}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <button
                              type="button"
                              disabled={
                                !p.readableWithCurrentPrivilege ||
                                busy === `backup-${p.partition}`
                              }
                              onClick={() => void handleBackupPartition(p.partition)}
                              className="rounded border border-emerald-700/80 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-30"
                            >
                              {busy === `backup-${p.partition}`
                                ? 'Extracting…'
                                : receipt
                                  ? 'Re-Extract .img'
                                  : 'Backup .img + SHA256'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHAMBER 4: Shadow Chain-of-Custody Ledger */}
      {activeTab === 'shadow-chain' && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Tamper-Evident SHA-256 Hash-Chained Shadow Ledger
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Every Sanctum grant and chamber operation is cryptographically chained (
                <code className="text-slate-300">prevHash → entryHash</code>). Modifying any historical line breaks the
                chain verification immediately.
              </p>
            </div>
            <button
              type="button"
              disabled={!nativeRuntime}
              onClick={() => void refreshChain()}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              Re-Verify Hash Chain
            </button>
          </div>

          {chainReport && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-black/30 p-3 font-mono text-xs">
                <div>
                  Chain Integrity:{' '}
                  <span className={chainReport.intact ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                    {chainReport.intact
                      ? 'CRYPTOGRAPHICALLY INTACT'
                      : `TAMPER DETECTED AT SEQ #${chainReport.brokenAtSequence}`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Entries: {chainReport.totalEntries} · Head Hash: {chainReport.headHash.slice(0, 20)}…
                </div>
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {chainReport.entries.length === 0 ? (
                  <div className="rounded border border-slate-800 bg-black/20 p-3 text-xs text-slate-500">
                    No Sanctum chain entries recorded yet. Mint a chamber grant above to initialize the genesis block.
                  </div>
                ) : (
                  chainReport.entries.map((entry) => (
                    <div
                      key={entry.sequence}
                      className="rounded border border-slate-800/90 bg-black/30 p-2.5 font-mono text-[11px]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-purple-300">
                          #{entry.sequence} [{entry.chamber}] {entry.operation}
                        </span>
                        <span className="text-emerald-300">{entry.status}</span>
                      </div>
                      <div className="mt-1 text-slate-300">{entry.detail}</div>
                      <div className="mt-1 flex flex-wrap gap-4 text-[10px] text-slate-500">
                        <span>prev: {entry.prevHash.slice(0, 16)}…</span>
                        <span>hash: {entry.entryHash.slice(0, 16)}…</span>
                        {entry.serial && <span>target: {entry.serial}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
