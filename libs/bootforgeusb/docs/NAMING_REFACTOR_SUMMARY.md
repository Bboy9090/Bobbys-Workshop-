# BootForge USB Naming & Architecture Hardening - Summary

## Overview

This refactoring improves code clarity and safety by renaming functions, types, and state to reflect the true semantics of the USB detection pipeline. **No functional changes** were made - this is purely a naming and documentation improvement.

## Changes Made

### 1. Documentation Created

- **`docs/GLOSSARY.md`** - Comprehensive glossary defining:
  - Candidate, Confirmed Device, Session, Transport, Lock Scope
  - Identity Resolution concepts
  - Operation Safety semantics
  - Event and State naming conventions

- **`docs/DETECTION_PIPELINE.md`** - Detailed pipeline documentation with:
  - 5-stage pipeline diagram
  - Stage-by-stage breakdown
  - Error handling strategies
  - Performance characteristics
  - Thread safety notes

### 2. Type Renaming

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `UsbEvidence` | `UsbTransportEvidence` | Raw USB layer data (physical connection) |
| `DeviceRecord` | `ConfirmedDeviceRecord` | Device with classification + correlation |
| (Legacy aliases maintained for backwards compatibility) | | |

### 3. Function Renaming

#### USB Scan Functions
- `scan_usb_devices()` → `probe_usb_transports()`
- `extract_usb_evidence()` → `extract_transport_evidence()`
- `get_interface_info()` → `extract_interface_descriptors()`

#### Classification Functions
- `classify_device()` → `classify_candidate_device()`
- `classify_with_correlation()` → `resolve_device_identity_with_correlation()`
- `try_single_candidate_correlation()` → `attempt_single_candidate_identity_resolution()`

#### Tool Functions
- `check_adb()` → `probe_adb_tool()`
- `check_fastboot()` → `probe_fastboot_tool()`
- `check_idevice_id()` → `probe_idevice_id_tool()`
- `confirm_device()` → `correlate_device_identity()`

#### Identity Resolution
- Added `resolve_device_identity()` helper function

### 4. Documentation Comments Added

All renamed functions now include:
- Purpose documentation
- Pipeline stage annotations
- Parameter descriptions
- Return value explanations

### 5. Unit Tests Added

**14 total tests** (9 existing + 5 new):

#### New Tests:
1. `test_classify_unknown_vid` - Unknown VID/PID classification
2. `test_classify_apple_recovery` - Apple recovery mode detection
3. `test_identity_resolution_no_serial` - Heuristic correlation without serial
4. `test_identity_resolution_direct_serial_match` - Direct serial correlation
5. `test_transport_evidence_structure` - Transport evidence validation

#### Enhanced Tests:
- `test_parse_adb_ids` - ADB output parsing
- `test_parse_adb_ids_with_recovery` - Recovery mode parsing
- `test_parse_fastboot_ids` - Fastboot output parsing
- `test_parse_idevice_ids` - iOS UDID parsing
- `test_correlate_device_identity_no_match` - No correlation case
- `test_correlate_device_identity_adb_match` - ADB correlation

## Pipeline Stages (Clarified)

1. **Stage 1: Probe USB Transports** - `probe_usb_transports()`
2. **Stage 2: Classify Candidates** - `classify_candidate_device()`
3. **Stage 3: Probe Tools** - `probe_*_tool()` functions
4. **Stage 4: Resolve Identities** - `resolve_device_identity_with_correlation()`
5. **Stage 5: Assemble Records** - `scan()` main function

## Key Concepts Clarified

### Transport vs Device
- **Transport** = Physical USB connection (bus + address)
- **Device** = Logical device with stable identity (serial/UID)
- Multiple transports can represent the same device (reconnections)

### Candidate vs Confirmed
- **Candidate** = USB transport detected, not yet classified
- **Confirmed** = Classified + correlated + scored device record

### Identity Resolution
- **Direct Serial Match** - USB serial == tool device ID (highest confidence)
- **Single-Candidate Heuristic** - 1 transport + 1 tool ID → assume match
- **Transport UID Fallback** - `usb:VID:PID:bus:addr` (unstable across reconnects)

## Backwards Compatibility

- Legacy type aliases maintained:
  - `pub type UsbEvidence = UsbTransportEvidence;`
  - `pub type DeviceRecord = ConfirmedDeviceRecord;`
- Public API unchanged (all changes are internal or additive)

## Test Results

```
running 14 tests
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured
```

All tests pass, build succeeds.

## Acceptance Criteria Met

✅ **Detection still works as-is** - No functional changes  
✅ **Locking rules obvious from names** - Clear function names (`correlate_device_identity`, `resolve_device_identity`)  
✅ **Tests/build pass** - 14/14 tests pass, clean build  
✅ **No bypass/unlock content** - Only device detection + safe operations  
✅ **Clear glossary** - Comprehensive documentation in `docs/GLOSSARY.md`  
✅ **Pipeline documented** - Detailed pipeline in `docs/DETECTION_PIPELINE.md`  
✅ **Edge case tests** - 5 new tests covering identity resolution edge cases

## Files Modified

- `src/lib.rs` - Main entry point, identity resolution helper
- `src/model.rs` - Type renaming, documentation
- `src/usb_scan.rs` - Function renaming, tests
- `src/classify.rs` - Function renaming, tests, documentation
- `src/tools/confirmers.rs` - Function renaming, tests, documentation
- `docs/GLOSSARY.md` - New glossary document
- `docs/DETECTION_PIPELINE.md` - New pipeline documentation
- `docs/NAMING_REFACTOR_SUMMARY.md` - This summary

## Next Steps (Future)

- Implement operation locks (per-device write locks, global locks)
- Add reconnection handling with stable identity tracking
- Thread-safe concurrent scans
- WebSocket event integration for real-time device updates
