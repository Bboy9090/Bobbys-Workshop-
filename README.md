# Bobby's World - Workshop Toolkit

> **🔓 Now featuring Pandora's Room** - Advanced device management with The-Pandora-Codex integration  
> **🔐 Bobby's Secret Workshop** - Modular workflows, Trapdoor API, and shadow logging  
> **📦 PRODUCTION READY: Standalone Installers** - One-click install for Windows, macOS & Linux!

Professional repair diagnostic and flashing toolkit with comprehensive multi-brand support, educational security lock resources, real-time device monitoring, and the powerful **Trapdoor module** for advanced device operations.

## 🚀 Quick Start - Installation (Recommended)

### For End Users: One-Click Installation

**No terminal commands, no setup, just install and go!**

1. **[📥 Download the installer for your platform](../../releases/latest)**
   - Windows: `.msi` or `.exe` installer
   - macOS: `.dmg` disk image  
   - Linux: `.AppImage` or `.deb` package

2. **Install Node.js** (required for backend server)
   - Download from https://nodejs.org/ (LTS version recommended)
   - Version 18 or higher required

3. **Install Bobby's Workshop**
   - Double-click the installer
   - Follow the installation wizard
   - Launch from desktop icon or applications menu

4. **Launch and Use**
   - Backend starts automatically (no manual steps!)
   - Frontend opens in a native desktop window
   - Connect devices and start working

**[📖 Detailed Installation Guide](INSTALLATION.md)** - Step-by-step instructions for all platforms

---

### For Developers: Manual Setup

If you want to contribute or customize:

```bash
git clone https://github.com/Bboy9090/Bobbys-Workshop-.git
cd Bobbys-Workshop-
npm install
npm run build
npm run server:start  # In separate terminal
```

See [QUICK_START.md](QUICK_START.md) for detailed manual setup instructions.

## 🎨 Industrial Operator UI Theme

The application uses a professional, field-ready aesthetic inspired by operator-grade equipment:

- **Background**: `#0B0F14` - Deep graphite black
- **Panels**: `#141922` - Elevated surfaces
- **Primary Accent**: `#2FD3FF` - Signal cyan
- **Success**: `#2ECC71` - Clean green
- **Warning**: `#F1C40F` - Amber
- **Error**: `#E74C3C` - Critical red
- **Typography**: Outfit (UI), Space Mono (code), Bebas Neue (headers)

Clean, authoritative, and honest about capabilities.

## 🔐 What's New: Bobby's Secret Workshop

**Bobby's Secret Workshop** introduces a comprehensive workflow-based system for device operations:

### ✨ Key Features

#### 🔍 **Advanced Device Detection Arsenal**

Multi-protocol connectivity detection system (`probeDevice.ts`):

- **Unified Device Probing**: Detect devices across ADB, Fastboot, iOS, USB, and WebUSB protocols
- **Capability Analysis**: Automatic detection of device capabilities and available operations
- **Connection Monitoring**: Real-time device connect/disconnect event tracking
- **Enhanced USB Classification**: Mobile-specific USB class detection (MTP, PTP, ADB, Fastboot)
- **Device Mode Recognition**: Identify bootloader, recovery, DFU, and normal operating modes
- **State Correlation**: Track device states across multiple detection methods

#### 🔓 **Modular Workflow System**

JSON-defined workflows for reproducible device operations:

- **Android Workflows**: ADB diagnostics, FRP bypass, Fastboot unlock, partition mapping
- **iOS Workflows**: Device restore, DFU detection, comprehensive diagnostics
- **Mobile Workflows**: **NEW** - Enhanced mobile-first workflows
  - **VesselSanctum**: Deep device diagnostics with health scoring (5-10 min)
  - **Warhammer**: Advanced repair and recovery operations (15-30 min)
  - **Quick Diagnostics**: Fast 2-minute device health check
  - **Battery Health**: Comprehensive battery analysis with cycle count
- **Bypass Workflows**: FRP/MDM bypass with authorization tracking
- **Custom Workflows**: Create and execute custom operation sequences

#### 🔒 **Trapdoor API**

Secure REST endpoints for sensitive operations (admin-only access):

- `POST /api/trapdoor/frp` - Execute FRP bypass workflow
- `POST /api/trapdoor/unlock` - Unlock bootloader workflow
- `POST /api/trapdoor/workflow/execute` - Execute custom workflows
- `GET /api/trapdoor/workflows` - List available workflows
- `GET /api/trapdoor/logs/shadow` - Access encrypted shadow logs

#### 📝 **Shadow Logging System**

Encrypted, append-only audit logs for compliance:

- **AES-256 Encryption** - All sensitive operations encrypted at rest
- **Immutable Audit Trail** - Append-only logs for compliance
- **Anonymous Mode** - Optional operational deniability
- **Automatic Rotation** - 90-day retention for shadow logs

#### 📚 **Core Libraries**

Device management libraries for ADB, Fastboot, and iOS:

- `src/lib/probeDevice.ts` - **NEW** - Advanced multi-protocol device detection
- `src/lib/usbClassDetection.ts` - Enhanced USB device classification with mobile support
- `src/lib/deviceDetection.ts` - System-level device detection utilities
- `core/lib/adb.js` - Android Debug Bridge operations
- `core/lib/fastboot.js` - Fastboot device management
- `core/lib/ios.js` - iOS device operations (libimobiledevice)
- `core/lib/shadow-logger.js` - Encrypted logging infrastructure

#### 🎨 **React Components**

Integrated UI components for workflow execution:

- **DevModePanel** - **NEW** - Advanced device mode detection and workflow launcher
- **Trapdoor Control Panel** - Execute sensitive operations with authorization
- **Workflow Execution Console** - Browse and run workflows
- **Shadow Logs Viewer** - View encrypted audit logs (admin only)

**Complete documentation: [BOBBY_SECRET_WORKSHOP.md](./BOBBY_SECRET_WORKSHOP.md)**

## 🔥 What's New: Pandora Codex Integration

**Bobby's World** has merged with **The-Pandora-Codex** to bring you the most comprehensive device management toolkit available. This integration preserves the complete commit history via subtree merge.

### ✨ New Features from Pandora Codex

#### 🔓 **Pandora's Room (Bobby's Secret Room)**

A powerful "trapdoor" module for advanced device operations:

- **iOS Tools (A5-A11)**: checkra1n, palera1n, lockra1n, OpenBypass
- **iOS Tools (A12+)**: MinaCriss, iRemovalTools, BriqueRamdisk
- **Android Tools**: FRP helpers, Magisk, TWRP, APK utilities
- **System Tools**: EFI unlockers and more
- **Firejail Sandboxing**: Secure, isolated tool execution with:
  - Private home and /tmp directories
  - No network access
  - No root privileges
  - Seccomp filtering
  - All capabilities dropped
- **Tool Verification**: SHA-256 signature verification for security
- **Cross-Language Bridge**: Python/TypeScript integration via JSON API

#### ⚙️ **Enhanced BootForge USB (Rust)**

Advanced low-level device operations:

- **Imaging Engine**: Disk imaging and forensic capabilities
- **Thermal Monitoring**: Real-time temperature tracking
- **Storage Analysis**: SMART data and health monitoring
- **USB Transport Layer**: Enhanced vendor detection and diagnostics
- **Multi-Platform Support**: Android, iOS, MediaTek, Qualcomm, Samsung

#### 📊 **Advanced Diagnostics (TITAN 3 Engine)**

Professional-grade diagnostic capabilities:

- Deep hardware diagnostics
- Thermal imaging and monitoring
- Storage health analysis
- USB transport layer diagnostics
- Deployment job management

## 🚀 Core Features

### iOS DFU Flash Station

- **Real DFU mode detection** via libimobiledevice
- **checkra1n jailbreak support** with live progress tracking
- **palera1n integration** for newer iOS versions
- **WebSocket-based real-time console output**
- **Step-by-step DFU entry instructions**
- Device state detection: Normal / Recovery / DFU modes

**API Endpoints:**

- `GET /api/ios/scan` - Detect connected iOS devices
- `POST /api/ios/dfu/enter` - Automated DFU mode entry
- `WS ws://localhost:3001/ws/flash` - Live jailbreak progress

### MediaTek Flash Panel

- **SP Flash Tool integration** for MediaTek chipsets
- **Scatter file validation** and firmware image management
- **Preloader/VCOM detection** via USB scanning
- **Real-time flash progress** with pause/resume controls
- **Multi-image partition flashing** support

**Supported Chipsets:**

- MT6765 (Helio P35)
- MT6762 (Helio P22)
- MT6739, MT6737, MT6580
- And all other MediaTek platforms via SP Flash Tool

### Security Lock Education Panel

- **FRP (Factory Reset Protection) Detection**
  - Real ADB-based detection via `settings get secure android_id`
  - Confidence scoring: High / Medium / Low / Unknown
  - Device manufacturer and Android version identification
- **MDM (Mobile Device Management) Detection**

  - Enterprise profile identification
  - Organization name extraction
  - Restriction list analysis

- **Legitimate Recovery Resources**
  - Google Account Recovery guides
  - Manufacturer unlock procedures (with proof of purchase)
  - Official support documentation links
  - Enterprise IT contact procedures for MDM

**Educational Content:**

- What FRP is and why it exists (anti-theft protection)
- Legitimate recovery methods (account sign-in, recovery, proof of purchase)
- MDM profile explanation (enterprise device management)
- Legal notices and ethical guidelines

**API Endpoints:**

- `POST /api/frp/detect` - Detect FRP lock status
- `POST /api/mdm/detect` - Detect MDM profiles

### Multi-Brand Flash Dashboard

- **Samsung Odin Protocol** - Official download mode flashing
- **Xiaomi EDL (Emergency Download)** - Qualcomm EDL for bricked devices
- **Universal Fastboot** - Google, OnePlus, Motorola, ASUS support
- **iOS DFU** - checkra1n/palera1n jailbreak
- **MediaTek** - SP Flash Tool scatter-based flashing

### Pandora Codex Control Room

- **Flash Operations Monitor** - Queue management and history
- **Real-Time Performance** - Transfer speed, CPU, memory, USB utilization
- **Automated Testing** - Detection, performance, optimization validation
- **Industry Benchmarks** - USB-IF, JEDEC, Android standards reference
- **Live Hotplug Monitor** - Device connect/disconnect event stream

### Device Diagnostics

- **Real USB Detection** - ADB and Fastboot device enumeration
- **Battery Health** - Capacity percentage and cycle count
- **Storage Diagnostics** - SMART data and health status
- **Thermal Monitoring** - Temperature thresholds and safety checks
- **Sensor Testing** - Accelerometer, gyroscope, proximity, light

## 🔧 Backend API Architecture

### WebSocket Endpoints

```typescript
ws://localhost:3001/ws/flash - Flash progress streaming
ws://localhost:3001/ws/hotplug - Device hotplug events
ws://localhost:3001/ws/correlation - Device correlation tracking
```

### REST API Endpoints

#### iOS Flashing

```
GET  /api/ios/scan - Scan for iOS devices
POST /api/ios/dfu/enter - Enter DFU mode
POST /api/ios/jailbreak - Start jailbreak (checkra1n/palera1n)
```

#### Android Flashing

```
GET  /api/android/devices - List ADB devices
GET  /api/fastboot/devices - List Fastboot devices
POST /api/fastboot/flash - Flash partition
POST /api/odin/flash - Samsung Odin flash
POST /api/edl/flash - Xiaomi EDL flash
```

#### MediaTek

```
GET  /api/mtk/scan - Detect MTK devices
POST /api/mtk/flash - SP Flash Tool operation
GET  /api/mtk/preloader - Check preloader mode
```

#### Security Detection

```
POST /api/frp/detect - Detect FRP lock
POST /api/mdm/detect - Detect MDM profile
GET  /api/security/info - Device security info
```

#### Pandora Codex

```
GET  /api/flash/history - Flash operation history
POST /api/flash/start - Start flash operation
GET  /api/monitor/live - Live performance metrics
POST /api/monitor/start - Start monitoring
POST /api/tests/run - Run automated tests
GET  /api/standards - Industry benchmark standards
GET  /api/hotplug/events - Device hotplug event log
```

## 📦 Installation

### macOS Users - Download the App

Bobby's Workshop is available as a native macOS `.app` bundle:

1. **Download** the latest release:
   - Visit the [Releases](https://github.com/Bboy9090/Bobbys-Workshop-/releases) page
   - Download `Bobbys-Workshop-{version}-macOS-x86_64.dmg`

2. **Install**:
   - Open the DMG file
   - Drag Bobby's Workshop to your Applications folder
   - Launch from Applications

3. **First Launch**:
   - If prompted for security, go to **System Preferences → Security & Privacy**
   - Click **"Open Anyway"**

**System Requirements**: macOS 10.15 (Catalina) or later

**See [MACOS_BUILD_GUIDE.md](./MACOS_BUILD_GUIDE.md) for detailed installation instructions and troubleshooting.**

### Building from Source

See the [Development](#-development) section below for instructions on building from source.

## 📦 Required System Dependencies

### Linux/macOS

```bash
# Android tools
sudo apt install android-tools-adb android-tools-fastboot

# iOS tools
sudo apt install libimobiledevice-utils usbmuxd

# Rust toolchain (for BootForge USB and Trapdoor)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# MediaTek (manual installation)
wget https://spflashtool.com/download/SP_Flash_Tool_v5.2136_Linux.zip

# Optional: Firejail for trapdoor sandboxing
sudo apt install firejail
```

### Windows

```powershell
# Install via Chocolatey
choco install adb fastboot

# Rust toolchain
# Download from: https://rustup.rs/

# iOS support (limited - requires iTunes/3uTools)
# MediaTek - Download SP Flash Tool from official site
```

## 🚨 Legal & Ethical Guidelines

### What This Toolkit DOES

✅ Detect device security states (FRP, MDM, bootloader locks)  
✅ Provide educational resources for legitimate recovery  
✅ Link to official manufacturer unlock procedures  
✅ Support authorized repairs on owned devices  
✅ Teach proper diagnostic and repair techniques  
✅ Provide secure, sandboxed execution of tools (Trapdoor)

### What This Toolkit DOES NOT DO

❌ Bypass FRP on devices you don't own  
❌ Remove MDM from enterprise-managed devices without authorization  
❌ Enable device theft or unauthorized access  
❌ Violate manufacturer warranties or terms of service  
❌ Provide "hacking" or "cracking" tools

### Legal Notice - Trapdoor Module

The **Trapdoor** module provides access to powerful device exploitation and bypass tools. **This software is intended for authorized repair technicians only.** Use only on:

- Devices you personally own
- Devices where you have explicit owner authorization
- Devices in professional repair contexts with proper documentation

Bypassing security features on devices you do not own is **illegal** under:

- Computer Fraud and Abuse Act (CFAA) - United States
- Computer Misuse Act - United Kingdom
- Similar laws in most jurisdictions

**The developers assume no liability for misuse of this software.**

## 🛠️ Development

### How to Run

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. (Optional) Start the backend API server
cd server && npm install && npm start

# 4. Open the browser at http://localhost:5000
```

### How to Test

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:workflow    # Workflow system tests
npm run test:trapdoor    # Trapdoor API tests (requires server running)

# Run linting
npm run lint

# Build for production
npm run build
```

### Start Development Server

```bash
# Install dependencies
npm install

# Start UI
npm run dev

# Build BootForge USB and Trapdoor (requires Rust)
make bootforge:build
make trapdoor:build
```

### Build for Production

```bash
npm run build
npm run preview
```

### Start Backend Services

```bash
# Start WebSocket flash progress server
node server/flash-ws.js

# Start API server
node server/api.js

# Start correlation tracking
node server/correlation-ws.js
```

### Build Trapdoor CLI

```bash
# Using Make
make trapdoor:build

# Or using Cargo directly
cd crates/bootforge-usb
cargo build --release --bin trapdoor_cli

# Run Trapdoor CLI
./crates/bootforge-usb/target/release/trapdoor_cli list
```

## 📚 Documentation

### Core Documentation

- [Bobby's World Complete README](./README_COMPLETE.md)
- [Bobby's Secret Workshop Integration](./BOBBY_SECRET_WORKSHOP.md) - **NEW**
- [iOS DFU Flash Guide](./docs/IOS_DFU_FLASH.md)
- [MediaTek SP Flash Tool Integration](./MEDIATEK_FLASH_GUIDE.md)
- [Security Lock Detection](./SECURITY_LOCK_EDU_GUIDE.md)
- [Pandora Codex Architecture](./PANDORA_CODEX_MASTER.md)
- [WebSocket API Reference](./WEBSOCKET_QUICKSTART.md)
- [Backend API Implementation](./BACKEND_API_IMPLEMENTATION.md)

### Build & Distribution

- [macOS Build and Distribution Guide](./MACOS_BUILD_GUIDE.md) - **NEW** - Complete guide for building .app bundles
- [Tauri Build Guide](./TAURI_BUILD_GUIDE.md) - General Tauri build instructions

### Research & Compliance

- [iOS Tooling Ecosystem Research](./docs/research/) - **NEW** - Comprehensive analysis of iOS tooling patterns
  - [Full Analysis](./docs/research/IOS_TOOLING_ECOSYSTEM_ANALYSIS.md) - Complete research findings
  - [Comparison Matrix](./docs/research/COMPARISON_MATRIX.md) - Quick reference guide
  - [Design Principles](./docs/research/DESIGN_PRINCIPLES.md) - Compliant implementation patterns
  - [Implementation Roadmap](./docs/research/IMPLEMENTATION_ROADMAP.md) - Phased development plan

### Trapdoor / Pandora's Room Documentation

- [Trapdoor CLI Usage Guide](./TRAPDOOR_CLI_USAGE.md) - Command-line interface
- [Trapdoor Implementation Summary](./TRAPDOOR_IMPLEMENTATION_SUMMARY.md) - Technical details
- [Trapdoor Bobby Dev Integration](./TRAPDOOR_BOBBY_DEV_INTEGRATION.md) - Integration architecture
- [BootForge USB README](./crates/bootforge-usb/README.md) - Rust library documentation

## 🔄 Pandora Codex Merge - Change Log

### What Was Merged

**✅ Integrated Features:**

- **Trapdoor Module**: Complete Rust implementation with CLI, sandboxing, and verification
- **BootForge USB Enhancements**: Imaging engine, thermal monitoring, storage analysis
- **Pandora's Room UI**: New dashboard tab for advanced device operations
- **Trapdoor Python Bridge**: Cross-language integration (trapdoor_bridge.py)
- **Enhanced Documentation**: Comprehensive guides for all new features
- **Build System**: Updated Makefile with trapdoor and bootforge targets

**📦 Merged Components:**

- `crates/bootforge-usb/` - Complete Rust crate workspace
  - `libbootforge` - Core library with trapdoor module
  - `bootforge-cli` - Main CLI tool
  - `trapdoor-cli` - Trapdoor-specific CLI
- `src/components/SecretRoom/` - Pandora's Room UI components
- `trapdoor_bridge.py` - Python integration bridge
- `TRAPDOOR_*.md` - Documentation files

### What Was Excluded

**❌ Not Merged:**

- CRM API (incomplete, not needed for repair toolkit)
- Prisma/PostgreSQL setup (unnecessary complexity)
- Electron wrapper (not applicable)
- PyInstaller executable build specs (not applicable)
- Incomplete or placeholder implementations
- Any secrets or credentials (only .env.example files were present)

### History Preservation

All Pandora Codex commit history has been preserved via **git subtree merge**. You can view the complete history:

```bash
# View merged Pandora commits
git log --all --graph --decorate --oneline | grep -A5 "Subtree merge"
```

## 🤝 Contributing

Contributions welcome for:

- Additional device brand support
- Educational repair guides
- Legitimate security unlock procedures
- Bug fixes and performance improvements
- Trapdoor module tool integrations (with proper legal disclaimers)

**We will not accept contributions that:**

- Enable unauthorized device access
- Bypass security without owner consent
- Violate terms of service or warranties
- Support illegal activities

### Branch Protection

This repository uses GitHub Rulesets to enforce code quality standards. All pull requests to `main` must:

- Pass all required status checks (tests, security scans, linting)
- Receive at least one approving review
- Be up-to-date with the base branch

See [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) for complete details on branch protection rules and setup.

### 🧠 Auto-merge Enabled

This repository has auto-merge enabled for pull requests. Once your PR is approved and all checks pass, it will automatically merge without requiring manual intervention. See [docs/AUTO_MERGE.md](./docs/AUTO_MERGE.md) for more details.

## 📄 License

MIT License - See LICENSE file for details

This software is provided "as is" for educational and legitimate repair purposes only.

---

**Bobby's World** - Workshop Toolkit  
_Now with Pandora Codex Integration_

Professional repair diagnostics and educational resources  
**Use responsibly. Repair ethically. Respect the law.**

🔓 **Pandora's Room** - Advanced operations for authorized technicians only
