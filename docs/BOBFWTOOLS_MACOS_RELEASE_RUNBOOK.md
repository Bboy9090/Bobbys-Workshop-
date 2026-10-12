# BobFWTools macOS Release Runbook

This runbook covers the public **standard BobFWTools macOS app**. It does not authorize distribution of the qualified destructive-writer build.

## When the release workflow becomes runnable

The manual `BobFWTools macOS Release` workflow must exist on the repository default branch (`main-tool-kit`) before GitHub will normally expose it as a Run workflow action.

PR #203 currently targets `feat/bobfwtools-calibration-edl-safety`, so the release workflow becomes operational only after this work is propagated to `main-tool-kit`.

## Required GitHub Actions secrets

Configure these repository or environment secrets in GitHub Actions:

- `BOBFW_DEVELOPER_ID_P12_BASE64` — base64-encoded Developer ID Application certificate and private key exported as PKCS#12.
- `BOBFW_DEVELOPER_ID_P12_PASSWORD` — password used when the PKCS#12 was exported.
- `BOBFW_DEVELOPER_IDENTITY` — exact Developer ID Application identity shown by macOS `security find-identity -v -p codesigning`.
- `APPLE_ID` — Apple account used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for that Apple account.
- `APPLE_TEAM_ID` — Apple Developer Team ID. The signing certificate TeamIdentifier must match this value.

Do not commit any certificate, private key, password, Apple ID credential, or secret value to the repository.

## Run the release

1. Confirm the desired source commit is on `main-tool-kit`.
2. Confirm ordinary Node.js CI and BobFWTools macOS Core are green for that source.
3. Open GitHub Actions and select **BobFWTools macOS Release**.
4. Choose **Run workflow**.
5. Enter a short release label such as `0.1.0-rc1`. The workflow sanitizes the label before using it in artifact names or provenance metadata.
6. Start the workflow.

The workflow intentionally fails closed if any release credential is missing.

## What the workflow proves

The release job:

1. Re-runs source reality, TypeScript, repository tests, workflow validation, and BootForgeUSB tests.
2. Builds the universal standard macOS app.
3. Verifies the unsigned build before signing.
4. Creates a temporary keychain and imports the Developer ID certificate.
5. Requires the certificate TeamIdentifier to match `APPLE_TEAM_ID`.
6. Signs with hardened runtime and a secure timestamp.
7. Verifies the signed app.
8. Submits the app to Apple with `notarytool`.
9. Requires notarization status exactly `Accepted`.
10. Staples and validates the notarization ticket.
11. Requires Gatekeeper `spctl` acceptance.
12. Confirms both `x86_64` and `arm64` architecture evidence through the normal app verifier.
13. Confirms the built binary contains the source revision.
14. Produces a machine-readable release provenance receipt.
15. Uploads the notarized app, Apple notarization receipt, and BobFWTools release receipt.
16. Deletes the temporary signing keychain even when the job fails.

## Expected artifacts

The workflow uploads an artifact named:

`BobFWTools-macOS-notarized-<sanitized-release-label>`

It contains:

- `BobFWTools-DeveloperID.app`
- `bobfwtools-notarization-receipt.json`
- `bobfwtools-release-receipt.json`

The BobFWTools release receipt records:

- release label
- source revision
- executable SHA-256
- Info.plist SHA-256
- architectures
- Developer ID authority
- TeamIdentifier
- signing identifier
- Apple notarization status
- Apple notarization submission ID
- notarization receipt SHA-256
- stapling validation
- Gatekeeper acceptance
- an explicit declaration that the qualified destructive writer is not included

## Failure handling

Do not bypass a red signing or notarization gate.

If the workflow fails:

- Missing credential: configure the named secret and rerun.
- Certificate import/signing failure: verify the PKCS#12, password, Developer ID identity, and Team ID.
- TeamIdentifier mismatch: use the correct Developer ID certificate for the configured Apple team.
- Notarization rejected: inspect Apple's notarization result and correct the reported app/signing issue before rerunning.
- Stapler or Gatekeeper failure: do not distribute that artifact.
- Source/test/build failure: fix the source branch and produce a fresh release run.

## Qualified destructive-writer boundary

The qualified destructive-writer app produced by macOS Core is a qualification artifact, not the public release artifact.

Do not sign/notarize/distribute it as production software until the designated-device physical qualification process has real bench-write and post-write verification evidence and the project explicitly opens a qualified release lane.
