# BootForge USB Detection Pipeline

## Overview

The BootForge USB detection pipeline transforms raw USB transport evidence into confirmed device records with stable identities and confidence scores.

## Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: USB Transport Enumeration                              │
│                                                                 │
│  probe_usb_transports()                                        │
│    ↓                                                            │
│  [USB Device 1] [USB Device 2] [USB Device 3] ...             │
│    ↓                                                            │
│  extract_transport_evidence(device)                            │
│    ↓                                                            │
│  UsbTransportEvidence { vid, pid, serial, bus, address, ... } │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Platform Classification                                │
│                                                                 │
│  For each transport:                                            │
│    classify_candidate_device(transport)                         │
│      ↓                                                          │
│    Classification {                                            │
│      mode: AndroidAdbConfirmed | IosDfuLikely | ...            │
│      confidence: 0.70 - 0.95                                   │
│      notes: ["USB signature matches..."]                       │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: Tool Evidence Collection                               │
│                                                                 │
│  probe_adb_tool() → ToolEvidence { device_ids: [...] }        │
│  probe_fastboot_tool() → ToolEvidence { device_ids: [...] }    │
│  probe_idevice_id_tool() → ToolEvidence { device_ids: [...] }  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 4: Identity Resolution & Correlation                      │
│                                                                 │
│  resolve_device_identity_with_correlation(                     │
│    transport,                                                  │
│    all_transports,                                             │
│    tool_confirmers                                             │
│  )                                                              │
│    ↓                                                            │
│  Step 4a: Direct Serial Match                                  │
│    IF transport.serial == tool.device_id                        │
│      THEN identity = serial, confidence += 0.15                │
│                                                                 │
│  Step 4b: Single-Candidate Heuristic                           │
│    IF count(platform_candidates) == 1                          │
│       AND count(tool.device_ids) == 1                          │
│      THEN identity = tool.device_ids[0], confidence = 0.90     │
│                                                                 │
│  Returns: (Classification, matched_tool_ids[])                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stage 5: Confirmed Device Record Assembly                       │
│                                                                 │
│  ConfirmedDeviceRecord {                                        │
│    device_uid: "usb:18d1:4ee7:bus1:addr3" | serial            │
│    platform_hint: "android" | "ios" | "unknown"                 │
│    mode: "android_adb_confirmed" | "ios_dfu_likely" | ...      │
│    confidence: 0.85                                            │
│    evidence: {                                                  │
│      transport: UsbTransportEvidence { ... }                   │
│      tools: { adb: {...}, fastboot: {...}, ... }                │
│    }                                                            │
│    notes: ["Correlated: adb device id matches USB serial"]      │
│    matched_tool_ids: ["ABC123"]                                │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Stage Breakdown

### Stage 1: USB Transport Enumeration

**Function:** `probe_usb_transports()`

**Process:**
1. Initialize USB context (libusb)
2. Enumerate all USB devices on all buses
3. For each device:
   - Extract device descriptor (VID/PID)
   - Read manufacturer/product/serial strings (if available)
   - Collect interface descriptors (class/subclass/protocol)
   - Build `UsbTransportEvidence`

**Output:** `Vec<UsbTransportEvidence>`

**Key Properties:**
- **Stateless** - Each scan is independent
- **Non-blocking** - Fast enumeration (< 100ms typically)
- **Platform-agnostic** - Works on Windows/macOS/Linux

### Stage 2: Platform Classification

**Function:** `classify_candidate_device(transport: &UsbTransportEvidence)`

**Process:**
1. Check VID for known vendors:
   - `05ac` → Apple (iOS)
   - `18d1`, `04e8`, `2717`, ... → Android vendors
2. Analyze PID patterns:
   - Apple: `1227` (DFU), `1281` (Recovery), `12a8`/`12ab` (Normal)
   - Android: Vendor interface (class 0xff) suggests ADB/Fastboot
3. Check interface hints:
   - Vendor interface (0xff) → Likely Android
   - MTP/PTP → Normal mode
4. Assign confidence:
   - USB evidence only: 0.70 - 0.85
   - Known VID/PID: 0.80 - 0.90
   - Unknown: 0.50 - 0.60

**Output:** `Classification { mode, confidence, notes }`

**Classification Modes:**
- `AndroidAdbConfirmed` - Android device in ADB mode
- `AndroidFastbootConfirmed` - Android device in Fastboot mode
- `AndroidRecoveryAdbConfirmed` - Android device in Recovery with ADB
- `IosNormalLikely` - iOS device in normal mode (likely)
- `IosDfuLikely` - iOS device in DFU mode (likely)
- `IosRecoveryLikely` - iOS device in Recovery mode (likely)
- `UnknownUsb` - Unrecognized USB device

### Stage 3: Tool Evidence Collection

**Function:** `probe_*_tool()` (adb, fastboot, idevice_id)

**Process:**
1. Check if tool is available (`which adb`)
2. Execute tool command:
   - `adb devices -l`
   - `fastboot devices`
   - `idevice_id -l`
3. Parse output for device IDs:
   - ADB: Extract serial from `SERIAL\tdevice` lines
   - Fastboot: Extract serial from `SERIAL fastboot` lines
   - idevice_id: Extract UDID from lines
4. Build `ToolEvidence`:
   - `present: bool` - Tool installed?
   - `seen: bool` - Tool sees devices?
   - `raw: String` - Full stdout/stderr
   - `device_ids: Vec<String>` - Parsed device IDs

**Output:** `ToolEvidence { present, seen, raw, device_ids }`

**Tool Evidence States:**
- **Missing** - Tool not installed (`present: false`)
- **Present, No Devices** - Tool installed but no devices (`present: true, seen: false`)
- **Confirmed** - Tool installed and sees devices (`present: true, seen: true, device_ids: [...]`)

### Stage 4: Identity Resolution & Correlation

**Function:** `resolve_device_identity_with_correlation(...)`

**Process:**

#### Step 4a: Direct Serial Match
```rust
IF transport.serial.is_some()
   AND tool.device_ids.contains(transport.serial)
  THEN
    matched_tool_ids.push(transport.serial)
    confidence += 0.15
    note = "Correlated: {tool} device id matches USB serial"
```

#### Step 4b: Single-Candidate Heuristic
```rust
IF count(platform_candidates) == 1
   AND count(tool.device_ids) == 1
  THEN
    matched_tool_ids.push(tool.device_ids[0])
    confidence = 0.90
    note = "Correlated: single {platform} USB device + single {tool} device id (heuristic)"
```

**Heuristic Rules:**
- **Android + ADB:** Single Android candidate + single ADB device → Match
- **Android + Fastboot:** Single Android candidate + single Fastboot device → Match
- **iOS + idevice_id:** Single Apple candidate + single UDID → Match

**Output:** `(Classification, Vec<String>)` - Updated classification + matched tool IDs

### Stage 5: Confirmed Device Record Assembly

**Function:** `scan()` (main entry point)

**Process:**
1. Run Stages 1-4
2. For each transport:
   - Build `device_uid`:
     - Prefer: `transport.serial` (if available)
     - Fallback: `format!("usb:{}:{}:bus{}:addr{}", vid, pid, bus, address)`
   - Determine `platform_hint` from classification mode
   - Bundle evidence: `Evidence { transport, tools }`
   - Create `ConfirmedDeviceRecord`

**Output:** `Vec<ConfirmedDeviceRecord>`

## Error Handling

### Transport Enumeration Errors
- **USB context init fails** → Return error, no devices
- **Device descriptor read fails** → Skip device, continue
- **String read fails** → Continue with `None` for that field

### Classification Errors
- **Unknown VID/PID** → Classify as `UnknownUsb` with low confidence
- **Missing interface info** → Use VID/PID patterns only

### Tool Evidence Errors
- **Tool not found** → `ToolEvidence::missing()`
- **Tool execution fails** → `ToolEvidence { present: true, seen: false, raw: "error: ..." }`
- **Parse errors** → Empty `device_ids`, log warning

### Correlation Errors
- **No serial available** → Skip direct match, try heuristic
- **Heuristic ambiguity** → Skip correlation, use USB-only confidence

## Performance Characteristics

- **Stage 1 (USB Enumeration):** ~50-200ms (depends on device count)
- **Stage 2 (Classification):** < 1ms per device (in-memory rules)
- **Stage 3 (Tool Evidence):** ~100-500ms per tool (external command execution)
- **Stage 4 (Correlation):** < 1ms per device (in-memory matching)
- **Stage 5 (Assembly):** < 1ms per device (data structure creation)

**Total Pipeline Time:** ~200-1000ms (typical, depends on tool availability and device count)

## Thread Safety

- **Current Implementation:** Single-threaded, stateless
- **Future:** Thread-safe for concurrent scans (read-only operations)
- **Locks:** Not yet implemented (see GLOSSARY.md for intended semantics)

## Reconnection Handling

When a device reconnects:
- **New Transport** - Different bus/address → New `UsbTransportEvidence`
- **Identity Resolution** - If serial matches, same `device_uid` → Same logical device
- **Transport UID Fallback** - If no serial, new `device_uid` → Treated as new device

**Best Practice:** Always prefer serial-based identity over transport UID for stable device tracking.
