# Qualification evidence — 2026-10-23

This frozen snapshot qualifies the interface work in [PR #248](https://github.com/Bboy9090/Bobbys-Workshop-/pull/248). It does not qualify a physical device, a signed release, or another source revision.

- PR head: `85829de8ba974b2dba02f3e0ce939386458e1265`
- Tested integration merge: `31c2ecf442036608c675098659d2175d687f74d1`
- Tested tree: `1b04a356471ffef445a72141de3e66492ebf9230`
- Actual integration merge: `c5579317892c3f29afe157274341411666c50408`; its tree and both parents were independently verified against the tested integration.
- [Node CI](https://github.com/Bboy9090/Bobbys-Workshop-/actions/runs/39929620699): SUCCESS.
- [macOS Core](https://github.com/Bboy9090/Bobbys-Workshop-/actions/runs/39929620644): SUCCESS.
- Capture result: **24 PASS, 0 FAIL, 35 BLOCKED, 19 NOT TESTED — 78 cases**. Every row keeps `executionAuthorized=false`.

## What the receipts establish

The real packaged API/repository suite passed 296 tests in 41 files. TypeScript, frontend build, the production reality gate, 21 workflow definitions, and lint passed. Lint retains three existing warnings and has zero errors.

Seven Chromium checks passed. The 1365×900 desktop home has main height/scrollHeight 833/833. Tested 390×844 views have no horizontal overflow. Read-only simulated bridge checks cover bootloader-control appearance/removal after observations change, repeated disclosure requests, artifact-picker success/cancellation/failure recovery, and retained forms. No real Fastboot or other device command ran. The downloaded browser artifact hash was verified and its home capture was visually reviewed.

macOS CI passed 35 standard-app Rust tests, 86 qualified-feature Rust tests, 49 BootForge USB tests, both universal app builds, and strict ad-hoc CI bundle verification. The qualified build is a qualification artifact and grants no physical write or public-release approval.

The unsigned installer passed integrity, read-only mount, Applications shortcut, byte-matching isolated copy, source and universal-bundle checks. Its downloaded archive and inner DMG hashes were independently verified locally. Its own eight-row live matrix reports 4 PASS, 3 BLOCKED and 1 NOT TESTED. The DMG SHA256 is `4f8ab404faff96343e167c7ebffac26a5fe3b64ce8ef3b5ae0857cc3b02ffacc`. Binary/Info.plist hashes, archive digests and retained artifact URLs are in `ci-macos.json`.

## What remains unqualified

No current USB scan or physical device operation was performed in this pass. SM-A176U, SM-T580, and the older unverified Samsung 04e8:685d / SM6150 alias remain historical target definitions, not claims about currently attached hardware. Unknown Qualcomm, MediaTek, Fastboot, storage and removable-media targets stay unattested. Brand and chipset matches never establish exact firmware compatibility or write permission.

Only declared case requirements were carried from the older matrix. No old receipt was copied or re-dated. Historical FAIL records remain in the 2026-10-20 ledger, and `ui-review-history.json` preserves the empty bootloader-panel finding at its original revision. Evaluating the older ledger normally on 2026-10-23 produced 63 BLOCKED and 20 NOT TESTED because its time-bound receipts are no longer current.

[Release PR #241](https://github.com/Bboy9090/Bobbys-Workshop-/pull/241) remains draft under its [recorded review](https://github.com/Bboy9090/Bobbys-Workshop-/pull/241#issuecomment-6333856559). Actual Developer ID app/DMG signing, accepted notarization, stapling, Gatekeeper and native GUI proof remain separate requirements. Its older successful code/unsigned packaging run is retained in `release-preparation-history.json`; those results are not receipts for this newer source. Signing-secret availability remains unverified. Connected-desktop execution is excluded from this pass.

The separate Samsung/native USB lanes are recorded in `work-audit.json`. PR #242's Samsung composite-USB versus Download Mode correction is on the macOS foundation branch; this snapshot does not claim that parallel work is integrated or physically qualified. No default-branch promotion or public release was performed.

## Re-evaluate

Run `node scripts/qualification-matrix.mjs docs/evidence/qualification-20261023/ledger.json markdown`. Normal 24-hour freshness and local artifact-hash verification apply. Hashes in this ledger bind the retained CI receipt files; downloadable build artifacts have their separate digests and URLs in those receipts. The report can block aged evidence and never authorizes execution. A later commit containing this frozen snapshot does not inherit its source-specific PASS results.
