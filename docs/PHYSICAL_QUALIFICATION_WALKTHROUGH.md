# BobFWTools Physical Qualification Walkthrough

This walkthrough is for an authorized repair bench using a designated test device you own or have explicit permission to service.

It does **not** authorize FRP/activation-lock bypass, identity rewriting, unsigned programmer execution, or destructive raw flashing on customer devices. The production writer remains gated until designated-device qualification and independent review are complete.

## Before connecting the device

1. Use a sacrificial or designated bench device, not a customer phone.
2. Record the exact model, serial, storage capacity, current boot state, and recovery protocol.
3. Charge the device and workstation or keep both on stable external power.
4. Confirm a known-good USB data cable and a direct USB port. Avoid hubs during qualification.
5. Create and verify any required backup/recovery evidence before a write-capable trial.
6. Confirm the BobFWTools build identity and source revision shown in the Qualification Console.
7. Confirm the current recovery job fingerprint is present and stable.

If any item above is unknown, stop before Stage 1.

## Step 1 — Select the exact device

Open **Advanced Recovery → Qualification Console**.

1. Scan recovery candidates.
2. Select the designated device.
3. Verify the displayed serial/UID, VID/PID, mode, and protocol match the physical device in front of you.
4. If more than one phone is connected, unplug the others for the first physical qualification run.
5. Export or review the qualification dossier.
6. Do not continue when the UI shows **identity mismatch**, **binding blocked**, or **driver evidence unavailable**.

BobFWTools must match the live device to the frozen recovery-job identity exactly.

## Step 2 — Put the device in the required mode

Use the device manufacturer's documented service/recovery sequence.

### Qualcomm EDL

The device must enumerate as Qualcomm emergency-download mode and BobFWTools must detect the expected recovery identity. A recognized service programmer must already be enrolled and hash-verified.

Do not use authentication bypasses, BootROM exploits, or arbitrary unsigned programmers.

### MediaTek Download / Preloader

The device must enumerate in the supported MediaTek service mode and BobFWTools must detect the expected VID/PID and identity evidence.

Do not use SLA/DAA bypasses, BootROM exploit chains, or unapproved download agents.

### Samsung Download Mode

Use the normal manufacturer Download Mode sequence for the exact model. BobFWTools should re-enumerate the device after mode entry and show the correct Samsung transport evidence.

FRP/OEM/KG state is informational and is not treated as bypassable.

## Step 3 — Run Workstation Readiness

Open **Diagnose This Phone** or the workstation readiness panel.

Confirm:

- Android platform tools are detected where required.
- The workspace paths exist.
- Windows driver-store probing succeeded when running on Windows.
- Required Samsung, Qualcomm, or MediaTek driver evidence is visible when applicable.
- The UI does not confuse **probe unavailable** with **driver missing**.

If Windows driver-store evidence cannot be queried, the qualification dossier must remain blocked.

## Step 4 — Prepare the recovery job

1. Select the approved recovery artifacts.
2. Let BobFWTools hash the control files and all referenced payloads.
3. Review normalized partition operations.
4. Confirm the payload-integrity gate passes.
5. Review the high-risk partition list.
6. Confirm the recovery job fingerprint.
7. Revalidate the live hardware identity immediately before qualification.

Do not proceed if:

- a referenced payload is missing or empty;
- a hash changed;
- partition ranges overlap unexpectedly;
- the selected device changed;
- the programmer/build fingerprint changed;
- the recovery job fingerprint changed.

## Step 5 — Stage 1 bench trial

Stage 1 is a restricted qualification trial.

Use only the app-provided Stage 1 path.

Requirements:

- one designated device;
- one reviewed non-critical partition;
- no wipe;
- no repartition;
- no reboot-driven multi-step chain;
- exact image/hash match;
- all preflight checks passed.

If the device disconnects, changes mode unexpectedly, or reports a different identity, stop. Do not blindly retry a write.

After the one-shot trial, independently verify the device and the written partition before marking any post-write check as passed.

## Step 6 — Record physical bench evidence

After independent post-write verification:

1. Complete the physical-check list.
2. Export the **hash-bound bench evidence** receipt.
3. Confirm the receipt records:
   - reviewer identity;
   - exact device serial;
   - qualification dossier fingerprint;
   - recovery-job fingerprint;
   - executor-build fingerprint;
   - inspected partition names;
   - image paths;
   - image byte sizes;
   - SHA-256 values;
   - physical-check results;
   - timestamp.
4. Any change to device, job, images, reviewer, notes, or checks invalidates the old evidence in the UI.

The bench receipt itself must state that it grants no authority and does not qualify the executor.

## Step 7 — Human decision receipt

A separate reviewer records **accept evidence** or **reject evidence**.

Acceptance requires:

- a verified qualification dossier;
- the exact matching bench-evidence receipt;
- complete passed physical checks;
- exact reviewer/device/job/build binding.

A rejected or mismatched decision cannot unlock production authority.

## Step 8 — Audit bundle

Export the qualification audit bundle.

The bundle should include and revalidate:

- qualification dossier;
- physical bench evidence;
- human decision receipt;
- optional readiness certificate;
- source-file hashes;
- source semantics;
- nested evidence-chain integrity;
- recovery-job binding;
- executor-build binding.

A valid audit bundle is evidence for review only. It does not perform a flash or grant authority by itself.

## Step 9 — Independent review before production authority

Do not change PR #196 from Draft merely because the automated gates pass.

Before production-qualified authority is considered:

1. Have a second human review the complete evidence chain.
2. Confirm the designated device remained recoverable and healthy after the test.
3. Confirm the trial partition was intentionally chosen and non-critical.
4. Confirm no bypass workflow or identity modification was used.
5. Confirm the exact executor build is the one covered by the evidence.
6. Confirm every receipt and fingerprint re-verifies.
7. Record the review outcome.

Only then should the release owner decide whether the destructive executor is eligible for a production qualification decision.

## What operators should see when something is wrong

BobFWTools should fail closed and explain the blocker. Typical examples:

- **Identity mismatch** — the connected device is not the device frozen into the job.
- **Driver missing** — the Windows driver store was queried successfully and the relevant driver evidence is absent.
- **Probe unavailable** — BobFWTools could not prove the Windows driver-store state.
- **Payload integrity blocked** — missing/changed payload or overlapping operation.
- **Build mismatch** — the evidence was created against another executable/source revision.
- **Job mismatch** — the dossier, certificate, decision, or bench evidence belongs to another recovery job.
- **Evidence changed** — a receipt or source file no longer hashes or semantically validates.

The operator should fix the cause and prepare new evidence. Do not override a blocker with a manual “continue anyway” path.

## Qualification completion standard

Qualification is complete only when the designated-device physical trial and independent review support the exact build, exact device identity, exact recovery job, exact payloads, and exact reviewed evidence chain.

A green CI run alone is not physical qualification.
