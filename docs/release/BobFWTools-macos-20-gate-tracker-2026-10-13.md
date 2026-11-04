# BobFWTools macOS diagnostic release — 20-gate tracker

**Foundation baseline:** `c426062190c1c8910f16e50890f910fbffb81af8` (includes PR #211 ADB recovery and PR #215 sanitized A17 evidence). Treat every new release candidate as a separate immutable SHA. No claim of app readiness from source tests alone.

## GitHub / remote-verifiable gates

1. [x] Merge Samsung macOS ADB libusb transport correction (PR #214 through PR #211).
2. [x] Validate integrated candidate with macOS Core CI on the qualified PR #211 head.
3. [x] Validate integrated candidate with macOS Rust CI on the qualified PR #211 head.
4. [x] Validate Node CI on the qualified PR #211 head.
5. [x] Preserve A17 authorized live ADB model and firmware evidence without serials.
6. [x] Preserve A17 chip platform, boot state and lock-state evidence (PR #215).
7. [x] Validate PR #215 Node and macOS Core workflows before merge.
8. [x] Merge one-file hardware-evidence PR #215 into macOS foundation.
9. [ ] Confirm *fresh* CI on the resulting foundation SHA, not only earlier PR heads.
10. [ ] Audit default-branch Dependabot alerts and classify runtime exposure, urgency, and ownership.
11. [ ] Confirm app store distribution scope, platform policy and entitlement requirements independently; Developer ID notarization is not Mac App Store approval.
12. [ ] Review user-facing unsupported-device, unauthorized-ADB, missing-driver and firmware-mismatch messages with nontechnical users.
13. [ ] Verify the USB backend selection is applied across every shipping ADB entrypoint (not only adb_workflows and mode_control).
14. [ ] Validate simulated authorized/unauthorized/disconnected ADB states and unplug/replug transitions.
15. [ ] Verify diagnostic-only build disables destructive flashing and refuses unsupported model/firmware combinations.

## Mac and distribution gates — not completed

16. [ ] Inspect build output in clean worktree `~/Projects/BobFWTools-release-bc8b4a1`. Build was launched at `bc8b4a1`, but remote access stopped before final outcome could be observed. Do not assume completion.
17. [ ] Rebuild from latest qualified release SHA if necessary and verify universal Mach-O arm64 and x86_64 binary and bundle identifiers.
18. [ ] Sign this exact app bundle with the authorized Developer ID certificate; verify `codesign` and Team ID. Do not reuse earlier bundle signature evidence.
19. [ ] Notarize that signed app through the configured Keychain profile, staple the accepted ticket, and verify Gatekeeper on the resulting artifact.
20. [ ] Perform real GUI smoke tests on Mac, including Samsung A17 detection when available, no-terminal USB handling, user messages, release packaging, and security review; record sign-off before public distribution.

## Guardrails

- Read-only device properties and transport detection do not qualify firmware writes or prove FRP release.
- `ro.boot.flash.locked=1`, `ro.boot.verifiedbootstate=green` and `ro.boot.vbmeta.device_state=locked` indicate the observed locked boot state, not flashing authorization.
- Record run IDs and exact head commit for each gate. A pass on an earlier head must not be represented as a pass on the newly merged head.
- Do not change local macOS drivers, reset devices, flash, unlock, or bypass account protections as part of CI/readiness work.
- The original Mac workspace with uncommitted files must remain untouched.
