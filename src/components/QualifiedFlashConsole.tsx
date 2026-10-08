import { useEffect, useMemo, useState } from 'react';
import {
  chooseAndInspectQualifiedFlashImage,
  exportQualificationBenchEvidence,
  exportQualificationDecision,
  getQualificationBuildIdentity,
  getQualifiedFastbootDevices,
  issueQualificationTrialGrant,
  issueQualifiedFlashGrant,
  reviewQualificationDossier,
  startQualifiedFastbootFlash,
  type QualificationBuildIdentity,
  type QualificationDossierReview,
  type QualifiedFlashGrant,
  type QualifiedFlashPartition,
  type QualifiedFlashPhysicalChecks,
} from '../lib/desktop';

const CHECK_LABELS: Array<[keyof QualifiedFlashPhysicalChecks, string]> = [
  ['repeatedEnumerationStable', 'Repeated enumeration is stable'],
  ['expectedModeConfirmed', 'Expected recovery / fastboot mode confirmed'],
  ['endpointStabilityConfirmed', 'Transport endpoint stability confirmed'],
  ['programmerHashVerified', 'Programmer / service artifact hash verified'],
  ['preflightMatched', 'Firmware, model, rollback and layout preflight matched'],
  ['partitionBoundsVerified', 'Partition bounds / target mapping verified'],
  ['backupEvidencePresent', 'Required backup / rollback evidence is present'],
  ['destructiveBenchWritePassed', 'Designated-device destructive bench write passed'],
  ['postWriteVerificationPassed', 'Post-write verification passed on designated device'],
];

const EMPTY_CHECKS: QualifiedFlashPhysicalChecks = {
  repeatedEnumerationStable: false,
  expectedModeConfirmed: false,
  endpointStabilityConfirmed: false,
  programmerHashVerified: false,
  preflightMatched: false,
  partitionBoundsVerified: false,
  backupEvidencePresent: false,
  destructiveBenchWritePassed: false,
  postWriteVerificationPassed: false,
};

const PARTITIONS = [
  'boot', 'system', 'vendor', 'userdata', 'cache', 'recovery',
  'bootloader', 'radio', 'aboot', 'vbmeta', 'dtbo', 'persist',
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

type Props = {
  recoveryJobFingerprint?: string | null;
};

export default function QualifiedFlashConsole({ recoveryJobFingerprint }: Props) {
  const [build, setBuild] = useState<QualificationBuildIdentity | null>(null);
  const [fastbootDevices, setFastbootDevices] = useState<string[]>([]);
  const [deviceSerial, setDeviceSerial] = useState('');
  const [review, setReview] = useState<QualificationDossierReview | null>(null);
  const [partitionName, setPartitionName] = useState('boot');
  const [partitions, setPartitions] = useState<QualifiedFlashPartition[]>([]);
  const [checks, setChecks] = useState<QualifiedFlashPhysicalChecks>(EMPTY_CHECKS);
  const [reviewer, setReviewer] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [allowWipe, setAllowWipe] = useState(false);
  const [allowReboot, setAllowReboot] = useState(false);
  const [grant, setGrant] = useState<QualifiedFlashGrant | null>(null);
  const [benchEvidencePath, setBenchEvidencePath] = useState<string | null>(null);
  const [decisionPath, setDecisionPath] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preChecksPass = useMemo(
    () => (
      checks.repeatedEnumerationStable &&
      checks.expectedModeConfirmed &&
      checks.endpointStabilityConfirmed &&
      checks.programmerHashVerified &&
      checks.preflightMatched &&
      checks.partitionBoundsVerified &&
      checks.backupEvidencePresent
    ),
    [checks],
  );
  const allChecksPass = useMemo(
    () => preChecksPass && checks.destructiveBenchWritePassed && checks.postWriteVerificationPassed,
    [checks, preChecksPass],
  );
  const grantExpired = grant ? grant.expiresAtUnixSeconds * 1000 <= Date.now() : false;
  const readyToTrial = Boolean(
    build?.qualifiedFlashCompiled &&
    review?.safeToReview &&
    recoveryJobFingerprint &&
    deviceSerial &&
    partitions.length === 1 &&
    reviewer.trim() &&
    confirmation === `BENCH QUALIFY ${deviceSerial}` &&
    preChecksPass,
  );
  const readyToIssue = Boolean(
    build?.qualifiedFlashCompiled &&
    review?.safeToReview &&
    recoveryJobFingerprint &&
    deviceSerial &&
    partitions.length &&
    reviewer.trim() &&
    benchEvidencePath &&
    decisionPath &&
    confirmation === `QUALIFY ${deviceSerial}` &&
    allChecksPass,
  );

  const refreshTargets = async () => {
    setBusy(true);
    setError(null);
    try {
      const identity = await getQualificationBuildIdentity();
      setBuild(identity);
      if (identity?.qualifiedFlashCompiled) {
        const serials = await getQualifiedFastbootDevices();
        setFastbootDevices(serials);
        if (!deviceSerial && serials.length === 1) setDeviceSerial(serials[0]);
        if (deviceSerial && !serials.includes(deviceSerial)) setDeviceSerial('');
      } else {
        setFastbootDevices([]);
        setDeviceSerial('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshTargets();
    // The destructive command surface is only queried after build identity proves it exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setReview(null);
    setGrant(null);
    setBenchEvidencePath(null);
    setDecisionPath(null);
  }, [recoveryJobFingerprint]);

  const reviewSavedDossier = async () => {
    setBusy(true);
    setError(null);
    setGrant(null);
    try {
      const result = await reviewQualificationDossier(recoveryJobFingerprint);
      if (result) setReview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addImage = async () => {
    setBusy(true);
    setError(null);
    setGrant(null);
    try {
      const inspected = await chooseAndInspectQualifiedFlashImage(partitionName);
      if (!inspected) return;
      setPartitions((current) => [
        ...current.filter((item) => item.name !== inspected.name),
        inspected,
      ]);
      setBenchEvidencePath(null);
      setDecisionPath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const issueTrialGrant = async () => {
    if (!review || !recoveryJobFingerprint || !readyToTrial) return;
    setBusy(true);
    setError(null);
    setGrant(null);
    setJobId(null);
    try {
      const issued = await issueQualificationTrialGrant({
        dossierPath: review.path,
        benchEvidencePath: null,
        reviewDecisionPath: null,
        expectedRecoveryJobFingerprint: recoveryJobFingerprint,
        deviceSerial,
        partitions,
        wipeUserDataAllowed: false,
        autoRebootAllowed: false,
        reviewer: reviewer.trim(),
        reviewerNotes: reviewerNotes.trim(),
        confirmation,
        expiresInMinutes: Math.min(expiresInMinutes, 10),
        physicalChecks: checks,
      });
      setGrant(issued);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportBenchEvidence = async () => {
    if (!review || !recoveryJobFingerprint || !deviceSerial || !reviewer.trim() || !allChecksPass || !partitions.length) return;
    setBusy(true);
    setError(null);
    setGrant(null);
    setDecisionPath(null);
    try {
      const path = await exportQualificationBenchEvidence({
        dossierPath: review.path,
        expectedRecoveryJobFingerprint: recoveryJobFingerprint,
        deviceSerial,
        reviewer: reviewer.trim(),
        reviewerNotes: reviewerNotes.trim(),
        partitions,
        physicalChecks: checks,
      });
      if (path) setBenchEvidencePath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportDecision = async (decision: 'accept-evidence' | 'reject-evidence') => {
    if (!review || !recoveryJobFingerprint || !deviceSerial || !reviewer.trim()) return;
    setBusy(true);
    setError(null);
    setGrant(null);
    try {
      const path = await exportQualificationDecision({
        dossierPath: review.path,
        benchEvidencePath: decision === 'accept-evidence' ? benchEvidencePath : null,
        expectedRecoveryJobFingerprint: recoveryJobFingerprint,
        deviceSerial,
        reviewer: reviewer.trim(),
        reviewerNotes: reviewerNotes.trim(),
        decision,
        physicalChecks: checks,
      });
      if (path) setDecisionPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const issueGrant = async () => {
    if (!review || !recoveryJobFingerprint || !readyToIssue) return;
    setBusy(true);
    setError(null);
    setGrant(null);
    setJobId(null);
    try {
      const issued = await issueQualifiedFlashGrant({
        dossierPath: review.path,
        benchEvidencePath,
        reviewDecisionPath: decisionPath,
        expectedRecoveryJobFingerprint: recoveryJobFingerprint,
        deviceSerial,
        partitions,
        wipeUserDataAllowed: allowWipe,
        autoRebootAllowed: allowReboot,
        reviewer: reviewer.trim(),
        reviewerNotes: reviewerNotes.trim(),
        confirmation,
        expiresInMinutes,
        physicalChecks: checks,
      });
      setGrant(issued);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startFlash = async () => {
    if (!grant || grantExpired) return;
    setBusy(true);
    setError(null);
    try {
      const response = await startQualifiedFastbootFlash(
        deviceSerial,
        partitions,
        grant,
        grant.qualificationStatus === 'qualification-trial'
          ? { wipeUserData: false, autoReboot: false }
          : { wipeUserData: allowWipe, autoReboot: allowReboot },
      );
      setJobId(response.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-rose-950/80 bg-rose-950/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-400">
            Qualified Destructive Writer
          </div>
          <h2 className="mt-1 text-sm font-semibold text-white">Physical qualification authority</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            This panel cannot self-qualify. It only becomes usable in a qualified-flash build, after a verified dossier,
            exact live fastboot target, approved image hashes, and every physical bench check are explicitly recorded.
          </p>
        </div>
        <span className={build?.qualifiedFlashCompiled
          ? 'rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-xs font-semibold text-amber-300'
          : 'rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-500'}>
          {build?.qualifiedFlashCompiled ? 'QUALIFIED BUILD — AUTHORITY LOCKED' : 'NOT COMPILED IN THIS BUILD'}
        </span>
      </div>

      {!build?.qualifiedFlashCompiled ? (
        <div className="mt-4 rounded border border-slate-800 bg-black/20 p-4 text-xs text-slate-500">
          The ordinary BobFWTools build intentionally has no destructive command surface. Hosted CI still compiles and tests
          the qualified writer separately so this lane cannot silently rot.
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-600">Exact fastboot target</div>
                <button type="button" onClick={() => void refreshTargets()} disabled={busy} className="text-xs text-cyan-300 disabled:opacity-40">
                  Refresh
                </button>
              </div>
              <select value={deviceSerial} onChange={(e) => { setDeviceSerial(e.target.value); setGrant(null); setConfirmation(''); setBenchEvidencePath(null); setDecisionPath(null); }} className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                <option value="">Select exact fastboot serial</option>
                {fastbootDevices.map((serial) => <option key={serial} value={serial}>{serial}</option>)}
              </select>
              {!fastbootDevices.length && <div className="mt-2 text-xs text-amber-300">No fastboot target is currently connected.</div>}
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-[10px] uppercase tracking-wide text-slate-600">Qualification dossier</div>
              <button type="button" onClick={() => void reviewSavedDossier()} disabled={busy || !recoveryJobFingerprint} className="mt-2 rounded border border-cyan-800 px-3 py-2 text-xs text-cyan-300 disabled:opacity-40">
                Review bound dossier
              </button>
              {review && <div className={review.safeToReview ? 'mt-2 text-xs font-semibold text-emerald-300' : 'mt-2 text-xs font-semibold text-rose-300'}>
                {review.safeToReview ? 'VERIFIED FOR PHYSICAL REVIEW' : 'BLOCKED'}
              </div>}
              {!!review?.blockers.length && <div className="mt-2 space-y-1 text-[11px] text-rose-300">{review.blockers.map((b) => <div key={b}>{b}</div>)}</div>}
            </div>
          </div>

          <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Qualified partition images</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <select value={partitionName} onChange={(e) => setPartitionName(e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                {PARTITIONS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" onClick={() => void addImage()} disabled={busy} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">
                Choose + SHA-256 image
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {partitions.map((item) => (
                <div key={item.name} className="rounded border border-slate-800 bg-black/20 p-2 text-[10px]">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{item.name}</span><span className="text-slate-500">{formatBytes(item.size)}</span></div>
                  <div className="mt-1 break-all font-mono text-cyan-400">{item.expectedSha256}</div>
                  <div className="mt-1 truncate text-slate-600" title={item.imagePath}>{item.imagePath}</div>
                  <button type="button" onClick={() => { setPartitions((current) => current.filter((p) => p.name !== item.name)); setGrant(null); setBenchEvidencePath(null); setDecisionPath(null); }} className="mt-1 text-rose-300">Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Physical bench qualification — manual evidence</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {CHECK_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 rounded border border-slate-800 p-2 text-xs text-slate-300">
                  <input type="checkbox" checked={checks[key]} onChange={(e) => { setChecks((current) => ({ ...current, [key]: e.target.checked })); setGrant(null); setBenchEvidencePath(null); setDecisionPath(null); }} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
              <label className="block text-xs text-slate-500">Reviewer identity<input value={reviewer} onChange={(e) => { setReviewer(e.target.value); setGrant(null); setBenchEvidencePath(null); setDecisionPath(null); }} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              <label className="mt-2 block text-xs text-slate-500">Reviewer notes<textarea value={reviewerNotes} onChange={(e) => { setReviewerNotes(e.target.value); setGrant(null); setBenchEvidencePath(null); setDecisionPath(null); }} className="mt-1 min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
              <label className="block text-xs text-slate-500">Grant lifetime (minutes)<input type="number" min={1} max={30} value={expiresInMinutes} onChange={(e) => { setExpiresInMinutes(Math.max(1, Math.min(30, Number(e.target.value) || 1))); setGrant(null); }} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              <label className="mt-2 flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={allowWipe} onChange={(e) => { setAllowWipe(e.target.checked); setGrant(null); }} />Grant may wipe userdata</label>
              <label className="mt-2 flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={allowReboot} onChange={(e) => { setAllowReboot(e.target.checked); setGrant(null); }} />Grant may reboot automatically</label>
              <label className="mt-3 block text-xs text-rose-300">
                Bench trial: {deviceSerial ? `BENCH QUALIFY ${deviceSerial}` : 'select a device first'}<br />
                Production: {deviceSerial ? `QUALIFY ${deviceSerial}` : 'select a device first'}
                <input value={confirmation} onChange={(e) => { setConfirmation(e.target.value); setGrant(null); }} className="mt-1 w-full rounded border border-rose-900 bg-slate-950 px-3 py-2 font-mono text-white" />
              </label>
            </div>
          </div>

          <div className="mt-3 rounded border border-cyan-900/60 bg-cyan-950/20 p-4">
            <div className="text-[10px] uppercase tracking-wide text-cyan-600">Stage 2 bench-evidence receipt</div>
            <p className="mt-2 text-xs text-slate-400">
              After the one-shot bench write and independent post-write verification, freeze the exact device, build, dossier,
              recovery job, inspected image hashes, and passed physical checks into an authority-free receipt.
            </p>
            <button
              type="button"
              onClick={() => void exportBenchEvidence()}
              disabled={busy || !review?.safeToReview || !allChecksPass || !reviewer.trim() || !deviceSerial || !partitions.length}
              className="mt-3 rounded border border-cyan-800 px-3 py-2 text-xs font-semibold text-cyan-300 disabled:opacity-40"
            >
              Export hash-bound bench evidence
            </button>
            {benchEvidencePath && (
              <div className="mt-2 break-all font-mono text-[10px] text-cyan-400">
                bench evidence: {benchEvidencePath}
              </div>
            )}
          </div>

          <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Stage 2 human decision receipt</div>
            <p className="mt-2 text-xs text-slate-400">
              After the one-shot bench write and independent post-write verification, record the evidence decision.
              This receipt is hash-bound and grants no authority by itself.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void exportDecision('accept-evidence')}
                disabled={busy || !review?.safeToReview || !allChecksPass || !reviewer.trim() || !deviceSerial || !benchEvidencePath}
                className="rounded border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40"
              >
                Accept evidence + export decision receipt
              </button>
              <button
                type="button"
                onClick={() => void exportDecision('reject-evidence')}
                disabled={busy || !reviewer.trim() || !deviceSerial || !review}
                className="rounded border border-rose-900 px-3 py-2 text-xs text-rose-300 disabled:opacity-40"
              >
                Reject evidence + export decision receipt
              </button>
            </div>
            {decisionPath && (
              <div className="mt-2 break-all font-mono text-[10px] text-cyan-400">
                decision receipt: {decisionPath}
              </div>
            )}
          </div>

          <div className="mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-200">
            Stage 1 bench trial requires the first seven checks, exactly one non-critical partition, and no wipe/reboot.
            Stage 2 production authority additionally requires all checks plus an accepted hash-bound decision receipt.
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void issueTrialGrant()} disabled={busy || !readyToTrial} className="rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-40">
              Issue one-shot bench trial grant
            </button>
            <button type="button" onClick={() => void issueGrant()} disabled={busy || !readyToIssue} className="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
              Issue production-qualified grant
            </button>
            <button type="button" onClick={() => void startFlash()} disabled={busy || !grant || grantExpired} className="rounded bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
              {grant?.qualificationStatus === 'qualification-trial' ? 'START ONE-SHOT BENCH WRITE' : 'START QUALIFIED DESTRUCTIVE FLASH'}
            </button>
            {grant && <span className={grantExpired ? 'text-xs text-rose-300' : 'text-xs text-emerald-300'}>{grantExpired ? 'grant expired' : `${grant.qualificationStatus} capability active`}</span>}
          </div>

          {jobId && <div className="mt-3 rounded border border-emerald-900 bg-emerald-950/20 p-3 text-xs text-emerald-300">Flash job started: <span className="font-mono">{jobId}</span></div>}
        </>
      )}

      {error && <div className="mt-3 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">{error}</div>}
    </section>
  );
}
