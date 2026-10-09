# BobFWTools

BobFWTools is a macOS-first Android connectivity and device-support application focused on the gap between Apple hardware and Android phones, especially Samsung and MediaTek-based devices.

The product is local-first. Core USB enumeration, MTP browsing, ADB/Fastboot detection, and device evidence are intended to work without a cloud dependency.

## Current production foundation

The active macOS core is:

- **Tauri 2 + Rust** for the desktop application and native commands
- **BootForge USB** for real USB descriptor enumeration
- **mtp-rs** for real Media Transfer Protocol sessions
- **React + TypeScript** for the desktop UI
- **Android Platform Tools** for ADB/Fastboot workflows where Android explicitly exposes those transports

The Mac App Store build is sandboxed and requests only the hardware/file entitlements required for USB and user-selected file access.

Legacy Node, Python, FastAPI, demo flash services, and historical repair modules are not part of the default BobFWTools App Store bundle.

## Product rules

BobFWTools has a strict truth boundary:

1. No synthetic production devices.
2. No random or hard-coded hardware telemetry.
3. No fake flash or transfer success.
4. Missing device data stays unavailable or null.
5. Read-only inspection must never silently modify the phone.
6. Destructive operations stay disabled until a real executor, preflight, verification path, rollback policy, and physical-device qualification exist.
7. Test fixtures may simulate hardware only inside test-only code and must never ship as runtime device evidence.

The CI production-reality gate enforces these rules against shipping source.

## Native USB

BootForge USB enumerates actual host USB devices and records:

- vendor ID
- product ID
- manufacturer string when exposed
- product string when exposed
- serial string when exposed
- device class/subclass/protocol
- bus/address
- platform hint
- connection/mode hint
- evidence source

Known vendor families include Samsung, MediaTek, Google, Motorola, Xiaomi, OnePlus, and Apple.

## MTP

BobFWTools uses a real MTP session rather than treating ADB as a substitute for file transfer.

The current native MTP surface supports:

- device information
- manufacturer/model/serial evidence
- storage discovery
- free-space reporting
- root object listing

The underlying MTP library supports transfer and file-management operations; BobFWTools exposes new write operations only after the read-only transport and failure handling are qualified.

For ordinary Android file browsing, USB debugging is not required. The phone must be unlocked and placed in **File transfer / Android Auto** USB mode when Android prompts for the connection purpose.

## App Store boundary

The default macOS package:

- uses App Sandbox
- enables USB device access
- allows user-selected read/write file access
- excludes legacy Node/Python server payloads
- builds the native Rust/Tauri core only

Bundle identifier:

`com.bobbyblanco.bobfwtools`

## Development

Requirements:

- Node.js 20+
- Rust stable
- Apple Command Line Tools / Xcode toolchain on macOS

Install dependencies:

```bash
npm install
```

Run the production-reality gate:

```bash
npm run verify:reality
```

Run the complete BobFWTools source qualification:

```bash
npm run bobfw:check
```

Run tests:

```bash
npm run bobfw:test
```

Run the desktop app:

```bash
npm run tauri:dev
```

Build a universal macOS application:

```bash
npm run tauri:build:macos
```

The universal target covers Apple Silicon and Intel.

## CI

`.github/workflows/bobfwtools-macos.yml` qualifies the macOS core on a macOS runner. It checks:

- production-reality rules
- frontend compilation
- BootForge USB compilation
- BobFWTools Rust/Tauri compilation
- BootForge USB tests
- macOS entitlements
- universal `BobFWTools.app` creation
- absence of legacy server/Python payloads from the produced app bundle

The workflow uploads the real `BobFWTools.app` bundle as a CI artifact only after those gates pass.

## Cloud services

Cloud services are support infrastructure, not a requirement for plugging a phone into a Mac.

Planned cloud uses must remain narrowly scoped to things such as signed compatibility catalogs, release metadata, opt-in crash diagnostics, support bundles, enterprise policy, and account/licensing services. Device file browsing and core USB/MTP operation remain local.

## Security and ownership

BobFWTools is for legitimate device management, diagnostics, transfer, backup, and authorized repair workflows.

The production core does not include account-lock circumvention, credential bypass, hidden security-control removal, IMEI alteration, or synthetic claims that an operation succeeded.

## Branch authority

Current foundation work is developed on:

`feat/bobfwtools-macos-foundation`

Draft PR:

`#194 — BobFWTools macOS foundation: real-device production baseline`

The PR stays draft until native macOS CI and physical-device qualification justify promotion.
