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
