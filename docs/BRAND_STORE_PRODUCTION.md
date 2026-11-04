# BobFWTools — Store and Brand Production Contract

## Public product name
**BobFWTools**

## Public positioning
Phone & Tablet Diagnostics • Recovery • Transfer • Authorized Repair

BobFWTools is the mobile-device repair and connectivity product in Bobby's Workshop. Computer boot/recovery belongs to **Boot It Back** and recovery-media creation belongs to **Phoenix Key**.

## Current verified release foundation
The merged macOS foundation already has green Node.js CI and BobFWTools macOS Core CI, a universal Apple Silicon + Intel application build, bundle identifier `com.bobbyblanco.bobfwtools`, sandbox/USB/user-selected-file entitlements, and a Developer ID signed direct-distribution copy.

App Store publication remains blocked until a matching macOS App Store provisioning profile exists for `com.bobbyblanco.bobfwtools`. Physical Android-device qualification must remain distinct from compile/build qualification.

## Store short description
Professional phone and tablet diagnostics, transfer, recovery, and authorized repair workflows.

## Store long description
BobFWTools connects a Mac to real Android phones and tablets through native USB evidence, MTP, ADB, and Fastboot where the device explicitly exposes those transports. It supports device identification, file browsing and transfer, safe diagnostic workflows, qualification evidence, and tightly gated repair operations without pretending that unavailable hardware data or unqualified destructive actions succeeded.

## Icon master
- Two-device silhouette: phone + tablet.
- A compact diagnostic/connection glyph rather than a generic wrench.
- Android and Apple device-family cues may appear as secondary context only; avoid implying OEM endorsement.
- Readable at 32 px and maskable for future mobile shells.

## Splash master
- Connected phone/tablet pair enters a diagnostic workspace.
- Wordmark: **BobFWTools**.
- Secondary line: **Diagnose. Recover. Transfer. Repair.**
- No simulated progress bars or fake hardware state in screenshots.

## Required asset exports
- macOS 1024×1024 icon master and ICNS/AppIcon outputs
- 1024×1024 future mobile icon master
- 512/192 PWA/web exports if web shell is shipped
- 2732×2732 launch master
- 1920×1080 marketing banner
- Store screenshots: Device Scan, USB Evidence, MTP Browser, ADB Diagnostics, Qualification Dossier, Recovery Command Center

## Compatibility rule
Do not rename:
- `com.bobbyblanco.bobfwtools`
- internal evidence schema IDs
- native command names
- qualification dossier schemas
- persisted device/session identifiers
- BootForge library/crate identifiers used internally

inside a display-asset PR.
