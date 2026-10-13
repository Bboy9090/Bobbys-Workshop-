import { useEffect, useState } from 'react';
import {
  buildHardwareFlowReadinessReport,
  type HardwareFlowReadinessReport,
} from '../lib/desktop';

function stateClasses(state: 'ready' | 'guided' | 'blocked'): string {
  if (state === 'ready') return 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300';
  if (state === 'guided') return 'border-amber-900/60 bg-amber-950/20 text-amber-300';
  return 'border-rose-900/50 bg-rose-950/20 text-rose-300';
}

export default function HardwareFlowReadiness() {
  const [report, setReport] = useState<HardwareFlowReadinessReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await buildHardwareFlowReadinessReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void runAudit();
    // One initial read-only sweep only; the operator controls later rescans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-4 rounded-xl border border-violet-900/60 bg-violet-950/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-400">
            Auto Hardware Readiness
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            Detect once. Show only the workflows that actually fit the connected hardware.
          </div>
          <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            This pass runs read-only probes in parallel across workstation tools, ADB, Fastboot, MTP,
            native USB, recovery transports, verified firmware bundles, Windows driver claims, and
            elevation state. It can automate evidence collection, but destructive operations still stop
            at designated-device physical qualification.
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runAudit()}
          className="rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-violet-600"
        >
          {busy ? 'Running full safe audit…' : 'Run full safe hardware audit'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-300">
          Hardware readiness audit failed: {error}
        </div>
      )}

      {report && (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className={report.softwareReady
              ? 'rounded border border-emerald-900/60 bg-emerald-950/20 p-3'
              : 'rounded border border-amber-900/60 bg-amber-950/20 p-3'}>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Software readiness</div>
              <div className={report.softwareReady ? 'mt-1 font-semibold text-emerald-300' : 'mt-1 font-semibold text-amber-300'}>
                {report.softwareReady ? 'SOFTWARE READY' : 'SOFTWARE BLOCKERS REMAIN'}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Detected hardware</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {report.transportDevices.length} USB · {report.adbDevices.length} ADB · {report.fastbootSerials.length} Fastboot
              </div>
            </div>
            <div className={report.physicalApprovalRequired
              ? 'rounded border border-amber-900/60 bg-amber-950/20 p-3'
              : 'rounded border border-slate-800 bg-black/20 p-3'}>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Physical qualification</div>
              <div className={report.physicalApprovalRequired ? 'mt-1 font-semibold text-amber-300' : 'mt-1 font-semibold text-slate-300'}>
                {report.physicalApprovalRequired ? 'REQUIRED FOR WRITE LANES' : 'NOT REQUIRED FOR CURRENT READ-ONLY LANES'}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded border border-slate-800 bg-black/20 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hardware write approval gates</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {report.approvalGates.map((gate) => (
                <div key={gate.id} className={gate.satisfied
                  ? 'rounded border border-emerald-900/50 bg-emerald-950/10 p-2'
                  : 'rounded border border-slate-800 bg-slate-950/70 p-2'}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold text-slate-300">{gate.title}</div>
                    <span className={gate.satisfied ? 'text-[10px] text-emerald-300' : 'text-[10px] text-amber-300'}>
                      {gate.satisfied ? 'PROVEN' : 'MISSING'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-600">{gate.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {report.blockers.length > 0 && (
            <div className="mt-3 rounded border border-amber-900/50 bg-amber-950/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Global blockers</div>
              {report.blockers.map((blocker) => (
                <div key={blocker} className="mt-1 text-[10px] leading-4 text-amber-200">{blocker}</div>
              ))}
            </div>
          )}

          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {report.lanes.map((lane) => (
              <div key={lane.id} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">{lane.title}</div>
                    <div className="mt-1 text-[10px] text-slate-600">{lane.automation}</div>
                  </div>
                  <span className={'rounded border px-2 py-1 text-[10px] font-semibold ' + stateClasses(lane.state)}>
                    {lane.state.toUpperCase()}
                  </span>
                </div>

                <div className="mt-2 text-[10px] text-slate-500">
                  detected {lane.detected ? 'yes' : 'no'} · devices {lane.applicableDevices.length} · verified firmware {lane.firmwareCandidates.length}
                </div>
                {lane.workflowPolicyId && (
                  <div className="mt-1 text-[10px] text-slate-500">
                    policy {lane.workflowPolicyId} · physical qualification{' '}
                    <span className={lane.physicallyQualified ? 'text-emerald-300' : 'text-amber-300'}>
                      {lane.physicallyQualified ? 'complete' : 'pending'}
                    </span>
                  </div>
                )}

                {lane.applicableDevices.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-600">Applicable device(s)</div>
                    {lane.applicableDevices.slice(0, 4).map((device) => (
                      <div key={device} className="mt-1 truncate font-mono text-[10px] text-slate-400" title={device}>{device}</div>
                    ))}
                  </div>
                )}

                {lane.firmwareCandidates.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-600">Verified firmware candidates</div>
                    {lane.firmwareCandidates.slice(0, 4).map((firmware) => (
                      <div key={firmware} className="mt-1 truncate font-mono text-[10px] text-emerald-300" title={firmware}>{firmware}</div>
                    ))}
                  </div>
                )}

                {lane.blockers.length > 0 && (
                  <div className="mt-2 rounded border border-slate-800 bg-black/20 p-2">
                    <div className="text-[10px] font-semibold text-slate-400">Stop here until resolved</div>
                    {lane.blockers.map((blocker) => (
                      <div key={blocker} className="mt-1 text-[10px] leading-4 text-slate-600">{blocker}</div>
                    ))}
                  </div>
                )}

                <div className="mt-2 rounded border border-slate-800 bg-black/20 p-2">
                  <div className="text-[10px] font-semibold text-slate-400">Next automatic/guided step</div>
                  {lane.nextSteps.map((step) => (
                    <div key={step} className="mt-1 text-[10px] leading-4 text-slate-600">{step}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {report.qualificationQueue.length > 0 && (
            <div className="mt-3 rounded border border-orange-900/50 bg-orange-950/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">Physical qualification queue</div>
              <div className="mt-1 text-[10px] leading-4 text-slate-500">
                These workflows are implemented in software but are not yet allowed to claim physical qualification.
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                {report.qualificationQueue.map((task) => (
                  <div key={task.workflowId} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-white">{task.workflowId}</div>
                        <div className="mt-1 text-[10px] text-slate-600">{task.category} · {task.risk}</div>
                      </div>
                      <span className="rounded border border-amber-900/60 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-300">
                        BENCH PENDING
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500">{task.notes}</div>

                    <div className="mt-2 rounded border border-slate-800 bg-black/20 p-2">
                      <div className="text-[10px] font-semibold text-slate-400">Exact target evidence</div>
                      {task.targetEvidence.map((item) => (
                        <div key={item} className="mt-1 text-[10px] leading-4 text-slate-600">• {item}</div>
                      ))}
                    </div>

                    <div className="mt-2 rounded border border-slate-800 bg-black/20 p-2">
                      <div className="text-[10px] font-semibold text-slate-400">Host / tooling requirements</div>
                      {task.hostRequirements.map((item) => (
                        <div key={item} className="mt-1 text-[10px] leading-4 text-slate-600">• {item}</div>
                      ))}
                    </div>

                    <div className="mt-2 text-[10px] font-semibold text-slate-400">Dry-run artifact</div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-600">{task.dryRunArtifact}</div>

                    <div className="mt-2 text-[10px] font-semibold text-slate-400">Backup / rollback requirement</div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-600">{task.rollbackRequirement}</div>

                    <div className="mt-2 text-[10px] font-semibold text-slate-400">Designated bench action</div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-600">{task.benchAction}</div>

                    <div className="mt-2 text-[10px] font-semibold text-slate-400">Post-operation verification</div>
                    {task.postVerification.map((item) => (
                      <div key={item} className="mt-1 text-[10px] leading-4 text-slate-600">• {item}</div>
                    ))}

                    <div className="mt-2 text-[10px] font-semibold text-slate-400">Policy evidence required</div>
                    {task.requiredEvidence.map((item) => (
                      <div key={item} className="mt-1 text-[10px] leading-4 text-slate-600">• {item}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.workflowPolicies.some((policy) => !policy.activeInBobfwtools) && (
            <div className="mt-3 rounded border border-slate-800 bg-black/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reserved / inactive workflows</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {report.workflowPolicies
                  .filter((policy) => !policy.activeInBobfwtools)
                  .map((policy) => (
                    <div key={policy.id} className="rounded border border-slate-800 bg-slate-950/70 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-semibold text-slate-300">{policy.category} · {policy.id}</div>
                        <span className="text-[10px] text-slate-500">RESERVED</span>
                      </div>
                      <div className="mt-1 text-[10px] leading-4 text-slate-600">{policy.notes}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-3 rounded border border-cyan-900/50 bg-cyan-950/10 p-3 text-[10px] leading-4 text-cyan-100">
            Read-only and evidence-building steps may be automated. Firmware selection is restricted to verified,
            vendor-matching packages. Driver relatch is hardware-ID gated. Destructive firmware writes remain blocked
            until the exact device, package fingerprint, recovery job fingerprint, qualification dossier, bench evidence,
            human decision, audit bundle, and short-lived write authority all agree.
          </div>
        </>
      )}
    </div>
  );
}
