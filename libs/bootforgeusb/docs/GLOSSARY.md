# BootForge USB Glossary

## Core Concepts

### Candidate
A **candidate** is a USB device detected during enumeration that has not yet been confirmed as a known mobile device type. Candidates are raw USB transport evidence (VID/PID, descriptors) without platform classification or tool correlation.

**Example:** A USB device with VID `18d1` (Google) and PID `4ee7` is a candidate until it's classified and potentially correlated with `adb devices` output.

### Confirmed Device
A **confirmed device** is a candidate that has been:
1. **Classified** - Platform and mode determined (Android/iOS, ADB/Fastboot/DFU)
2. **Correlated** (optional) - Matched to tool output (adb/fastboot/idevice_id) by serial/ID
3. **Scored** - Confidence level assigned (0.0 - 1.0)

A confirmed device is represented by a `ConfirmedDeviceRecord` with full evidence bundle.

### Session
A **session** is a single scan operation that:
- Enumerates all USB transports
- Probes tool outputs (adb/fastboot/idevice_id)
- Correlates candidates to tool IDs
- Produces a list of confirmed devices

Sessions are stateless - each `scan()` call is independent.

### Transport
A **transport** is the physical USB connection layer:
- USB bus number + address
- VID/PID pair
- USB descriptors (manufacturer, product, serial)
- Interface hints (class, subclass, protocol)

**Transport evidence** (`UsbTransportEvidence`) is the raw USB layer data before platform classification.

**Note:** "Transport" emphasizes the physical connection, not the logical device identity. Multiple transports can represent the same logical device (e.g., device reconnects on different bus/address).

### Lock Scope
**Lock scope** defines the granularity of operation locks:

- **Per-Device Lock** - Only one write operation per device (e.g., flashing partition A blocks flashing partition B on same device)
- **Global Lock** - Only one write operation system-wide (e.g., flashing any device blocks all other flash operations)
- **Read Lock** - Multiple concurrent reads allowed (e.g., device info queries)
- **Write Lock** - Exclusive access required (e.g., flashing, unlocking)

**Current Implementation:** BootForge USB v0.2 does not implement locks yet. This glossary defines the intended semantics for future implementation.

## Identity Resolution

### Device Identity
A **device identity** is a stable identifier that persists across:
- USB reconnections (different bus/address)
- Mode changes (ADB → Fastboot)
- Tool availability changes

**Identity Sources:**
1. **USB Serial** - Most reliable, if available
2. **Tool ID** - adb/fastboot serial or idevice_id UDID
3. **Transport UID** - Fallback: `usb:VID:PID:bus:addr` (unstable across reconnects)

### Identity Resolution Pipeline

```
USB Transport → Candidate → Classification → Correlation → Confirmed Device
     ↓              ↓              ↓              ↓              ↓
  VID/PID      Raw evidence   Platform/Mode   Tool match    Full record
  Bus/Addr     No identity    Confidence      Identity      Stable ID
```

1. **Probe USB Transports** - Enumerate all USB devices
2. **Extract Transport Evidence** - Collect VID/PID, descriptors, interfaces
3. **Classify Candidate** - Determine platform (Android/iOS) and mode (ADB/Fastboot/DFU)
4. **Resolve Identity** - Match USB serial to tool IDs (correlation)
5. **Produce Confirmed Device** - Bundle evidence + identity + confidence

### Correlation Methods

#### Direct Serial Match (Highest Confidence)
```
IF usb.serial == tool.device_id
  THEN identity = usb.serial
       confidence += 0.15
```

#### Single-Candidate Heuristic
```
IF count(likely_platform_candidates) == 1
   AND count(tool.device_ids) == 1
  THEN identity = tool.device_ids[0]
       confidence = 0.90
```

#### iOS UDID Correlation
```
IF count(apple_transports) == 1
   AND count(idevice_id.udids) == 1
  THEN identity = idevice_id.udids[0]
       confidence = 0.95
```

## Operation Safety

### Read Operations
- **Safe to parallelize** - Multiple queries can run simultaneously
- **No locks required** - Device info, status checks, list operations
- **Examples:** `adb devices`, `fastboot devices`, device info queries

### Write Operations
- **Require exclusive access** - Only one write per device
- **Lock acquisition** - Must acquire device write lock before operation
- **Lock release** - Must release lock after operation completes (success or failure)
- **Examples:** Flashing partitions, unlocking bootloader, erasing data

### Lock Semantics (Future)
```rust
// Per-device write lock
acquire_device_write_lock(device_identity: &str) -> LockHandle
release_device_write_lock(handle: LockHandle)

// Global write lock (if needed)
acquire_global_write_lock() -> LockHandle
release_global_write_lock(handle: LockHandle)
```

## Event Names

### Transport Events
- `TransportAttached` - New USB device detected
- `TransportDetached` - USB device disconnected
- `TransportReconnected` - Same device on different bus/address

### Device Events
- `DeviceConfirmed` - Candidate classified and correlated
- `DeviceIdentityResolved` - Stable identity assigned
- `DeviceModeChanged` - Mode transition (e.g., ADB → Fastboot)
- `DeviceCorrelationUpdated` - Tool match added/removed

### Operation Events
- `OperationLockAcquired` - Write lock obtained
- `OperationLockReleased` - Write lock released
- `OperationLockTimeout` - Lock acquisition failed (timeout)

## State Names

### Transport States
- `TransportProbing` - USB enumeration in progress
- `TransportEvidenceCollected` - Raw USB data extracted
- `TransportClassified` - Platform/mode determined

### Device States
- `DeviceCandidate` - USB transport detected, not yet classified
- `DeviceClassified` - Platform/mode known, no identity yet
- `DeviceCorrelated` - Identity resolved via tool match
- `DeviceConfirmed` - Full record with evidence + identity + confidence
- `DeviceDisconnected` - Transport removed, device record invalidated

## Function Naming Conventions

### Probe Functions
- `probe_*` - Enumerate/discover (e.g., `probe_usb_transports`, `probe_adb_tool`)
- Returns: Raw evidence or tool output

### Extract Functions
- `extract_*` - Parse/transform raw data (e.g., `extract_transport_evidence`)
- Returns: Structured evidence

### Classify Functions
- `classify_*` - Determine platform/mode (e.g., `classify_candidate_device`)
- Returns: Classification with confidence

### Resolve Functions
- `resolve_*` - Match identity (e.g., `resolve_device_identity`)
- Returns: Identity + correlation evidence

### Correlate Functions
- `correlate_*` - Match transport to tool output (e.g., `correlate_device_identity`)
- Returns: Matched tool IDs

### Lock Functions (Future)
- `acquire_*_lock` - Obtain exclusive access
- `release_*_lock` - Release exclusive access
- `check_*_lock` - Query lock status (non-blocking)
