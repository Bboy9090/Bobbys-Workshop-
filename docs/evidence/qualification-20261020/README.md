# Qualification evidence — 2026-10-20

This snapshot records exact-source CI and explicit device/release gaps for PR #240. Every row is an evidence report with executionAuthorized=false.

- Pull-request head: `a557d23c689a096dcddda8b26f7ce6bd3477a6af`
- Tested integration merge: `c54e10339047dd94e61a645117c8e1d9634c7326`
- Verified identical Git tree: `cdd84a2e26ca47eab40e2ce5b21c777c650b0a25`
- Node CI: https://github.com/Bboy9090/Bobbys-Workshop-/actions/runs/39509792194
- macOS Core CI: https://github.com/Bboy9090/Bobbys-Workshop-/actions/runs/39509792161
- Current-source result counts: PASS 21, FAIL 0, BLOCKED 35, NOT TESTED 20.
- Earlier failed attempts: 6; original revisions and excerpts retained in prior-ci-failures.json.

The source tree was frozen before recording the evidence. The subsequent evidence/integrity-test and installer-CI commit must pass fresh CI before merge. These earlier CI receipts do not silently become receipts for another revision. The new unsigned installer check produces a separate source-bound ledger and hash-verified matrix in its CI artifact; this snapshot predates that check.

## What passed

The packaged API/repository suite, TypeScript, frontend production build, production reality gate and 21 JSON workflow definitions passed. Standard-app and qualified-feature Rust tests ran separately; BootForge USB tests also passed. The unsigned/ad-hoc universal standard and qualified app bundles passed CI verification. The qualified bundle is a qualification artifact, not a release approval.

Browser-only Chromium checks passed with no native bridge: one visible workspace, six destinations, closed/deferred Advanced tools, preserved firmware inputs, no desktop-home scrolling at 1365×900, no horizontal overflow in the tested 390×844 views, and no uncaught page errors. PNG captures and the runtime report are available in the browser artifact linked from CI.

## Device and release boundary

No physical phone is qualified by this snapshot. The last connected-Mac host observation in the session found eight built-in Apple USB components and no external Android target. Raw host logs, the earlier shared-cache Rust failure, isolated rebuild results, and older native app/installer checks remain on the Mac; they have not been copied or promoted into current-source hardware PASS receipts.

SM-A176U, SM-T580 and the older Samsung 04e8:685d / SM6150 alias keep separate historical identities and exceptions. Unknown Qualcomm, MediaTek, Fastboot and raw-media targets remain unattested. Brand/chipset lookup and simulated firmware compatibility tests do not prove an exact physical model or package.

Desktop Commander exhausted its monthly quota. Current-source Developer ID signing, app/DMG notarization, stapling, Gatekeeper, installer copy/launch and native GUI qualification remain BLOCKED. Older signed app/DMG evidence in the 2026-10-18 directory is preserved and is not reused for this UI. Actions signing-secret availability is unverified through the current connector.

The default branch has a different release workflow and receipt interface. Reconcile those differences while preserving its installer and DMG notarization stages before promotion. No public release was published.

No flash, wipe, unlock, repartition, restore or raw-media write was performed or approved. Such operations require current exact-device evidence, compatible trusted firmware, a verified recovery path and explicit approval for the named device and operation.

## Files and verification

- `ledger.json`: source/device/protocol/operation/scope-bound cases and receipts.
- `MATRIX.md`: current-source results followed by clearly separated historical failures.
- `ci-node.json`, `ci-macos.json`, `ci-rust.json`: GitHub job/step snapshots and actual result excerpts.
- `browser-ui.json`: browser runtime measurements and artifact digest.
- `work-audit.json`: branches, PRs, preservation and release-promotion findings.
- `prior-ci-failures.json`: failed attempts retained against their original source.
- `../../WORKFLOW_AVAILABILITY_AUDIT_20261020.md`: all 11 policy entries and interface rules.

Run `node scripts/qualification-matrix.mjs docs/evidence/qualification-20261020/ledger.json markdown` for live evaluation. Normal 24-hour freshness rules apply. The fixture integrity test evaluates only the archived capture time; it grants no authority and does not extend live evidence freshness.
