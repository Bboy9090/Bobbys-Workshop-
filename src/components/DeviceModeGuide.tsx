type GuideStep = {
  title: string;
  detail: string;
};

type Props = {
  mode: string;
  platformHint: string;
  manufacturer?: string | null;
  productName?: string | null;
};

function guideFor(mode: string, platformHint: string): { title: string; state: string; steps: GuideStep[]; success: string[]; errors: string[] } {
  const normalized = `${mode} ${platformHint}`.toLowerCase();

  if (normalized.includes('samsung-download')) {
    return {
      title: 'Samsung Download Mode',
      state: 'Phone should be powered off before entering Download Mode. Keep it connected directly to the computer once the warning/download screen appears.',
      steps: [
        { title: 'Power off fully', detail: 'Wait until the display is completely black and vibration has stopped.' },
        { title: 'Use the model-appropriate key combo', detail: 'On many recent Galaxy devices, hold Volume Up + Volume Down while connecting the USB cable. Older models may use a different Home/Bixby/Power combination.' },
        { title: 'Confirm Download Mode', detail: 'If Samsung shows a warning screen, use the on-screen key instruction—commonly Volume Up—to continue.' },
        { title: 'Leave the cable connected', detail: 'BobFWTools should identify a Samsung Download Mode USB descriptor. Do not disconnect during an actual authorized firmware operation.' },
      ],
      success: [
        'Screen says Downloading / Download Mode or shows Samsung service information.',
        'BobFWTools reports Samsung Download Mode for the selected USB target.',
      ],
      errors: [
        'Phone boots Android instead: power off and retry the correct model-specific key sequence.',
        'No USB detection: change to a known data cable/direct USB port and rerun Cable Doctor.',
        'Model cannot be certified from USB alone: verify exact model independently before firmware planning.',
      ],
    };
  }

  if (normalized.includes('qualcomm-edl')) {
    return {
      title: 'Qualcomm EDL 9008',
      state: 'Use EDL only on a device you are authorized to service and only through an OEM/service-supported entry method.',
      steps: [
        { title: 'Start from the supported state', detail: 'Use an OEM-documented service method or an authorized software command on devices that support it. Do not blindly short board test points.' },
        { title: 'Connect directly by USB', detail: 'Avoid hubs for qualification. Keep the service cable stable.' },
        { title: 'Verify 05C6:9008', detail: 'BobFWTools should report Qualcomm EDL / 9008 for the selected device.' },
        { title: 'Verify programmer authorization', detail: 'Only an enrolled OEM/service programmer with the expected SHA-256 is eligible. Missing vendor authentication remains a blocker.' },
      ],
      success: [
        'USB identity is Qualcomm 05C6:9008.',
        'Recovery planner recognizes the target as Qualcomm EDL.',
      ],
      errors: [
        'Device repeatedly connects/disconnects: run the scoped Cable Doctor and replace the cable/port if unstable.',
        'Programmer rejected or hash changed: stop and re-enroll only a legitimate matching programmer.',
        'Vendor authentication required: BobFWTools must remain blocked until legitimate authorization is available.',
      ],
    };
  }

  if (normalized.includes('mediatek-preloader') || normalized.includes('mediatek-brom')) {
    return {
      title: 'MediaTek Preloader / Download Mode',
      state: 'Phone is normally powered off for Preloader/Download detection. Exact button behavior varies by OEM/model.',
      steps: [
        { title: 'Power off fully', detail: 'Disconnect USB first if the phone keeps rebooting, then wait for full shutdown.' },
        { title: 'Reconnect with the supported key state', detail: 'Many MediaTek devices enumerate Preloader while connecting powered off; some require holding a volume key. Follow the device/OEM service procedure.' },
        { title: 'Watch for the brief USB enumeration', detail: 'Preloader may appear only briefly. BobFWTools should identify the MediaTek USB mode if the driver/USB path is working.' },
        { title: 'Use only legitimate DA/auth files', detail: 'Do not use SLA/DAA bypasses or BootROM exploits. Required vendor authentication remains a hard blocker.' },
      ],
      success: [
        'BobFWTools reports MediaTek Preloader/BROM-compatible USB evidence.',
        'The selected target remains stable enough for the authorized recovery planner to inspect it.',
      ],
      errors: [
        'Device disappears immediately: repeat with a direct port and correct OEM key state; brief Preloader enumeration can be normal.',
        'Windows driver probe unavailable: fix driver-store visibility before treating the driver as missing.',
        'Authentication file or DA missing: stop; do not substitute bypass tooling.',
      ],
    };
  }

  if (normalized.includes('fastboot')) {
    return {
      title: 'Fastboot / Bootloader Mode',
      state: 'Device should be at its bootloader/fastboot screen, not normal Android.',
      steps: [
        { title: 'Enter bootloader safely', detail: 'If ADB is already authorized, use the supported reboot-to-bootloader workflow. Otherwise use the manufacturer key combination; Volume Down + Power is common but not universal.' },
        { title: 'Connect USB directly', detail: 'Use a known data-capable cable and avoid an unstable hub.' },
        { title: 'Verify Fastboot detection', detail: 'BobFWTools/fastboot should show the device serial before any service action is considered.' },
      ],
      success: ['Fastboot serial is visible and stable.', 'Device screen remains in bootloader/fastboot mode.'],
      errors: [
        'Waiting for device: check Windows driver/USB path or try a different cable/port.',
        'Wrong serial selected: switch the BobFWTools target before continuing.',
      ],
    };
  }

  return {
    title: 'Normal Android USB / ADB / MTP',
    state: 'Phone should be powered on and unlocked for normal diagnostics. Keep the screen available in case Android asks for USB authorization.',
    steps: [
      { title: 'Connect with a data cable', detail: 'Use a direct USB port when possible.' },
      { title: 'Unlock the device', detail: 'For file transfer, choose File Transfer/MTP from Android USB preferences.' },
      { title: 'Authorize ADB only when needed', detail: 'If USB debugging is enabled, approve the computer fingerprint prompt on the phone.' },
      { title: 'Run Diagnose This Phone', detail: 'BobFWTools will distinguish physical USB, MTP, authorized/unauthorized ADB, and Fastboot evidence.' },
    ],
    success: ['MTP works for file access and/or ADB shows authorized.', 'BobFWTools identifies the selected USB target without reconnect churn.'],
    errors: [
      'ADB unauthorized: unlock the phone and approve the debugging prompt.',
      'ADB offline: reconnect USB and restart the ADB connection.',
      'USB visible but no transport: choose File Transfer or authorize ADB depending on the workflow you need.',
    ],
  };
}

export function DeviceModeGuide({ mode, platformHint, manufacturer, productName }: Props) {
  const guide = guideFor(mode, platformHint);
  return (
    <div className="rounded border border-cyan-900/60 bg-cyan-950/10 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-500">Play-by-play for selected device</div>
      <h3 className="mt-1 text-sm font-semibold text-white">{guide.title}</h3>
      <div className="mt-1 text-xs text-slate-500">{[manufacturer, productName].filter(Boolean).join(' ') || platformHint}</div>
      <div className="mt-3 rounded border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300"><span className="font-semibold text-white">Required state: </span>{guide.state}</div>
      <div className="mt-3 space-y-2">
        {guide.steps.map((step, index) => (
          <div key={step.title} className="flex gap-3 rounded border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-800 text-[10px] font-bold text-cyan-300">{index + 1}</div>
            <div><div className="text-xs font-semibold text-white">{step.title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{step.detail}</div></div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-emerald-900/50 bg-emerald-950/10 p-3"><div className="text-[10px] font-semibold uppercase text-emerald-400">What success looks like</div>{guide.success.map((item) => <div key={item} className="mt-1 text-xs text-slate-300">• {item}</div>)}</div>
        <div className="rounded border border-amber-900/50 bg-amber-950/10 p-3"><div className="text-[10px] font-semibold uppercase text-amber-400">If it does not work</div>{guide.errors.map((item) => <div key={item} className="mt-1 text-xs text-slate-300">• {item}</div>)}</div>
      </div>
    </div>
  );
}
