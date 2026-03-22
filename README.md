# BOBBY'S WORKSHOP (Phoenix Forge)

**Rise from the Ashes. Every Device Reborn.**

Bobby's Workshop is professional device repair software for mobile repair shops. This repository contains the complete working application - not an umbrella platform, not a collection of tools, but the actual repair software you install and run.

[![CI/CD](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/ci-cd.yml)
[![Build](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/build.yml/badge.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/build.yml)
[![Tests](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/test.yml/badge.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/releases)

---

## What Runs From This Repository

**Bobby's Workshop** is the complete repair application. When you clone and run this repository, you get:

- ✅ The full desktop application (React UI + backend services)
- ✅ Device detection and management
- ✅ Firmware flashing tools integration
- ✅ Phoenix Core decision engine (embedded)
- ✅ BootForge USB layer (embedded as a library)

**What this is NOT:**
- ❌ An umbrella platform containing separate projects
- ❌ A collection of links to other repositories
- ❌ A meta-repo or documentation hub

This repository **IS the software**. Everything else (Phoenix Core, BootForge) are either embedded components or separate libraries that we integrate.

---

## Features

### Device Management
- **Real-time Detection** - Automatic USB device enumeration and identification
- **Multi-Device Support** - Android, iOS, and various OEM devices
- **Batch Operations** - Handle multiple devices simultaneously
- **Device History** - Track device state and previous repair operations

### Firmware Flashing
- **Universal Protocols** - Support for Fastboot, Odin, and custom flashing tools
- **Firmware Verification** - Integrated firmware search and integrity checks
- **Progress Monitoring** - Real-time flash progress with detailed status updates
- **Safety Checks** - Pre-flash validation to prevent device bricking

### Intelligent Workflows
- **Decision Engine** - Smart device state analysis and repair routing
- **Workflow Automation** - Step-by-step guided repair processes
- **Authority System** - Role-based access for sensitive operations
- **Audit Trail** - Complete logging of all operations for compliance

---

## Screenshots

![Phoenix Forge Interface](docs/images/screenshots/main-interface.png)
*Main device management interface with real-time device detection*

![Flash Progress](docs/images/screenshots/flash-progress.png)
*Real-time flashing progress with detailed status updates*

> **Note**: Screenshots coming soon. Check the [docs/images/screenshots](docs/images/screenshots) folder for updates.

---

## Platform Diagram

Bobby's Workshop is the complete repair software that integrates all components:

```
┌──────────────────────────────────────────────────┐
│           BOBBY'S WORKSHOP                       │
│        (The Complete Repair Software)            │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │     Phoenix Forge UI                       │ │
│  │  (React 19 + Tailwind CSS v4)              │ │
│  └──────────────┬─────────────────────────────┘ │
│                 │                                │
│                 ▼                                │
│  ┌────────────────────────────────────────────┐ │
│  │     Phoenix Core                           │ │
│  │  (Decision Engine + State Memory)          │ │
│  │  - Device routing                          │ │
│  │  - Workflow orchestration                  │ │
│  │  - Authorization system                    │ │
│  └──────────────┬─────────────────────────────┘ │
│                 │                                │
│                 ▼                                │
│  ┌────────────────────────────────────────────┐ │
│  │     Backend Services                       │ │
│  │  - Node.js/Express API                     │ │
│  │  - Python/FastAPI (Secret Rooms)           │ │
│  │  - WebSocket real-time updates             │ │
│  └──────────────┬─────────────────────────────┘ │
│                 │                                │
│                 ▼                                │
│  ┌────────────────────────────────────────────┐ │
│  │     BootForge USB (Rust Library)           │ │
│  │  - Device detection                        │ │
│  │  - USB communication                       │ │
│  │  - Platform classification                 │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
└──────────────────────────────────────────────────┘
                       ↓
        [External Hardware/Tools]
         - ADB (Android Debug Bridge)
         - Fastboot (Android)
         - libimobiledevice (iOS)
         - Odin/Heimdall (Samsung)

```

**Component Relationship:**

- **Bobby's Workshop** = The complete repair software (this repository)
- **Phoenix Core** = Embedded decision engine within Bobby's Workshop
- **BootForge** = Embedded Rust library for USB device detection

**What You Install:** Bobby's Workshop desktop application
**What You Run:** The complete repair software with all components integrated
**External Dependencies:** ADB, Fastboot, and other platform-specific tools (installed separately)

---

## Technology Stack

### Frontend
- **React 19** - Modern React with hooks and concurrent features
- **TypeScript** - Full type safety throughout
- **Tailwind CSS v4** - Utility-first styling with custom design tokens
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Smooth animations and transitions

### Backend
- **Node.js / Express** - API server with WebSocket support
- **Python / FastAPI** - Specialized backend services
- **Rust** - BootForge USB hardware layer

### Desktop
- **Electron** - Cross-platform desktop application
- **Tauri** - Lightweight Rust-based alternative

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Rust 1.75+ (for BootForge USB)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/phoenix-forge.git
cd phoenix-forge

# Install dependencies
npm install

# Install server dependencies
npm run server:install

# Start development server
npm run dev
```

### Production Build

```bash
# Build the application
npm run build

# Build with Electron
npm run electron:build

# Build with Tauri
npm run tauri:build
```

---

## Design Philosophy

Phoenix Forge follows these core principles:

1. **Professional Up Front** - Clean, intuitive interface for daily operations
2. **Quiet Depth Underneath** - Advanced features accessible when needed
3. **No Automation Without Intent** - Every action requires explicit confirmation
4. **Full Traceability** - Complete audit trail of all operations
5. **Analysis Before Action** - Thorough device assessment before any operation

---

## Color System

Phoenix Forge uses a carefully crafted color palette:

| Color | Hex | Usage |
|-------|-----|-------|
| Phoenix Fire | `#FF4D00` | Primary actions, energy |
| Phoenix Gold | `#FFD700` | Success, legendary elements |
| Astral Violet | `#7C3AED` | Secondary accent, cosmic |
| Cyber Cyan | `#06B6D4` | Info, data flow |
| Forge Deep | `#0A0A12` | Primary background |
| Forge Surface | `#14142B` | Cards, elevated surfaces |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run server:start` | Start backend server |
| `npm run electron:dev` | Start Electron development |
| `npm run tauri:dev` | Start Tauri development |

---

## Releases

### Latest Release: v5.0.0 - Phoenix Rising

**What's New:**
- Complete UI overhaul with React 19 and Tailwind CSS v4
- Real-time device detection and monitoring
- Integrated firmware management system
- Multi-platform desktop support (Electron + Tauri)
- Enhanced security with role-based access control

**Download:**
- [Windows Installer](https://github.com/Bboy9090/Bobbys-Workshop-/releases/latest) (Coming Soon)
- [macOS DMG](https://github.com/Bboy9090/Bobbys-Workshop-/releases/latest) (Coming Soon)
- [Linux AppImage](https://github.com/Bboy9090/Bobbys-Workshop-/releases/latest) (Coming Soon)

For all releases and changelogs, visit the [Releases page](https://github.com/Bboy9090/Bobbys-Workshop-/releases).

---

## Contributing

Phoenix Forge follows strict contribution guidelines:

1. **Audit First** - Understand existing code before changes
2. **Verify Claims** - Test thoroughly before submitting
3. **Small PRs** - One focused change per PR
4. **No Placeholders** - No mocks in production paths
5. **Document Changes** - Clear commit messages and PR descriptions

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Summary

**Bobby's Workshop** is the complete device repair software, not an umbrella platform.

- This repository = The working repair application
- Phoenix Core = Embedded decision engine
- BootForge = Embedded USB library

Clone, build, and run this repository to get the full repair software with all components integrated.

**Bobby's Workshop v5.0.0** - *Rise from the Ashes*
