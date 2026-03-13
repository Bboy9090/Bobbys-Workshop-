# PHOENIX FORGE

**Rise from the Ashes. Every Device Reborn.**

Phoenix Forge is a complete device repair and management platform for professional repair shops. This repository contains the full application stack: React frontend, Node.js/Python backends, Rust hardware layer (BootForge USB), and desktop packaging via Electron/Tauri. Everything you need to diagnose, flash, and repair mobile devices in one unified system.

[![CI/CD](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/ci-cd.yml)
[![Build](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/build.yml/badge.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/build.yml)
[![Tests](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/test.yml/badge.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)](https://github.com/Bboy9090/Bobbys-Workshop-/releases)

> **Note**: This is a complete application repository, not an umbrella or meta-repo. For specialized components like BootForge USB hardware layer, see related repositories.

---

## Features

### Device Management
- **Real-time Detection** - Automatic USB device enumeration and identification
- **Multi-platform Support** - Android, iOS, and various OEM devices
- **Batch Operations** - Handle multiple devices simultaneously

### Flash Forge
- **Universal Flashing** - Support for fastboot, Odin, and custom protocols
- **Firmware Management** - Integrated firmware search and verification
- **Progress Monitoring** - Real-time flash progress with WebSocket updates

### Phoenix Core
- **Decision Engine** - Intelligent device state analysis and repair routing
- **State Memory** - Track device history and previous operations
- **Authority System** - Role-based access for sensitive operations

### Codex Modules
- **Sonic Codex** - Audio and signal intelligence analysis
- **Ghost Codex** - Metadata hygiene and identity shielding
- **Pandora Codex** - Hardware state research and routing

### The Forge (Secret Rooms)
- **Root Vault** - Secure root operations
- **Bypass Laboratory** - Advanced bypass techniques
- **Jailbreak Sanctum** - iOS jailbreak workflows
- **Shadow Archive** - Secure data management

---

## Screenshots

![Phoenix Forge Interface](docs/images/screenshots/main-interface.png)
*Main device management interface with real-time device detection*

![Flash Progress](docs/images/screenshots/flash-progress.png)
*Real-time flashing progress with detailed status updates*

> **Note**: Screenshots coming soon. Check the [docs/images/screenshots](docs/images/screenshots) folder for updates.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PHOENIX FORGE                      │
│              (React 19 + TypeScript)                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                 Phoenix Core                        │
│           (Decision Engine + State Memory)          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              Backend Services                       │
│     Node.js/Express + Python/FastAPI                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│          libbootforge (Bridge Layer)                │
│         Cross-platform Hardware Interface           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│           BootForge USB (Rust)                      │
│     Low-level USB Device Communication              │
└─────────────────────────────────────────────────────┘
```

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

**Phoenix Forge v5.0.0** - *Rise from the Ashes*
