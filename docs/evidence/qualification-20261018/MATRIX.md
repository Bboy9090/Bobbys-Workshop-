| Device / model | Protocol / operation | Evidence scope | Result | Detail |
| --- | --- | --- | --- | --- |
| github-ci / linux-ci | software / integration-tests | simulated | PASS | 264/264 tests across 35 files passed against packaged API. |
| github-ci / linux-ci | software / typecheck | simulated | PASS | TypeScript check succeeded in the completed Node CI job. |
| github-ci / linux-ci | software / production-build | simulated | PASS | Frontend production build succeeded. |
| github-ci / linux-ci | software / definition-validation | simulated | PASS | 21 workflow definitions and 21 unique IDs validated. |
| github-ci / linux-ci | software / evidence-isolation-tests | simulated | PASS | Matrix boundary, stale evidence, hash tamper and path confinement tests passed within the 264-test suite. |
| github-ci / linux-ci | software / compatibility-policy-tests | simulated | PASS | Existing firmware model manifest, readiness, archive and intake tests passed. This is simulation, not a compatible physical firmware claim. |
| github-macos-ci / macOS-ci | rust / qualified-feature-tests | simulated | PASS | 86/86 qualified-feature Rust tests passed. No hardware exercised. |
| connected-mac / macOS-x86_64 | rust / bootforge-usb-tests | simulated | PASS | 49/49 BootForge USB tests passed on unchanged Rust sources at the recorded baseline. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-host-usb / enumerate | hardware-read | PASS | Host IORegistry observed Samsung 04e8:685d with label SM6150. Exact model and protocol session remain unverified. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-heimdall / detect | hardware-read | FAIL | Read-only detector returned detected=false, Heimdall exit 1 / wrapper exit 3. Raw error cause was not retrieved. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-adb / identity | hardware-read | BLOCKED | Host tool returned exit 0 with an empty device list. No exact model/build/CSC attestation. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-fastboot / identity | hardware-read | BLOCKED | Host tool returned exit 0 with an empty device list. No exact model/build/CSC attestation. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | native-usb / app-enumeration | hardware-read | NOT TESTED | No current evidence for this exact capability |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | mtp / browse | hardware-read | NOT TESTED | No current evidence for this exact capability |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / protocol-session | hardware-read | NOT TESTED | No current evidence for this exact capability |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / trusted-firmware | hardware-write | BLOCKED | Exact model, trusted compatible firmware, qualified recovery path, and explicit device-specific operation approval are not established. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / firmware-compatibility | hardware-write | BLOCKED | Exact model, trusted compatible firmware, qualified recovery path, and explicit device-specific operation approval are not established. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / recovery-readiness | hardware-write | BLOCKED | Exact model, trusted compatible firmware, qualified recovery path, and explicit device-specific operation approval are not established. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / partition-flash | hardware-write | BLOCKED | Exact model, trusted compatible firmware, qualified recovery path, and explicit device-specific operation approval are not established. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / userdata-wipe | hardware-write | BLOCKED | Exact model, trusted compatible firmware, qualified recovery path, and explicit device-specific operation approval are not established. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | samsung-download / bootloader-unlock | hardware-write | BLOCKED | Exact model, trusted compatible firmware, qualified recovery path, and explicit device-specific operation approval are not established. |
| historical-sm-a176u / SM-A176U | adb / identity | hardware-read | BLOCKED | Historical repository evidence exists; this exact model is not attested by the current connected-device scan. |
| historical-sm-a176u / SM-A176U | samsung-download / partition-flash | hardware-write | BLOCKED | Current target, firmware/recovery evidence and device-specific write approval are absent. |
| historical-sm-t580 / SM-T580 | adb / identity | hardware-read | BLOCKED | Historical repository evidence exists; this exact model is not attested by the current connected-device scan. |
| historical-sm-t580 / SM-T580 | samsung-download / partition-flash | hardware-write | BLOCKED | Current target, firmware/recovery evidence and device-specific write approval are absent. |
| no-qualified-target / UNATTESTED | qualcomm-edl / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | qualcomm-edl / physical-write | hardware-write | BLOCKED | No designated target, trusted payload, qualified recovery evidence, and approved physical operation. |
| no-qualified-target / UNATTESTED | mediatek-brom / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | mediatek-brom / physical-write | hardware-write | BLOCKED | No designated target, trusted payload, qualified recovery evidence, and approved physical operation. |
| no-qualified-target / UNATTESTED | mediatek-preloader / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | mediatek-preloader / physical-write | hardware-write | BLOCKED | No designated target, trusted payload, qualified recovery evidence, and approved physical operation. |
| no-qualified-target / UNATTESTED | fastboot / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | fastboot / physical-write | hardware-write | BLOCKED | No designated target, trusted payload, qualified recovery evidence, and approved physical operation. |
| no-qualified-target / UNATTESTED | raw-removable-media / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | raw-removable-media / physical-write | hardware-write | BLOCKED | No designated target, trusted payload, qualified recovery evidence, and approved physical operation. |
| connected-mac / macOS-universal | codesign / credential-availability | release | PASS | Developer ID Application identity for team 86NUJ8M3B8 was present. This verifies availability only. |
| connected-mac / macOS-universal | apple-notary / credential-availability | release | PASS | Existing BobFWTools Keychain profile history check returned exit 0. No artifact notarization is claimed. |
| connected-mac / macOS-x86_64 | remote-desktop / evidence-capture | release | BLOCKED | Process-output RPC timed out. Latest remote ledger capture completion is unconfirmed; no signing or GUI result can be claimed. |
| connected-mac / macOS-universal | codesign / verify-standard-app | release | NOT TESTED | No current evidence for this exact capability |
| connected-mac / macOS-universal | apple-notary / accepted-app | release | NOT TESTED | No current evidence for this exact capability |
| connected-mac / macOS-universal | gatekeeper / assess-app | release | NOT TESTED | No current evidence for this exact capability |
| connected-mac / macOS-universal | dmg / install-smoke | release | NOT TESTED | No current evidence for this exact capability |
| connected-mac / macOS-universal | apple-notary / accepted-dmg | release | NOT TESTED | No current evidence for this exact capability |
| connected-mac / macOS-universal | tauri-gui / safe-audit-clicks | release | NOT TESTED | No current evidence for this exact capability |

Evidence report only. Every row keeps executionAuthorized=false.

