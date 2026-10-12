# BobFWTools local signed/notarized macOS release

This lane keeps the Developer ID private key in the Mac login keychain instead of exporting it to GitHub.

## One-time notarization profile

Use either Apple ID authentication or an App Store Connect API key. Nothing is committed to the repository; `notarytool` stores the resulting profile in the macOS keychain.

Apple ID + app-specific password:

```bash
export BOBFW_APPLE_ID='your-apple-id@example.com'
export BOBFW_APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'
export BOBFW_EXPECTED_TEAM_ID='86NUJ8M3B8'
bash scripts/configure-bobfwtools-notary-profile.sh BobFWTools
unset BOBFW_APPLE_ID BOBFW_APP_SPECIFIC_PASSWORD
```

App Store Connect API key:

```bash
export BOBFW_NOTARY_KEY_PATH="$HOME/private/AuthKey_XXXXXXXXXX.p8"
export BOBFW_NOTARY_KEY_ID='XXXXXXXXXX'
export BOBFW_NOTARY_ISSUER_ID='00000000-0000-0000-0000-000000000000'
export BOBFW_EXPECTED_TEAM_ID='86NUJ8M3B8'
bash scripts/configure-bobfwtools-notary-profile.sh BobFWTools
unset BOBFW_NOTARY_KEY_PATH BOBFW_NOTARY_KEY_ID BOBFW_NOTARY_ISSUER_ID
```

## Prerequisite check

```bash
BOBFW_RELEASE_CHECK_ONLY=1 bash scripts/release-bobfwtools-macos-local.sh 0.1.0-rc1
```

## Release

```bash
bash scripts/release-bobfwtools-macos-local.sh 0.1.0-rc1
```

The release lane builds the normal non-qualified universal application, validates the public-release safety boundary, signs with the single Developer ID Application identity for team `86NUJ8M3B8`, notarizes and staples the app and DMG, runs Gatekeeper, and produces JSON provenance plus SHA-256 receipts.
