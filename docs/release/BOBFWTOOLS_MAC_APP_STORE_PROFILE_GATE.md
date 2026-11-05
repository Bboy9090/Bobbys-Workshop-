# BobFWTools Mac App Store Provisioning Gate

The direct-download Developer ID lane and the Mac App Store lane are separate.

The Mac App Store lane remains blocked until the release operator supplies a real Apple-issued provisioning profile for `com.bobbyblanco.bobfwtools`.

Run on macOS:

```bash
export BOBFW_EXPECTED_TEAM_ID="<Apple Team ID>"
bash scripts/verify-bobfwtools-mac-app-store-profile.sh /path/to/BobFWTools.provisionprofile
```

The preflight rejects:
- expired profiles
- wrong Apple Team ID
- wrong bundle/application identifier
- development/ad-hoc profiles with `ProvisionedDevices`
- development profiles with `get-task-allow=true`
- Developer ID/all-devices profiles used in the App Store lane
- missing sandbox, USB, or user-selected-file shipping entitlements

A PASS proves profile/identity/entitlement preflight only. It does not prove App Store Connect acceptance or review approval.
