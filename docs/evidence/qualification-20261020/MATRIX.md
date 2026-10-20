# Qualification matrix — 2026-10-20

Current recorded source: `c54e10339047dd94e61a645117c8e1d9634c7326` (PR head `a557d23c689a096dcddda8b26f7ce6bd3477a6af`). Simulation and build results do not qualify devices. Every row keeps execution authority false.

| Device / model | Protocol / operation | Evidence scope | Result | Detail |
| --- | --- | --- | --- | --- |
| github-ci / linux-ci | software / integration-tests | simulated | PASS | 295/295 repository tests across 40 files passed while the test runner hosted the actual packaged API. |
| github-ci / linux-ci | software / typecheck | simulated | PASS | TypeScript check passed. |
| github-ci / linux-ci | software / production-build | simulated | PASS | Production frontend build passed. |
| github-ci / linux-ci | software / definition-validation | simulated | PASS | 21 workflow definitions and 21 unique IDs validated. |
| github-ci / linux-ci | software / reality-gate | simulated | PASS | Production reality gate passed. |
| github-ci / linux-ci | software / evidence-isolation-tests | simulated | PASS | Hash, path confinement, model/protocol/scope/revision, freshness and write-control reporting regressions passed. No physical authority. |
| github-ci / linux-ci | software / compatibility-policy-tests | simulated | PASS | Firmware manifest, identity, provenance/hash, readiness, inventory and archive tests passed. This does not attest firmware for any physical model. |
| github-ci / linux-ci | software / scan-deadline-tests | simulated | PASS | Behavioral tests cover deadline, denied/stalled probes, duplicate unfinished probes, late results and directory fallback. |
| github-ci / linux-ci | software / device-workflow-visibility-tests | simulated | PASS | Behavioral tests cover host USB isolation, authorization, partial MTP, missing executors, catalog claims and changed diagnostic observations. |
| github-ci / linux-ci | software / navigation-component-tests | simulated | PASS | Focused views and deferred tool initialization passed the component regressions. |
| github-browser-ci / Chromium-preview | browser / Home is a compact phone workspace with honest browser readiness | simulated | PASS | Home is a compact phone workspace with honest browser readiness; no native bridge or physical device exercised. |
| github-browser-ci / Chromium-preview | browser / All six views show only their own content | simulated | PASS | All six views show only their own content; no native bridge or physical device exercised. |
| github-browser-ci / Chromium-preview | browser / Advanced tools are closed and deferred until requested | simulated | PASS | Advanced tools are closed and deferred until requested; no native bridge or physical device exercised. |
| github-browser-ci / Chromium-preview | browser / Firmware planning inputs survive navigation and disclosure toggles | simulated | PASS | Firmware planning inputs survive navigation and disclosure toggles; no native bridge or physical device exercised. |
| github-browser-ci / Chromium-preview | browser / Narrow screens retain navigation without horizontal scrolling | simulated | PASS | Narrow screens retain navigation without horizontal scrolling; no native bridge or physical device exercised. |
| github-browser-ci / Chromium-preview | browser / No uncaught application errors | simulated | PASS | No uncaught application errors; no native bridge or physical device exercised. |
| github-macos-ci / macOS-ci | rust / qualified-feature-tests | simulated | PASS | 86 qualified-feature Rust tests passed; no physical writes executed. |
| github-macos-ci / macOS-ci | rust / bootforge-usb-tests | simulated | PASS | 49 BootForge USB tests passed; no external device qualified. |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-host-usb / enumerate | hardware-read | NOT TESTED | No current evidence for this exact capability |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-heimdall / detect | hardware-read | NOT TESTED | No current evidence for this exact capability |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-adb / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
| samsung-usb-04e8-685d / UNKNOWN_USB_LABEL_SM6150 | external-fastboot / identity | hardware-read | NOT TESTED | No current evidence for this exact capability |
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
| no-qualified-target / UNATTESTED | adb / device-information | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | adb / battery-read | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | adb / logcat-read | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | adb / screenshot-read | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | adb / package-inventory | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | adb-block-read / allowlisted-partition-backup | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | mtp / file-download | hardware-read | NOT TESTED | No current evidence for this exact capability |
| no-qualified-target / UNATTESTED | adb / apk-install | hardware-write | BLOCKED | No current target or actual device-operation evidence. Any data-changing action requires its own scoped controls; no operation was executed. |
| no-qualified-target / UNATTESTED | adb / package-admin-change | hardware-write | BLOCKED | No current target or actual device-operation evidence. Any data-changing action requires its own scoped controls; no operation was executed. |
| no-qualified-target / UNATTESTED | mtp / file-upload | hardware-write | BLOCKED | No current target or actual device-operation evidence. Any data-changing action requires its own scoped controls; no operation was executed. |
| no-qualified-target / UNATTESTED | adb-block-write / same-device-calibration-restore | hardware-write | BLOCKED | No active restore executor in this workspace, verified same-device backup or device-specific approval. |
| no-qualified-target / UNATTESTED | apple-dfu / signed-restore | hardware-write | BLOCKED | Reserved catalog entry; no active Apple restore executor or designated qualified target. |
| no-qualified-target / UNATTESTED | isp-jtag-emmc-ufs / storage-identification | hardware-read | BLOCKED | Specialist planning reference only; no automatic bench executor or attested board/storage target. |
| no-qualified-target / UNATTESTED | chip-off / chip-off-reball | hardware-write | BLOCKED | Specialist physical procedure has no automatic executor, designated bench evidence or operation-specific approval. |
| no-qualified-target / UNATTESTED | windows-usb-driver / claim-inspection | hardware-read | BLOCKED | No connected Windows host, exact USB interface or physical driver-claim evidence in this pass. |
| no-qualified-target / UNATTESTED | windows-usb-driver / driver-relatch-rollback | hardware-write | BLOCKED | No designated Windows target, compatible signed driver, verified snapshot/rollback or explicit interface-specific action approval. |
| connected-mac / macOS-universal | codesign / credential-availability | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-universal | apple-notary / credential-availability | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-x86_64 | remote-desktop / evidence-capture | release | BLOCKED | Desktop Commander monthly quota exhausted. No further remote execution or capture was available. |
| connected-mac / macOS-universal | codesign / verify-standard-app | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-universal | apple-notary / accepted-app | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-universal | gatekeeper / assess-app | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-universal | dmg / install-smoke | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-universal | apple-notary / accepted-dmg | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| connected-mac / macOS-universal | tauri-gui / safe-audit-clicks | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| github-macos-ci / macOS-universal | tauri-build / build-standard-app | release | PASS | Universal standard app built and passed CI bundle verification. Unsigned/ad-hoc CI artifact only; signing/notarization/GUI remain separate. |
| github-macos-ci / macOS-universal | tauri-build / build-qualified-app | release | PASS | Universal qualified-feature app built and passed CI source/symbol checks. Qualification artifact only; no release approval or device-write authority. |
| github-macos-ci / macOS-universal | dmg / unsigned-installer-build-copy | release | NOT TESTED | No current evidence for this exact capability |
| connected-mac / macOS-universal | tauri-gui / focused-navigation-and-completed-scan | release | BLOCKED | Changed source has no completed signed/native release qualification. Desktop Commander monthly quota exhausted; older artifact receipts do not qualify this source. |
| release-ci / GitHub-Actions | credentials / secret-availability | release | BLOCKED | Credential values were not accessed. The current connector does not expose Actions secret metadata; presence remains unverified. |
| github-macos-ci / macOS-ci | rust / standard-feature-unit-tests | simulated | PASS | 35 standard app Rust tests passed with qualified writes disabled; 86 feature tests separately cover qualified gates. |

Evidence report only. Every row keeps executionAuthorized=false.

## Earlier CI failures

These original revisions are retained separately and do not describe the current source.

| Source revision | Operation | Result | Detail |
| --- | --- | --- | --- |
| `239b1c376f90aa64d0255f5cc61966329f76b4ec` | typecheck | FAIL | MTP card JSX omitted a closing brace; typecheck failed. Corrected in a later source revision. |
| `79c9f0fd1b08118abe2ef2a4e879862a5e0660ff` | packaged-api-contracts | FAIL | Three obsolete source assertions expected catalog flags to establish physical qualification. Replaced by behavioral evidence and implementation checks. |
| `9e117b3b56b8f88d1c7f5176ae8b8b7ab3c7a3fc` | typecheck | FAIL | Diagnostic summary was passed to a full-descriptor type; typecheck failed. Corrected to the minimal required identity fields. |
| `cc53e8b7d5e703fe218d868c1a80aafa305065e2` | packaged-api-contracts | FAIL | One obsolete source assertion expected the old Fastboot destination label. Serial-bound routing now has a behavioral regression. |
| `843cbbf344b10a6602c58cd78a5f601165c0e9b6` | source-contract-tests | FAIL | CI source assertion assumed the old Cargo argument order. The packaged application still uses its committed lockfile; the supported command prefix is retained. |
| `843cbbf344b10a6602c58cd78a5f601165c0e9b6` | bootforge-library-check | FAIL | A new --locked library check failed because this library has no committed Cargo.lock. Corrected the library check to its existing library policy; the packaged application's committed dependency graph remains locked. |
| `39e3dd909a9ae0204c05b7b2ade287cfa7d7b20a` | strict-ci-bundle-integrity | FAIL | DMG integrity, read-only mount and byte-matching isolated universal copy passed. Strict app-bundle signature verification failed: executable ad-hoc metadata did not seal the app bundle. CI is adding explicit ad-hoc bundle sealing; no Developer ID or notarization is claimed. |
