# BobFWTools Flash Lab: 30 qualification milestones

Baseline: `eb72d680e5ed5dbd8b300ce253bd4ff587f80359`. This is a roadmap, not evidence that the listed gates have passed. Keep the notarized diagnostic release separate from the opt-in qualified-flash build. No security bypass, account-lock removal, or unsupported destructive operations.

## Flash transaction safety (1–8)
1. Persist a transaction ID and immutable device/firmware binding.
2. Record preflight evidence and explicit user consent.
3. Reject stale qualification grants before each write.
4. Recheck exact serial and transport mode immediately before write.
5. Journal phase transitions with crash-safe atomic writes.
6. Distinguish cancellation before write from interruption during write.
7. Mark uncertain writes as RECOVERY_REQUIRED, never success or safe rollback.
8. Verify post-write device identity and record that identity is **not** a partition readback hash.

## Virtual lab and fault injection (9–15)
9. Inject write transport failures without invoking real fastboot.
10. Inject device disconnect and reconnect sequences.
11. Simulate process termination between journal phases.
12. Simulate corrupted or truncated firmware files.
13. Simulate mismatched model, region, and revision metadata.
14. Simulate a timeout and require an explicit unknown-outcome state.
15. Build a repeatable fault-matrix CI job on Linux, macOS, and Windows where supported.

## Firmware and device compatibility (16–21)
16. Define a versioned device capability manifest.
17. Match firmware to exact model and variant, never family name alone.
18. Require hashes and provenance before qualifying images.
19. Model bootloader lock, anti-rollback, and verified-boot restrictions.
20. Separate read-only enumeration from any destructive operation.
21. Make unsupported OEM/service protocols fail closed with actionable diagnostics.

## Recovery, backups, and user experience (22–26)
22. Record backup availability and scope before destructive actions.
23. Prove restore compatibility in a virtual device before offering recovery.
24. Provide a guided recovery screen for interrupted or unknown writes.
25. Show irreversible-operation warnings with partition-specific context.
26. Export a redacted diagnostic evidence bundle without secrets or personal data.

## Cross-platform and release gates (27–30)
27. Qualify Windows tool discovery, drivers, and permissions independently.
28. Qualify macOS architecture, code signing, notarization, and opt-in lab packaging.
29. Triage dependency alerts by reachability and severity; block unsafe release dependencies.
30. Publish a device-by-device qualification matrix: simulation, read-only, permitted write, and recovery evidence.

## Release policy
- Never equate simulated success with a physically verified flash.
- Never silently fall back from an authorized OEM protocol to an undocumented security bypass.
- Do not promise a rollback unless an actual supported restore path has been demonstrated.
- Keep feature flags off by default and use signed, scoped qualification grants.
- Gate merges on fresh CI for the exact commit; require separate physical qualification for device support.


## Execution priorities: writing and flashing adapters (October 2026)

**P0 — Ship a verified, safe write transaction core first.** One common transaction
contract for every supported backend: exact physical device identity, OEM/model
capability manifest, target/partition allowlist, verified payload hash and provenance,
anti-rollback / bootloader policy check, explicit operator consent, durable before-write
record, non-replayable ambiguous-outcome handling, post-write evidence, and redacted
audit export. Deny destructive operations when any required field is unknown.

**P1 — Highest-value supported write paths.**
- Android Fastboot: supported unlocked/authorized devices and qualified partitions;
  tests must use injected transports before lab hardware.
- Samsung Download Mode: separate Samsung-compatible protocol adapter and firmware
  package/CSC/binary-revision matching. Generic Fastboot must never be substituted.
  SM-A176U stays read-only until exact live identity and supported OEM route are proven.
- ADB: diagnostics, authorized file push/pull and backup workflows only; no assumption
  that ADB grants raw partition access.
- Stock recovery: manufacturer-supported signed update/sideload flows only.

**P2 — Conditional advanced lab support.**
- Qualcomm EDL and MediaTek service modes: only documented, legitimately authorized
  service interfaces; do not bypass signed programmer, secure boot or authentication.
- Partition backup/readback and restoration: feature only where access and restore
  support can be demonstrated. Model risk of irreversible partition loss.
- SD card, removable flash media and supported external storage writes: separate
  device-selection safeguards and destructive-media warnings.
- Bootloader unlock workflows: OEM-supported only, with data-wipe warning and state
  revalidation; never imply unlockability on carrier-restricted models.

**P3 — Additional platforms after dedicated device labs.**
- Pixel factory-image flows; Motorola, OnePlus and other OEM sanctioned paths.
- Apple restore/update through supported host frameworks, without activation-lock bypass.
- Cross-platform Windows/macOS adapters, driver checks, firmware caching and package
  verification; release gates apply to each OS independently.

Each adapter must publish a four-state status: NOT_IMPLEMENTED, SIMULATED,
READ_ONLY_QUALIFIED, or PHYSICAL_WRITE_QUALIFIED. Never infer the final state from
a successful CI run. An operator-facing button must remain disabled for unsupported
states and show the missing evidence.

## Immediate execution order
1. Inventory actual write executors and prevent one protocol from masquerading as another.
2. Close journal consistency, replay and concurrent-writer gaps on the shared contract.
3. Add source-backed firmware compatibility manifests and negative tests.
4. Implement Samsung read-only model/build/CSC collection via trusted probe output.
5. Build OEM-specific virtual fault injection suites for Fastboot, Samsung and recovery.
6. Add operator recovery instructions and redacted evidence export.
7. Validate each adapter in a supervised sacrificial-device lab.
8. Enable only that exact model/firmware/partition combination with signed grants.
