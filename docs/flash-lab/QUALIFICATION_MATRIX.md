# Device and protocol evidence matrix

Run `npm run qualification:matrix -- docs/evidence/qualification-20261018/ledger.json markdown`.
Omit `markdown` for machine-readable JSON. Reports age evidence at evaluation time; they are snapshots, not permanent qualifications.

Each case declares a unique caseId, exact model, redacted deviceAlias, protocol, operation, evidence scope and full sourceRevision.
The scopes are simulated, hardware-read, hardware-write and release. Add cases per model and operation rather than extending a family-wide permission.
Unknown model identity must remain visibly unknown. Historical observations stay tied to their original revision and date.

Receipts bind every case field, timestamp, PASS/FAIL/BLOCKED/NOT TESTED result, explanation and relative artifact paths with SHA-256 digests.
The CLI verifies actual local artifact bytes, confines resolved paths to the ledger directory and rejects external symlinks.
Evidence older than 24 hours, future timestamps, invalid hashes or missing artifacts becomes BLOCKED.
Without matching evidence a row remains NOT TESTED. Latest matching evidence wins; a tied failure takes precedence.
A model-specific exception on a case overrides a claimed passing receipt.

A hardware-write PASS additionally references hashed artifacts for liveIdentity, trustedFirmware, firmwareCompatibility,
recoveryReadiness, deviceSpecificApproval and postWriteVerification using zero-based artifact indices.
Those references document the separate qualification review; byte integrity does not authenticate the truth of a receipt.
This reporter is not connected to the executor and always returns executionAuthorized=false.
Existing trusted backend receipts, transaction controls, scoped grants and explicit approval still govern any operation.

Firmware package structure or MD5 integrity alone does not establish OEM authenticity, exact model/board/SKU match,
regional compatibility or rollback safety. Keep separate case rows for those capabilities.
SM-A176U firmware writes remain BLOCKED until that model's actual recovery and servicing path is qualified.
A Samsung vendor ID alone does not prove Download Mode, identity or any write capability.

The readiness screen defaults to detected, target-bound workflow lanes. The operator may inspect unavailable workflows
and qualification backlog with the checkbox. USB mode hints remain diagnostic observations, not established protocol sessions.
