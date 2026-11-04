# BobFWTools Guided Device-Mode Walkthroughs

This document defines the in-app, step-by-step operator experience for moving a supported device between normal boot, Android recovery, bootloader/fastboot, Samsung Download Mode, Qualcomm EDL, and MediaTek service modes.

The product goal is simple: the operator should not need to already know service terminology.

BobFWTools must explain:

1. what mode is needed;
2. why it is needed;
3. what the phone should look like before the step;
4. what buttons/cable actions to use when the model-specific sequence is known;
5. what BobFWTools expects to detect;
6. how the user knows the step succeeded;
7. what to do if the wrong screen appears;
8. how to safely return to normal boot.

No walkthrough may include FRP/activation-lock bypass, device-identity rewriting, exploit chains, unsigned service loaders, or authentication bypass.

## Universal UX contract

Every mode-transition card should contain these sections.

### Before you start

Show:

- detected brand/model;
- current USB state;
- battery level if available;
- whether ADB is authorized;
- whether the required driver/transport is ready;
- whether the device identity is stable;
- whether a cable reconnect will be required.

The primary button should say what it will do, for example:

- **Restart this phone into recovery**
- **Restart this phone into bootloader**
- **Restart this phone normally**
- **I am ready — watch for Download Mode**

Never label a button only **Continue** when the action changes device state.

### During the transition

The UI should switch to a live watcher:

> Waiting for this exact device to reconnect…

Show the frozen device identity and refuse to silently attach another phone that happens to appear.

If another device arrives first, show:

> Another device connected, but it does not match the phone you selected. BobFWTools will not switch targets automatically.

### Success

Show a large plain-language result:

> Download Mode detected.

Then show the evidence:

- device UID/serial;
- VID/PID;
- protocol/mode;
- driver/transport;
- time detected.

### Failure

Do not only say “device not found.”

Use specific outcomes:

- **Phone never disconnected** — the reboot command may not have been accepted.
- **Phone disconnected but did not return** — cable/port/power may have changed.
- **Phone returned in normal Android** — wrong mode sequence or reboot fallback.
- **Different phone appeared** — device identity changed or another device grabbed the port.
- **Driver probe unavailable** — BobFWTools cannot prove Windows driver readiness.
- **Driver missing** — the Windows driver store was queried and the needed evidence is absent.
- **ADB unauthorized** — phone is visible but the user has not approved the debugging prompt.

Offer safe recovery steps, not a destructive override.

---

# Normal Android → Recovery

Use ADB reboot-to-recovery only when:

- the selected device is the exact authorized device;
- ADB is available;
- ADB authorization is confirmed.

The UI flow:

1. Show the selected phone.
2. Explain that the phone will restart and the screen may go dark briefly.
3. Ask the user to save anything open on the phone.
4. Press **Restart into recovery**.
5. Send the normal supported reboot-to-recovery signal.
6. Watch USB/ADB for disconnect.
7. Watch for the recovery-mode identity/state.
8. Confirm success.

If ADB is unavailable, switch to the model-specific manual instructions instead of pretending automation worked.

Recovery-screen help should explain common manufacturer wording such as:

- Recovery
- Android Recovery
- Rescue Mode

If the user sees the Android robot/no-command screen, BobFWTools should show the manufacturer-supported key instruction for revealing the recovery menu when known.

Return path:

- choose **Reboot system now** in stock recovery; or
- use BobFWTools **Restart normally** only when the detected recovery transport supports a documented safe reboot.

---

# Normal Android → Bootloader / Fastboot

Automated path when ADB is authorized:

1. Select the exact phone.
2. Press **Restart into bootloader**.
3. BobFWTools sends the supported Android bootloader reboot command.
4. Watch for ADB disconnect.
5. Watch for Fastboot enumeration.
6. Confirm the exact selected device reappeared.

Success card:

> Fastboot detected. BobFWTools matched this Fastboot device to the phone you selected.

If multiple Fastboot devices exist, require explicit selection.

Manual path:

Show brand/model-specific instructions only when the sequence is known and sourced from the manufacturer or a verified service reference.

Do not show a generic button combination as universal truth.

Return path:

- **Restart normally** sends a standard Fastboot reboot only to the selected device.

---

# Normal Android → Recovery or Bootloader without ADB

When USB debugging is off or unauthorized:

1. Explain that BobFWTools cannot safely command the reboot from Android.
2. Ask the user to power the phone off normally.
3. Show the exact model-specific hardware-key sequence if BobFWTools has verified instructions for that model.
4. Show an illustration/text cue describing the screen the user should expect.
5. Start the USB watcher before the user presses the keys.
6. Confirm the exact device once it enumerates.

If instructions are unknown:

> BobFWTools has not verified a button sequence for this model. Use the manufacturer’s recovery instructions; BobFWTools will watch for the device and tell you when the correct mode appears.

Do not guess.

---

# Samsung → Download Mode

BobFWTools should explain that Download Mode is Samsung's firmware-service state.

Before entry:

- disconnect unrelated phones;
- confirm Samsung USB driver evidence on Windows;
- confirm the selected model/serial;
- tell the user the phone may show a warning/confirmation screen.

Automated transition may be offered only through a documented supported reboot path already available to the exact selected device.

Manual flow must be model-aware. Samsung sequences vary by generation.

The screen guide should say:

> You are looking for a screen that identifies Download Mode / Odin Mode or a Samsung firmware-download state.

When the warning/confirmation screen appears, BobFWTools should tell the user which on-screen choice enters Download Mode only when that choice is verified for the detected model family.

Detection success requires the expected Samsung USB transport evidence and exact device binding.

Return path:

Use the model's documented exit/reboot behavior. Do not send flash commands simply to force a reboot.

---

# Qualcomm → EDL

EDL is an emergency service state and is higher risk than ordinary Android recovery/bootloader modes.

BobFWTools must not present EDL entry as a casual “try this” action.

Requirements before displaying an EDL qualification workflow:

- explicit repair authorization;
- designated-device identity captured;
- Qualcomm driver/transport evidence available when required;
- approved service programmer already enrolled;
- programmer hash verified;
- no authentication-bypass workflow;
- no arbitrary unsigned programmer.

If the device is already in 9008/EDL, BobFWTools can detect and identify it.

If the device is not already in EDL, only documented manufacturer/service transitions may be offered. Do not add exploit-based entry methods.

Success:

> Qualcomm emergency-download device detected and bound to the selected repair job.

Return/recovery instructions must be device/service specific. Blind write/retry behavior is prohibited.

---

# MediaTek → Preloader / Download Service Mode

MediaTek devices can enumerate briefly during power-on/off transitions, so the operator needs live guidance.

Before watching:

- confirm the MediaTek driver evidence on Windows;
- select the exact target device;
- unplug unrelated phones;
- prepare the approved Download Agent/auth material before the transition;
- never rely on SLA/DAA bypass or BootROM exploit instructions.

Guided watcher:

1. Tell the user when to disconnect the cable.
2. Tell the user when BobFWTools is actively watching.
3. Ask the user to connect the powered-off phone using the verified model-specific key/cable sequence when known.
4. Display each short-lived MediaTek enumeration as it appears.
5. Lock onto the exact identity only when the evidence matches.
6. Explain when the phone left Preloader/BROM state before declaring a failure.

Success:

> MediaTek service transport detected and matched to this repair job.

A transient Preloader connection is not automatically a successful destructive-session qualification.

---

# Driver latch / unlatch troubleshooting

When Windows has competing drivers, the UI should expose evidence rather than silently swapping drivers.

Show:

- current device instance;
- current driver/provider;
- hardware ID;
- expected BobFWTools protocol;
- whether the current driver is compatible;
- whether another installed driver is a candidate.

Provide safe operator actions such as:

- rescan device;
- disconnect/reconnect selected phone;
- open Device Manager at the exact device;
- refresh driver evidence;
- release the current BobFWTools session before another tool takes the device.

Do not automatically remove arbitrary third-party drivers.

If a future BobFWTools **Release device** action is added, it should release BobFWTools' own handle/session first. Driver replacement/removal must remain an explicit administrative operation with rollback information.

---

# Multi-phone protection

When more than one phone/tablet is connected:

1. Show each physical USB identity separately.
2. Let the user select one device as the active repair target.
3. Scope ADB/Fastboot/recovery polling to that selected identity wherever the transport permits.
4. Do not repeatedly issue broad commands to every ADB device.
5. Disable destructive/recovery controls that cannot prove exact target binding.
6. If the device changes serial/mode unexpectedly, pause the workflow.

The app should feel like:

> I am working on **this** phone.

not:

> I found some Android devices and I am going to try commands until something responds.

---

# One-click automation rule

“One click” means BobFWTools automates every step it can prove is safe and supported.

It does **not** mean hiding uncertainty.

A one-click workflow may:

- send a standard ADB reboot signal;
- send a standard Fastboot reboot signal;
- start the correct transport watcher;
- re-identify the device after reconnect;
- prepare verified artifacts;
- guide the operator to the next physical step;
- stop automatically on mismatch.

It must never turn an unknown model-specific transition, authentication boundary, or destructive write into an unverified automatic action.

---

# Completion standard for a guided transition

A guided transition is successful only when BobFWTools can answer all of these:

- Which physical device did we start with?
- Which signal/manual sequence was used?
- Did that exact device disconnect?
- Did that exact device reconnect?
- Which transport/mode was detected?
- Which driver handled it?
- Did the identity still match?
- What is the safe return-to-normal path?

If any answer is unknown, the UI should say so and remain in guidance/diagnostic mode.
