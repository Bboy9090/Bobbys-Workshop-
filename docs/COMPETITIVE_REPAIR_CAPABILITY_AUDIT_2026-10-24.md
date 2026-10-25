# BobFWTools cross-platform competitive repair audit — 2026-10-24

Status: **IN PROGRESS — NOT RELEASE QUALIFIED**. Scope: targeted repository inspection and live macOS USB checks, not full hardware acceptance.

## Confirmed observations
- Native Tauri GUI uses React. `RepairCommandCenter.tsx` refreshes USB diagnostics and broader device state on separate 5-second schedules. Broad refresh combines nine promises, so one rejection prevents the state update cycle.
- `src-tauri/src/adb_workflows.rs` implements `adb_scan` with explicit `state == "device"` authorization classification.
- `src-tauri/src/main.rs` exposes USB transport diagnostics, firmware inspection, recovery planning, qualification gates and conditional flashing commands.
- `scripts/android_deploy.sh` supports single-target and explicit `--all`, but is not yet bound to a Tauri execution command. The GUI selector is a read-only preview.
- Current host: no authorized ADB device; prior Samsung USB device no longer enumerated. Apple USB entries are present.
- `backend/apple_engine.py` claims production Apple exploit/secure boot success without verifying its stated outcomes. Quarantine from production claims and execution pending independent security review.
- `workflows/bypass/frp-bypass.json` describes an account-security bypass. Exclude from ordinary repair automation and retail feature claims.
- `workflows/ios/device-restore.json` is a declarative workflow; its presence alone does not prove execution, pairing, backup, restore or recovery success.

## Priority gates
P0: truthful capability registry; disable unverified/exploit operations; exact device identity and selection lock; independently handled polling errors; no false success states.
P1: Tauri deployment command with bounded subprocesses, cancellation, explicit targets, APK provenance, and per-device receipts; test single, group, disconnect, unauthorized and no-device paths.
P2: iOS/iPadOS pairing, information, backup and officially supported restore validation on real hardware; Samsung MTP and Download Mode protocol qualification without undocumented launch assumptions; Android Fastboot/ADB physical tests.
P3: GUI information architecture (device-first, available actions, preflight, execution, verification, audit trail), accessibility, localization, installer/notarization, security and recovery testing.

## Competitive parity categories (not verified)
Inventory; diagnostics; battery/storage health; file transfer; backup/restore; app management; firmware acquisition and provenance; signed firmware restore; boot/recovery modes; enterprise enrollment; multi-device jobs; logs and receipts; support matrix; driver installation on supported hosts; user support and recovery guidance.

## Release decision
HOLD until independent real-device and installer evidence validates advertised operations. No claim of parity with SamFW, 3uTools, UAT Pro, UnlockTool or Dr.Fone is justified yet.
