# BobFWTools macOS Release Runbook

The `BobFWTools macOS Signed Release` workflow on `main-tool-kit` is the public macOS release lane. It builds only the normal, non-qualified BobFWTools app.

## Required GitHub Actions secrets

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Never commit certificate bytes, private keys, passwords, Apple credentials, or secret values.

## Release sequence

1. Confirm the intended source commit is on `main-tool-kit`.
2. Confirm ordinary Node.js CI and BobFWTools macOS Core are green.
3. Open GitHub Actions → **BobFWTools macOS Signed Release** → **Run workflow**.
4. Enter a release label containing only letters, numbers, `.`, `_`, or `-` (1–64 characters).
5. Start the workflow.

The release workflow does not permit overlapping release jobs.

## Evidence produced

A successful run proves:

- production reality/tests passed before packaging;
- the app is universal `x86_64` + `arm64`;
- the public build does not contain the qualified destructive executor;
- the Developer ID certificate matches `APPLE_TEAM_ID`;
- hardened-runtime signing verifies;
- Apple accepted app notarization;
- Apple accepted DMG notarization;
- both tickets were stapled and validated;
- Gatekeeper accepted both the app and DMG;
- source revision and SHA-256 artifact identities were recorded.

The uploaded release contains the notarized DMG, zipped app, Apple notarization JSON receipts, the legacy text receipt, and `RELEASE-RECEIPT.json`.

## Qualified destructive-writer boundary

The qualified destructive-writer artifact from macOS Core is a qualification artifact only. Do not sign, notarize, or distribute it as the public production release until designated-device destructive bench-write and post-write verification evidence has been completed and a separate qualified release policy is explicitly approved.
