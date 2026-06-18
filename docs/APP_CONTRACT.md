# Application Contract

## Bobby's Workshop - UX Contract & API Boundaries

**Purpose:** Define the contract between the UI layer and underlying systems (PhoenixCore, libbootforge, platform tools) to ensure safe, predictable, and maintainable interactions.

**Last Updated:** 2026-05-23

---

## Contract Principles

### 1. Safety First

- **No Silent Failures**: All operations return explicit success or error
- **Dry-Run Default**: Destructive operations default to simulation mode
- **Explicit Confirmation**: Sensitive operations require user confirmation
- **Audit Everything**: All operations logged with context and outcome

### 2. Predictable Behavior

- **Consistent Envelopes**: All API responses use standard envelope format
- **No Side Effects**: Read operations never modify state
- **Idempotent Operations**: Same input produces same output
- **Clear Error Messages**: Errors provide actionable guidance

### 3. Graceful Degradation

- **Mock-Safe Fallback**: System works without hardware present
- **Progressive Enhancement**: Advanced features optional
- **Offline-First**: Core functionality works without network
- **Platform-Agnostic UI**: UI adapts to available platform tools

---

## API Envelope Contract

### Standard Envelope Format

All API responses MUST use this envelope structure:

```typescript
type ApiEnvelope<T> = {
  ok: boolean;                    // true = success, false = error
  data?: T;                       // present when ok: true
  error?: {                       // present when ok: false
    code: string;                 // machine-readable error code
    message: string;              // human-readable error message
    details?: unknown;            // optional additional context
  };
  meta?: {                        // optional metadata
    ts: string;                   // ISO 8601 timestamp
    correlationId: string;        // unique request identifier
    apiVersion: string;           // API version (e.g., "v1")
  };
};
```

### Success Response Example

```json
{
  "ok": true,
  "data": {
    "device_uid": "usb-1234-adb-XYZ123",
    "display_name": "Google Pixel 6",
    "platform_hint": "android",
    "mode": "adb",
    "confidence": 0.95
  },
  "meta": {
    "ts": "2026-05-23T15:00:00Z",
    "correlationId": "req-abc-123",
    "apiVersion": "v1"
  }
}
```

### Error Response Example

```json
{
  "ok": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device with UID 'usb-1234-adb-XYZ123' not found",
    "details": {
      "requestedUid": "usb-1234-adb-XYZ123",
      "availableDevices": []
    }
  },
  "meta": {
    "ts": "2026-05-23T15:00:00Z",
    "correlationId": "req-abc-123",
    "apiVersion": "v1"
  }
}
```

---

## Device Detection Contract

### PhoenixCore → BootForge USB

**Contract:** PhoenixCore requests device enumeration from BootForge USB layer.

**API Endpoint:** `GET /api/bootforgeusb/scan`

**Request:** None (GET request)

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    devices: Array<{
      device_uid: string;          // unique identifier
      display_name: string;        // human-readable name
      platform_hint: string;       // "android" | "ios" | "windows" | "iot" | "unknown"
      mode: string;                // "adb" | "fastboot" | "recovery" | "offline"
      confidence: number;          // 0.0 to 1.0
      correlation_badge?: string;  // "CORRELATED" | "LIKELY" | "SYSTEM-CONFIRMED"
      evidence?: Record<string, unknown>;  // platform-specific metadata
    }>;
    meta: {
      cliAvailable: boolean;
      cliPath: string | null;
      scanTime: number;            // milliseconds
    };
  }
}
```

**Fallback Behavior:**
- If BootForge USB CLI not available, return mock data with `cliAvailable: false`
- Mock data MUST include `platform_hint: "mock"` to indicate simulation
- UI MUST display mock indicator when `cliAvailable: false`

**Error Codes:**
- `BOOTFORGE_NOT_FOUND` - BootForge CLI not installed
- `SCAN_FAILED` - Device enumeration failed
- `PERMISSION_DENIED` - Insufficient USB permissions

---

## ADB Integration Contract

### PhoenixCore → ADB (Android Debug Bridge)

**Contract:** PhoenixCore requests Android device information via ADB.

**API Endpoint:** `GET /api/adb/devices`

**Request:** None (GET request)

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    devices: Array<{
      serial: string;              // ADB device serial
      state: string;               // "device" | "offline" | "unauthorized"
      mode: string;                // "adb" | "recovery" | "sideload"
      brand?: string;              // device manufacturer
      model?: string;              // device model
      product?: string;            // product name
      device?: string;             // device codename
      transportId?: string;        // ADB transport ID
    }>;
  }
}
```

**Fallback Behavior:**
- If ADB not found in PATH, return `error.code: "ADB_NOT_FOUND"`
- UI MUST show "Install ADB" instructions
- Do NOT fake ADB data when tool unavailable

**Error Codes:**
- `ADB_NOT_FOUND` - ADB command not in PATH
- `ADB_COMMAND_FAILED` - ADB command returned non-zero exit code
- `PARSE_ERROR` - Could not parse ADB output

---

## Fastboot Integration Contract

### PhoenixCore → Fastboot

**Contract:** PhoenixCore requests Fastboot device information.

**API Endpoint:** `GET /api/fastboot/devices`

**Request:** None (GET request)

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    devices: Array<{
      serial: string;              // Fastboot device serial
      product?: string;            // device product name
      variant?: string;            // device variant
      bootloader?: string;         // bootloader version
      baseband?: string;           // baseband version
      unlocked?: boolean;          // bootloader unlock state
    }>;
  }
}
```

**Fallback Behavior:**
- If Fastboot not found in PATH, return `error.code: "FASTBOOT_NOT_FOUND"`
- UI MUST show "Install Fastboot" instructions
- Do NOT fake Fastboot data when tool unavailable

**Error Codes:**
- `FASTBOOT_NOT_FOUND` - Fastboot command not in PATH
- `FASTBOOT_COMMAND_FAILED` - Fastboot command returned non-zero exit code
- `PARSE_ERROR` - Could not parse Fastboot output

---

## Case Management Contract

### UI → PhoenixCore Case API

**Contract:** UI manages repair cases through PhoenixCore API.

### Create Case

**API Endpoint:** `POST /api/v1/cases`

**Request Body:**
```typescript
{
  title?: string;                  // optional case title
  notes?: string;                  // optional case notes
}
```

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    id: string;                    // unique case ID
    title: string;                 // case title (or generated default)
    notes: string;                 // case notes
    createdAt: string;             // ISO 8601 timestamp
    updatedAt: string;             // ISO 8601 timestamp
    status: "open" | "closed";     // case status
  }
}
```

### Device Intake (Read-Only)

**API Endpoint:** `POST /api/v1/cases/:id/intake`

**Request Body:**
```typescript
{
  platform: string;                // "android" | "ios" | "windows" | "iot"
  connectionState: string;         // "adb" | "fastboot" | "offline"
  deviceInfo: Record<string, unknown>;  // platform-specific device info
  evidence?: Record<string, unknown>;   // correlation evidence
}
```

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    passportId: string;            // unique passport ID
    capturedAt: string;            // ISO 8601 timestamp
    platform: string;
    deviceInfo: Record<string, unknown>;
  }
}
```

**Contract Guarantee:**
- Device intake is READ-ONLY
- No device state modifications
- All data captured for audit trail
- Ownership verification required before any write operations

### Ownership Verification

**API Endpoint:** `POST /api/v1/cases/:id/ownership`

**Request Body:**
```typescript
{
  confirmation: string;            // MUST be exact phrase "I CONFIRM AUTHORIZED SERVICE"
}
```

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    verified: boolean;             // true if phrase matches
    verifiedAt: string;            // ISO 8601 timestamp
  }
}
```

**Contract Guarantee:**
- Exact phrase match required (case-sensitive)
- Logged to audit trail
- Required before any write/flash/erase operations
- Cannot be bypassed

---

## Workflow Execution Contract

### PhoenixCore → Workflow Engine

**Contract:** Execute diagnostic/repair workflows with safety guarantees.

**API Endpoint:** `POST /api/v1/cases/:id/workflows/:workflowId/run`

**Request Body:**
```typescript
{
  dryRun?: boolean;                // default: true
  parameters?: Record<string, unknown>;  // workflow-specific params
}
```

**Response Envelope:**
```typescript
{
  ok: true,
  data: {
    executionId: string;           // unique execution ID
    workflowId: string;            // workflow that was run
    dryRun: boolean;               // true if simulation mode
    steps: Array<{
      step: string;                // step name
      status: "pending" | "running" | "completed" | "failed" | "skipped";
      result?: unknown;            // step-specific result
      error?: string;              // error message if failed
      startedAt?: string;          // ISO 8601 timestamp
      completedAt?: string;        // ISO 8601 timestamp
    }>;
    completedAt?: string;          // ISO 8601 timestamp when workflow finished
    success: boolean;              // overall success/failure
  }
}
```

**Contract Guarantee:**
- All workflows default to `dryRun: true`
- Dry-run workflows never modify device state
- All steps logged to audit trail
- Rollback steps executed on failure (when available)
- User confirmation required for destructive steps (even in dry-run)

**Error Codes:**
- `WORKFLOW_NOT_FOUND` - Workflow ID not valid
- `VALIDATION_ERROR` - Workflow parameters invalid
- `EXECUTION_FAILED` - Workflow execution failed
- `ROLLBACK_FAILED` - Rollback steps failed (critical)

---

## Export Contract

### UI → Export API

**Contract:** Generate diagnostic reports in multiple formats.

**API Endpoint:** `GET /api/v1/cases/:id/audit`

**Request Query Params:**
```typescript
{
  format?: "json" | "markdown";    // default: "json"
}
```

**Response (JSON format):**
```typescript
{
  ok: true,
  data: {
    caseId: string;
    title: string;
    createdAt: string;
    events: Array<{
      timestamp: string;
      event: string;
      metadata?: Record<string, unknown>;
    }>;
    statistics: {
      totalEvents: number;
      policyGates: number;
      confirmations: number;
      exitCodes: Record<string, number>;
    };
  }
}
```

**Response (Markdown format):**
```typescript
{
  ok: true,
  data: string;  // Markdown-formatted report
}
```

**Contract Guarantee:**
- All sensitive data redacted in exports
- Exports include correlation ID for traceability
- Timestamp in ISO 8601 format
- No PII unless explicitly required
- Exports are read-only snapshots

---

## Safety Boundaries

### Operations Requiring Confirmation

The following operations MUST require explicit user confirmation:

1. **Bootloader Unlock** - Typed phrase + checkbox
2. **Factory Reset** - Typed phrase + checkbox
3. **Partition Erase** - Typed phrase + checkbox
4. **Firmware Flash** - Typed phrase + checkbox
5. **Ownership Verification** - Typed exact phrase
6. **FRP Bypass** - Multiple confirmations + audit log

### Operations Prohibited

The following operations are PROHIBITED and MUST NOT be implemented:

1. **IMEI Alteration** - Never allowed
2. **Account Lock Bypass** (without owner consent) - Never allowed
3. **Ownership Circumvention** - Never allowed
4. **Silent Firmware Flash** - Never allowed
5. **Audit Log Tampering** - Never allowed

### Dry-Run Guarantee

All destructive operations MUST support `dryRun: true` mode:

- Simulate operation without executing
- Return expected result as if it succeeded
- Log simulation to audit trail
- UI clearly indicates "SIMULATION MODE"
- User can preview before actual execution

---

## Error Handling Contract

### Error Code Categories

**Client Errors (4xx):**
- `VALIDATION_ERROR` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - State conflict (e.g., case already closed)

**Server Errors (5xx):**
- `INTERNAL_ERROR` - Unexpected server error
- `SERVICE_UNAVAILABLE` - Dependency unavailable (ADB, Fastboot, etc.)
- `TIMEOUT` - Operation timed out
- `NOT_IMPLEMENTED` - Feature not yet implemented

**Platform Errors (6xx - Custom):**
- `DEVICE_NOT_FOUND` - Device disconnected or not detected
- `TOOL_NOT_FOUND` - Platform tool not installed (ADB, Fastboot)
- `PERMISSION_DENIED` - Insufficient system permissions
- `HARDWARE_ERROR` - Hardware communication error

### Error Response Format

```typescript
{
  ok: false,
  error: {
    code: string;                  // machine-readable code
    message: string;               // human-readable message
    details?: {
      field?: string;              // validation field name
      expected?: unknown;          // expected value
      actual?: unknown;            // actual value
      suggestion?: string;         // actionable suggestion
    };
  }
}
```

### UI Error Display

- **Validation errors**: Display inline near input field
- **Not found errors**: Display friendly "not found" page
- **Server errors**: Display error dialog with retry option
- **Platform errors**: Display installation/setup instructions

---

## Audit Logging Contract

### Event Structure

All audit events MUST include:

```typescript
{
  timestamp: string;               // ISO 8601 timestamp
  event: string;                   // event name (SCREAMING_SNAKE_CASE)
  userId?: string;                 // user identifier (if multi-user)
  caseId?: string;                 // case identifier (if applicable)
  deviceId?: string;               // device identifier (if applicable)
  metadata?: Record<string, unknown>;  // event-specific data
  policyGate?: string;             // policy that gated this event
  exitCode?: number;               // operation exit code (0 = success)
}
```

### Event Naming Convention

Events MUST use `SCREAMING_SNAKE_CASE`:

- `CASE_CREATED`
- `DEVICE_INTAKE_READONLY`
- `OWNERSHIP_VERIFICATION_ATTEMPTED`
- `OWNERSHIP_VERIFICATION_SUCCEEDED`
- `WORKFLOW_EXECUTION_STARTED`
- `WORKFLOW_EXECUTION_COMPLETED`
- `WORKFLOW_EXECUTION_FAILED`
- `EXPORT_GENERATED`

### Audit Guarantees

- All events written to append-only log
- Events never deleted (only archived)
- Timestamps in UTC
- Correlation IDs link related events
- Sensitive data redacted (passwords, PII)
- Audit log queryable via API

---

## Version Compatibility

### API Versioning

- Current version: `v1`
- Version in URL path: `/api/v1/...`
- Version in envelope meta: `apiVersion: "v1"`
- Backward compatibility: 6 months minimum
- Deprecation notice: 6 months before removal

### Breaking Changes

Breaking changes require major version bump:

- Removing fields from response
- Changing field types
- Renaming endpoints
- Changing error codes
- Removing endpoints

Non-breaking changes allowed in minor versions:

- Adding new fields to response
- Adding new endpoints
- Adding new error codes
- Adding optional request parameters

---

## Performance Contract

### Response Time Targets

- **Device detection:** < 3 seconds
- **Case operations:** < 500ms
- **Workflow execution:** Depends on platform (acceptable delays)
- **Export generation:** < 2 seconds
- **Audit log query:** < 1 second

### Resource Limits

- **Max concurrent workflows:** 1 per device
- **Max audit events per case:** 10,000
- **Max export file size:** 10 MB
- **Max device queue:** 50 devices

---

## Testing Contract

### Mock Data Requirements

All APIs MUST provide mock data when:

- Hardware unavailable
- Platform tools not installed
- Testing/development mode

Mock data MUST:

- Use `platform_hint: "mock"` indicator
- Return realistic data structures
- Include all required fields
- Never mix mock and real data

### Integration Test Requirements

All APIs MUST have integration tests for:

- Success case
- Error cases (not found, validation, etc.)
- Envelope format validation
- Mock fallback behavior

---

## Appendix: Example Workflows

### Complete Repair Case Flow

1. **Device Connection**
   - User connects device via USB
   - BootForge USB detects device
   - Device appears in dashboard queue

2. **Case Creation**
   - User clicks device in queue
   - User clicks "Create Case"
   - System creates case with default title
   - User edits title and notes

3. **Device Intake**
   - User clicks "Record Intake"
   - System captures device info (read-only)
   - System stores device passport
   - Audit log: `DEVICE_INTAKE_READONLY`

4. **Ownership Verification**
   - User clicks "Verify Ownership"
   - User types exact phrase: "I CONFIRM AUTHORIZED SERVICE"
   - System verifies phrase match
   - Audit log: `OWNERSHIP_VERIFICATION_SUCCEEDED`

5. **Run Diagnostics**
   - User selects diagnostic workflow
   - User clicks "Run Diagnostic"
   - System executes workflow (read-only, dry-run)
   - Results displayed in UI
   - Audit log: `WORKFLOW_EXECUTION_COMPLETED`

6. **Export Report**
   - User clicks "Export Report"
   - User selects format (JSON or Markdown)
   - System generates report with all case data
   - User downloads file
   - Audit log: `EXPORT_GENERATED`

---

**Contract Owner:** Bobby's Workshop Team
**Review Cycle:** Quarterly
**Next Review:** 2026-08-23

> This contract is binding for all UI and API implementations. Changes require architecture review.
