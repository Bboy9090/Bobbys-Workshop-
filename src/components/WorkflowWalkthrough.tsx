import { useMemo, useState } from 'react';

export type GuidedWorkflowKind =
  | 'general'
  | 'adb'
  | 'qualcomm-edl'
  | 'mediatek-brom'
  | 'mediatek-preloader'
  | 'samsung-download';

type GuideStep = {
  title: string;
  doThis: string;
  expect: string;
  stopIf?: string;
};

type GuideDefinition = {
  title: string;
  summary: string;
  steps: GuideStep[];
};

const guides: Record<GuidedWorkflowKind, GuideDefinition> = {
  general: {
    title: 'Guided repair setup',
    summary: 'Use this whenever you are not sure what comes next. BobFWTools should explain the next safe action before asking you to perform it.',
    steps: [
      {
        title: 'Connect one target device',
        doThis: 'Use a known-good data cable and connect only the phone you intend to service.',
        expect: 'The device appears in the Detected target selector with a transport or recovery mode.',
        stopIf: 'More than one similar device is connected and you cannot positively identify the target.',
      },
      {
        title: 'Initialize the workstation',
        doThis: 'Press Initialize workspace and review missing tools, drivers, and workspace paths.',
        expect: 'Required host dependencies report ready or explain exactly what is missing.',
      },
      {
        title: 'Read the workflow status',
        doThis: 'Select the exact target. Review the applicable workflow card before opening firmware or service files.',
        expect: 'The card says READY, PLANNING READY, AUTHORIZE DEVICE, BLOCKED, or EVIDENCE ONLY with a reason.',
      },
      {
        title: 'Protect the recovery path',
        doThis: 'Create the requested backup/evidence artifacts before any workflow that could alter storage.',
        expect: 'BobFWTools records verification evidence and keeps destructive execution locked until all required gates pass.',
      },
    ],
  },
  adb: {
    title: 'Android ADB walkthrough',
    summary: 'For an Android phone that is booted normally and reachable over USB debugging.',
    steps: [
      {
        title: 'Unlock the phone',
        doThis: 'Keep the phone awake and unlocked. If Developer options are not already enabled, enable them using the manufacturer-supported Android settings path.',
        expect: 'The phone stays on the home screen and remains connected by USB.',
      },
      {
        title: 'Approve this computer',
        doThis: 'When Android shows the USB debugging authorization prompt, verify the computer fingerprint shown on the phone and approve it.',
        expect: 'BobFWTools changes the target from unauthorized to authorized.',
        stopIf: 'The authorization prompt identifies a computer you do not recognize.',
      },
      {
        title: 'Confirm exact target identity',
        doThis: 'Match the serial/model shown in BobFWTools to the phone in your hand before running backups or service actions.',
        expect: 'The selected serial is the exact device you intend to work on.',
      },
      {
        title: 'Run read-only diagnostics first',
        doThis: 'Check USB/ADB/device information before choosing a repair action.',
        expect: 'You have current battery, connection, identity, and workflow-readiness evidence.',
      },
      {
        title: 'Back up protected data before risky work',
        doThis: 'For calibration or partition-sensitive work, choose the approved backup workflow and save the verified result to a known folder.',
        expect: 'BobFWTools shows a verified backup result and hash before later stages are considered.',
      },
    ],
  },
  'qualcomm-edl': {
    title: 'Qualcomm EDL 9008 walkthrough',
    summary: 'For authorized service of a Qualcomm device already detected in EDL/9008 mode. Planning does not equal permission to write.',
    steps: [
      {
        title: 'Confirm EDL identity',
        doThis: 'Verify the selected USB target is the intended phone and that BobFWTools reports Qualcomm EDL/9008.',
        expect: 'A single, stable 9008 target is shown.',
        stopIf: 'The target repeatedly disconnects, changes identity, or you cannot identify the physical device.',
      },
      {
        title: 'Identify exact model and chipset',
        doThis: 'Use the firmware intelligence lookup with the exact OEM model, board/SKU information, and known chipset identifier.',
        expect: 'The chipset result is treated as advisory metadata, not automatic firmware compatibility.',
      },
      {
        title: 'Choose the exact stock/service package',
        doThis: 'Use firmware from an authorized or official source for the exact model/variant. Scan it into the managed firmware library.',
        expect: 'The package has a consistent chipset identity and the expected rawprogram/service metadata.',
        stopIf: 'The package is for another model, carrier, board revision, or reports conflicting chipset families.',
      },
      {
        title: 'Use an authorized Firehose programmer',
        doThis: 'Inspect the OEM/service-authorized Firehose programmer and enroll its authorization evidence when applicable.',
        expect: 'The programmer hash is recorded and authorization is explicit.',
        stopIf: 'The programmer is patched, bypass-labeled, unknown, or cannot be tied to legitimate service authorization.',
      },
      {
        title: 'Generate a dry-run plan',
        doThis: 'Build the recovery/write plan and inspect partitions, boundaries, warnings, and high-risk targets before any execution path.',
        expect: 'The plan is reviewable while execution stays qualification-locked.',
      },
    ],
  },
  'mediatek-brom': {
    title: 'MediaTek BootROM walkthrough',
    summary: 'For authorized MediaTek recovery planning. BobFWTools does not use SLA/DAA/Auth bypass workflows.',
    steps: [
      {
        title: 'Confirm the recovery target',
        doThis: 'Verify the exact phone and confirm BobFWTools detects MediaTek BootROM mode.',
        expect: 'One stable MediaTek recovery target is selected.',
        stopIf: 'The physical phone cannot be positively matched to the detected target.',
      },
      {
        title: 'Identify chipset and board package',
        doThis: 'Look up the exact MT identifier and match it against the OEM model/board package.',
        expect: 'Chipset metadata narrows candidates but does not certify a package by itself.',
      },
      {
        title: 'Scan stock/service firmware',
        doThis: 'Place the authorized package in the managed MediaTek firmware area and scan it.',
        expect: 'Scatter, Download Agent, preloader/auth metadata, hashes, and warnings are visible.',
        stopIf: 'The directory mixes chipset families or contains bypass/exploit-marked artifacts.',
      },
      {
        title: 'Verify legitimate DA/auth requirements',
        doThis: 'Use only the OEM/service-authorized Download Agent and authentication material required by that device.',
        expect: 'The package can reach planning readiness without bypass artifacts.',
      },
      {
        title: 'Review the plan before execution qualification',
        doThis: 'Inspect intended partitions, package completeness, backup requirements, and qualification blockers.',
        expect: 'No destructive writer opens merely because the chipset and scatter file match.',
      },
    ],
  },
  'mediatek-preloader': {
    title: 'MediaTek Preloader walkthrough',
    summary: 'For a MediaTek device enumerating through preloader mode. Stabilize detection and verify the package before deeper recovery work.',
    steps: [
      {
        title: 'Stabilize USB detection',
        doThis: 'Keep the device connected with a known-good cable and confirm the preloader target repeatedly enumerates as the same device.',
        expect: 'BobFWTools consistently sees the same MediaTek target.',
      },
      {
        title: 'Confirm model, chipset, and storage family',
        doThis: 'Match OEM model/board information to the MT identifier and storage generation before selecting firmware.',
        expect: 'The candidate package agrees with the target metadata.',
      },
      {
        title: 'Scan the firmware package',
        doThis: 'Use the managed library to inspect scatter, preloader, DA/auth, partition images, and hashes.',
        expect: 'Missing or conflicting package components are called out before planning.',
      },
      {
        title: 'Protect device-specific data',
        doThis: 'Follow the backup/evidence path offered for the device before any operation that could affect calibration or identity partitions.',
        expect: 'Required preservation evidence exists before destructive qualification can advance.',
      },
    ],
  },
  'samsung-download': {
    title: 'Samsung Download Mode walkthrough',
    summary: 'For stock Samsung firmware inspection and guarded Download Mode planning.',
    steps: [
      {
        title: 'Confirm Download Mode target',
        doThis: 'Match the connected Samsung device to the target shown in BobFWTools.',
        expect: 'The intended phone is the only selected Samsung Download Mode target.',
      },
      {
        title: 'Confirm exact model and bootloader revision',
        doThis: 'Read the model/variant and bootloader revision from trusted device/package information before selecting firmware.',
        expect: 'Firmware selection matches the exact model and does not require an unsupported downgrade.',
      },
      {
        title: 'Choose stock firmware packages',
        doThis: 'Select the official/authorized BL, AP, CP, CSC/HOME_CSC package set for the intended device.',
        expect: 'BobFWTools inspects archive roles, package structure, PIT/userdata presence, and integrity warnings.',
      },
      {
        title: 'Review the generated plan',
        doThis: 'Check every payload and whether the chosen CSC path preserves or resets user data.',
        expect: 'You understand exactly what is planned before any qualified execution stage.',
        stopIf: 'Package roles, model identity, or wipe behavior are unclear.',
      },
    ],
  },
};

export default function WorkflowWalkthrough({ kind }: { kind: GuidedWorkflowKind }) {
  const [open, setOpen] = useState(true);
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const guide = useMemo(() => guides[kind] || guides.general, [kind]);
  const completedCount = Object.values(completed).filter(Boolean).length;

  return (
    <div className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-400">Guided walkthrough</div>
          <div className="mt-1 text-sm font-semibold text-white">{guide.title}</div>
          <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{guide.summary}</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded border border-sky-900 bg-sky-950/30 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-950/50"
        >
          {open ? 'Hide walkthrough' : 'Show walkthrough'}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded bg-slate-900">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${Math.round((completedCount / guide.steps.length) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500">{completedCount}/{guide.steps.length} checked</div>
          </div>

          <div className="mt-4 space-y-3">
            {guide.steps.map((step, index) => (
              <div key={step.title} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={`Mark step ${index + 1} complete`}
                    onClick={() => setCompleted((current) => ({ ...current, [index]: !current[index] }))}
                    className={
                      completed[index]
                        ? 'mt-0.5 h-6 w-6 shrink-0 rounded-full border border-emerald-700 bg-emerald-950 text-xs font-bold text-emerald-300'
                        : 'mt-0.5 h-6 w-6 shrink-0 rounded-full border border-slate-700 bg-black/30 text-xs font-bold text-slate-400'
                    }
                  >
                    {completed[index] ? '✓' : index + 1}
                  </button>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">{step.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      <span className="font-medium text-slate-300">Do this:</span> {step.doThis}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      <span className="font-medium text-slate-400">You should see:</span> {step.expect}
                    </div>
                    {step.stopIf && (
                      <div className="mt-2 rounded border border-amber-900/70 bg-amber-950/20 px-2 py-1.5 text-[11px] leading-4 text-amber-200">
                        Stop here if: {step.stopIf}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded border border-slate-800 bg-black/20 px-3 py-2 text-[11px] leading-5 text-slate-500">
            BobFWTools guidance is intentionally explicit: it tells you what to do, what success looks like, and when to stop. A completed checklist never overrides device identity, authorization, backup, compatibility, qualification, or execution gates.
          </div>
        </>
      )}
    </div>
  );
}
