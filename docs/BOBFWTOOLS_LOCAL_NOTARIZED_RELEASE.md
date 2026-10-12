# BobFWTools local signed/notarized macOS release

This lane keeps the Developer ID private key in the Mac login keychain instead of exporting it to GitHub.

## One-time notarization profile

Create an Apple app-specific password for the Apple ID that belongs to team `86NUJ8M3B8`, then run in a local shell without committing the values:

```bash
export BOBFW_APPLE_ID='your-apple-id@example.com'
export BOBFW_APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'
export BOBFW_EXPECTED_TEAM_ID='86NUJ8M3B8'
bash scripts/configure-bobfwtools-notary-profile.sh BobFWTools
unset BOBFW_APPLE_ID BOBFW_APP_SPECIFIC_PASSWORD
```

`notarytool` stores the credential in the macOS keychain under the `BobFWTools` profile.

## Prerequisite check

```bash
BOBFW_RELEASE_CHECK_ONLY=1 bash scripts/release-bobfwtools-macos-local.sh 0.1.0-rc1
```

## Release

```bash
bash scripts/release-bobfwtools-macos-local.sh 0.1.0-rc1
```

The release lane builds the normal non-qualified universal application, validates the public-release safety boundary, signs with the single Developer ID Application identity for team `86NUJ8M3B8`, notarizes and staples the app and DMG, runs Gatekeeper, and produces JSON provenance plus SHA-256 receipts.
