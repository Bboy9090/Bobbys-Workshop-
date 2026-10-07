# Checkpoint contract v1

Run `node scripts/agents/validate-checkpoint.cjs checkpoint.json`.
Run contract tests with `node --test scripts/agents/checkpoint-validator.test.cjs`.
No dependency installation is required.

Required fields: version (1), project, task, owner, timestamp (UTC ISO), source (repository, branch, full 40-character commit revision), state, blockers (array), dependencies (array), nextAction, and evidence (array).

States: planned, implemented, tested, deployed, published, physicallyProven. Every state beyond planned requires a successful receipt of its corresponding kind: implementation, test, deployment, publication, hardware. Receipts require kind, executor, full revision, HTTPS URL without credentials, and result (pass, fail, notRun). Supporting receipts can fail, but the receipt supporting the claimed state must pass and match the source revision.

This validates structure and revision consistency. It does not fetch URLs, authenticate receipts, establish exclusive ownership, or authorize commands. Independent receipt inspection remains required. Do not store secrets in checkpoints.

CLI exits: 0 valid, 1 invalid contract, 2 unreadable/malformed input or usage error. Error handling avoids printing file paths or file contents.

## Execution record — 2026-10-06
The exact validator function and 24 checked-in test inputs were evaluated in the functions V8 executor: 24 passed. Coverage includes null input, owner/revision/date/state/blocker failures, five state-specific successful receipts, mismatched revisions, failed receipts, and credential-bearing URLs.

The workspace exec server was unavailable. Node test runner, file-reading CLI, application build, and repository lint were NOT RUN. PR remains draft pending those checks. This is checkpoint validation, not cross-platform runtime coordination.

## Execution record — 2026-10-07
Node v24.19.0 executed the actual checked-out validator and test files: 31/31 tests passed. CLI subprocess checks covered valid (0), invalid (1), malformed/unreadable/usage (2) input and non-disclosure of input text and temporary paths. URL regression checks found and corrected an escaped-character-class defect; the validator now uses native URL parsing and rejects whitespace, credentials, invalid ports, and non-HTTPS schemes while accepting normal receipt paths.

Code and expanded test revision: c63c43da67ff036edbfa57de66a7e90bf6d0547e. This record describes local Node execution; frontend build, repository lint, external receipt authenticity, exclusive leases, and platform runtime connections remain unverified.
