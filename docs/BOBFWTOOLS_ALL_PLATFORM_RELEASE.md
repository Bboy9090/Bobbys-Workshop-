# BobFWTools desktop release qualification

The candidate continues PR #241 and the hardware readiness integration. The
all-platform packaging lane builds the **standard** application only. Testing
the qualified Rust configuration does not authorize distributing that writer.

| Platform | Candidate packages | Native qualification | Remaining public release gates |
| --- | --- | --- | --- |
| macOS x86_64 + arm64 | Universal app and DMG | CI packaging; Developer ID, app + DMG notarization, Gatekeeper, isolated copied-app GUI required on the connected Mac | Current-source signed receipts and native smoke; arm64 GUI remains separately untested on an Intel host |
| Windows x86_64 | MSI and NSIS | Disposable Windows CI: MSI extraction, isolated current-user NSIS installation, WebView2 accessible navigation | Authenticode signing and supported-user-host SmartScreen assessment |
| Linux x86_64 | AppImage and Debian | Disposable Ubuntu CI: both package extractions, ELF provenance, native WebKitGTK accessible navigation under Xvfb | Trusted checksum publication and physical supported-distribution installation |
| Windows / Linux arm64 | None qualified | NOT TESTED | Native package builds, dependencies, installer and GUI evidence |

The Windows/Linux workflow extends the packaging work already present in PR
#245. It does not import that draft's connected-device throughput benchmark.
The candidate reconciles the reviewed workspace with foundation Samsung
classification, firmware provenance, read-only Odin proof, and gate assessment
work. PR #254's descriptor correction is retained for the Windows driver family
and all three packaged authorization API copies. A USB descriptor or successful
`heimdall detect` never supplies physical write approval.

Each package job runs the actual packaged API, portable repository tests,
TypeScript, lint, reality/workflow checks, USB Rust tests, and both standard and
qualified Rust gate tests. Windows excludes two POSIX command-fixture test files;
the full Linux and macOS suites still run them. This is a platform boundary for
test fixtures, not omitted API coverage.

`scripts/qualify-platform-packages.mjs windows|linux NEW_OUTPUT_DIRECTORY`
requires native execution, a full source SHA equal to executor HEAD, a clean
tracked tree, complete installer pairs, and source-bound x86_64 executables from
each copied package. It rejects the qualified destructive-writer markers. The
Windows helper may install only on a disposable GitHub CI host; the Linux helper
uses AT-SPI under Xvfb without disabling a runtime sandbox. Failures retain a
FAIL receipt and logs. Successful installer/GUI checks produce hash-bound PASS
rows; signing, user-host, arm64, and device gates retain BLOCKED / NOT TESTED.

Artifacts named `windows-msi-nsis-unsigned` and
`linux-appimage-deb-unsigned` are qualification artifacts. They are not signed,
publicly approved releases. Every receipt keeps `hardwareQualified`,
`releaseQualified`, and `executionAuthorized` false. Never relabel an old
artifact or reuse an older source's PASS for a later revision.

Desktop Commander access was restored on 2026-10-23. Initial read-only discovery
found a Developer ID identity and an authenticated `BobFWTools` Keychain
notarization profile. The first USB observation found built-in Apple components,
hubs, and a video adaptor, with no Android target. This observation does not
prove an empty bench at any later time. The dirty canonical Mac checkout remains
untouched; release work uses an isolated checkout and new output paths.

No attached-device writes, reboot/mode changes, driver relatching, flash, wipe,
unlock, PIT repartition, calibration restore, or removable-media writes are part
of packaging or GUI smoke. Actual destructive qualification still requires
exact live device evidence, trusted compatible firmware, recovery readiness,
and explicit approval for the named device and operation.
