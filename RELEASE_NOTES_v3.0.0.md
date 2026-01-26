# Bobby's Workshop v3.0.0 Release Notes

## 🚀 Major Release - Version 3.0.0

This release represents a significant milestone with major improvements to the USB detection system, architecture hardening, and overall code quality.

## ✨ New Features & Improvements

### BootForge USB Library Hardening
- **Complete naming refactor** - All functions and types renamed for clarity and safety
- **Enhanced documentation** - Comprehensive glossary and detection pipeline documentation
- **Improved architecture** - Clear separation between USB transports, device candidates, and confirmed devices
- **Better identity resolution** - Stable device identification across reconnections
- **14 unit tests** - Comprehensive test coverage for edge cases

### UI/UX Enhancements
- **Reduced error noise** - App runs quietly in offline mode
- **Better error handling** - Graceful degradation when backend services are unavailable
- **Improved user experience** - No more pop-up spam when backend is disconnected

### Technical Improvements
- **Tauri v2 migration** - Fully migrated to Tauri v2 API
- **Code quality** - Improved error boundaries and initialization flow
- **Build system** - Streamlined installer build process

## 📦 Installation

### Windows

Two installer options are available:

1. **NSIS Installer** (Recommended) - `Bobbys Workshop_3.0.0_x64-setup.exe`
   - One-click installation
   - Desktop and Start Menu shortcuts
   - Customizable installation directory

2. **MSI Installer** - `Bobbys Workshop_3.0.0_x64_en-US.msi`
   - Enterprise-friendly MSI package
   - Silent installation support

### Standalone Executable

- `bobbys-workshop.exe` - Portable executable (no installation required)

## 🔧 Technical Details

- **Framework**: Tauri v2 (Rust + WebView)
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js server bundled with installer
- **USB Detection**: BootForge USB library v0.2.0 (hardened)
- **Platform**: Windows x64

## 📝 Changes Since v1.0.0

### BootForge USB Library
- Renamed `scan_usb_devices()` → `probe_usb_transports()`
- Renamed `classify_device()` → `classify_candidate_device()`
- Renamed `classify_with_correlation()` → `resolve_device_identity_with_correlation()`
- Renamed `UsbEvidence` → `UsbTransportEvidence`
- Renamed `DeviceRecord` → `ConfirmedDeviceRecord`
- Added comprehensive documentation in `libs/bootforgeusb/docs/`
- Added 14 unit tests covering edge cases

### Application
- Improved offline mode behavior
- Reduced backend error noise
- Better error boundaries
- Enhanced initialization flow

## 🐛 Known Issues

- Some Rust warnings in build output (non-blocking, cosmetic)
- CSS keyframes warnings during build (cosmetic only)

## 📚 Documentation

- **BootForge USB Glossary**: `libs/bootforgeusb/docs/GLOSSARY.md`
- **Detection Pipeline**: `libs/bootforgeusb/docs/DETECTION_PIPELINE.md`
- **Naming Refactor Summary**: `libs/bootforgeusb/docs/NAMING_REFACTOR_SUMMARY.md`
- **Development Guidelines**: `AGENTS.md`

## 🔄 Migration from v1.0.0

No breaking changes for end users. The internal API changes are backwards compatible through type aliases.

## 🙏 Credits

Built with:
- Tauri v2
- React
- TypeScript
- Rust
- Node.js

---

**Download**: See attached installer files in this release.
