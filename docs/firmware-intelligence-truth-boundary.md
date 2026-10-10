# BobFWTools Firmware Intelligence — verified scope

## Implemented on this branch
- Structured metadata validation for manufacturer, exact model, build, region, carrier, HTTPS source URL, and SHA-256 syntax.
- Duplicate build-record detection.
- Fail-closed comparisons between supplied device identity and a firmware record.
- Read-only preflight receipts recording supplied checksum, source, signature, rollback, and partition claims.
- A dedicated GitHub Actions workflow that attempts to execute targeted Vitest cases and TypeScript type checking.

## Not implemented or proven
- No complete firmware archive for every brand or model.
- No firmware file download, authenticated OEM release feed, or signed package verification.
- No on-device board-ID read, physical-device authorization, anti-rollback inspection, or partition proof.
- No independent attestation of caller-supplied evidence: booleans supplied to the preflight are untrusted.
- No firmware writing/erasing/unlocking, iOS restore integration, hardware qualification, or release certification.
- The local Mac's unpushed firmware UI/source registry cannot be assumed present on GitHub.

## Required production acceptance
1. GitHub Actions must show an actual successful run for the exact PR head commit, not just the existence of a YAML file.
2. Reconcile the Mac branch source files with this additive work before any merge.
3. For each OEM, document the legitimate source interface, license/terms, and whether model-specific inventory retrieval is supported.
4. Bind device identity evidence to the physical transport and store provenance.
5. Independently hash the downloaded artifact, verify the OEM signature where supported, evaluate device rollback floors, and produce evidence receipts.
6. Maintain execution disabled until hardware qualification and independent approval.

Do not call an inventory entry a verified firmware image, and do not display a green compatibility/flash-ready state from a model name or user-entered hash alone.
