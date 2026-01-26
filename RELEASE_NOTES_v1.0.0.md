# Bobby's Workshop v1.0.0 Release Notes

## 🎉 Initial Stable Release

This is the first stable release of Bobby's Workshop - a professional device flashing and diagnostics tool.

## ✨ Features

- **Modern UI/UX** - Bronx apartment workshop aesthetic with street + neon + worn design
- **Device Detection** - Automatic USB device discovery with BootForge USB library
- **Device Flashing** - Support for Android device flashing operations
- **iOS Operations** - iOS device management and diagnostics
- **Secret Rooms** - Advanced bootloader unlock and audit logging
- **Real-time Monitoring** - Live device status and operation tracking
- **Offline Mode** - Graceful operation when backend services are unavailable

## 📦 Installation

### Windows

Two installer options are available:

1. **NSIS Installer** (Recommended) - `Bobbys Workshop_1.0.0_x64-setup.exe`
   - One-click installation
   - Desktop and Start Menu shortcuts
   - Customizable installation directory

2. **MSI Installer** - `Bobbys Workshop_1.0.0_x64_en-US.msi`
   - Enterprise-friendly MSI package
   - Silent installation support

### Standalone Executable

- `bobbys-workshop.exe` - Portable executable (no installation required)

## 🔧 Technical Details

- **Framework**: Tauri v2 (Rust + WebView)
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js server bundled with installer
- **USB Detection**: BootForge USB library (Rust)
- **Platform**: Windows x64

## 📝 Changes Since Last Version

- Complete UI/UX overhaul with new design system
- BootForge USB library hardening (naming + architecture improvements)
- Tauri v2 migration
- Improved error handling and offline mode support
- Reduced backend error noise for better user experience

## 🐛 Known Issues

- Some Rust warnings in build output (non-blocking)
- CSS keyframes warnings during build (cosmetic only)

## 📚 Documentation

- See `libs/bootforgeusb/docs/` for USB detection pipeline documentation
- See `AGENTS.md` for development guidelines

## 🙏 Credits

Built with:
- Tauri
- React
- TypeScript
- Rust
- Node.js

---

**Download**: See attached installer files in this release.
