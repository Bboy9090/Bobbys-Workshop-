# Product Requirements Document (PRD)

## Bobby's Workshop - Reforged MVP

**Version:** 5.0.0
**Status:** Active Development
**Last Updated:** 2026-05-23

---

## Executive Summary

Bobby's Workshop is a professional device repair, diagnostics, and recovery dashboard for Bobby's World / Blue Phoenix OS. The Reforged MVP establishes a solid foundation for device management and repair workflows with safety-first principles and comprehensive audit trails.

---

## Vision

**"Rise from the Ashes. Every Device Reborn."**

Create a professional-grade repair platform that empowers technicians with the tools and intelligence needed to diagnose, repair, and restore devices safely and efficiently—without destructive actions or bypass flows.

---

## Product Scope

### In Scope (MVP v5.0.0)

1. **Device Dashboard**
   - Real-time USB device detection
   - Multi-platform support (Android, iOS, Windows, IoT)
   - Mock-safe fallback when hardware unavailable
   - Device correlation and confidence scoring

2. **Diagnostic System**
   - Read-only diagnostic checklist per device platform
   - JSON-based workflow definitions
   - Platform-specific diagnostic routines (ADB, Fastboot, libimobiledevice)
   - Safe diagnostic data collection

3. **Repair Case Management**
   - Create/manage repair cases with title and notes
   - Device intake recording (read-only)
   - Ownership verification with explicit confirmation
   - Case-scoped audit logging

4. **Export Functionality**
   - Export diagnostic reports in JSON format
   - Export diagnostic reports in Markdown format
   - Include device info, case notes, and audit trail
   - Timestamp and correlation ID tracking

5. **Safety & Audit**
   - All repair operations default to dry-run mode
   - Audit log stub for all operations
   - No destructive actions without explicit user confirmation
   - Event tracking with policy gates and exit codes

### Out of Scope (Future Releases)

- Device auto-detection enhancements
- Advanced report formatting (PDF, HTML)
- Full audit/event history pipeline with retention policies
- Multi-user role-based access control
- Cloud sync and backup
- Firmware flashing automation
- Advanced workflow orchestration

---

## User Stories

### As a repair technician, I want to...

1. **See connected devices immediately** so I can begin diagnosis quickly
   - Acceptance: Dashboard shows devices within 2.5 seconds of connection
   - Acceptance: Platform hints (Android/iOS/etc.) are displayed correctly

2. **Run diagnostic workflows without risk** so I can assess device state safely
   - Acceptance: All diagnostics are read-only
   - Acceptance: Diagnostics show clear pass/fail/warning states
   - Acceptance: No device modifications during diagnostic runs

3. **Track repair notes per device** so I can document my work
   - Acceptance: Create case with title and notes
   - Acceptance: Record device intake information
   - Acceptance: Update case notes at any time

4. **Export diagnostic reports** so I can share findings with customers or colleagues
   - Acceptance: Export to JSON with complete device data
   - Acceptance: Export to Markdown with human-readable format
   - Acceptance: Include timestamp and correlation ID

5. **Verify device ownership** before servicing to ensure I'm authorized
   - Acceptance: Ownership verification requires typed confirmation phrase
   - Acceptance: Ownership status is recorded in audit log
   - Acceptance: Cannot proceed without ownership verification for sensitive operations

---

## Technical Architecture

### System Components

```
┌────────────────────────────────────────────┐
│  Frontend (React 19 + Tailwind CSS v4)    │
│  - Device Queue Sidebar                    │
│  - Repair Case Management                  │
│  - Activity Log Feed                       │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  Backend Services (Node.js/Express)        │
│  - Device Detection API                    │
│  - Case Management API                     │
│  - Workflow Execution Engine               │
│  - Audit Logging                           │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  Hardware Layer                            │
│  - BootForge USB (Rust)                    │
│  - ADB/Fastboot (Android)                  │
│  - libimobiledevice (iOS)                  │
└────────────────────────────────────────────┘
```

### API Endpoints (MVP)

**Device Detection**
- `GET /api/bootforgeusb/scan` - Full USB device enumeration
- `GET /api/adb/devices` - ADB device detection
- `GET /api/fastboot/devices` - Fastboot device detection

**Case Management**
- `POST /api/v1/cases` - Create repair case
- `POST /api/v1/cases/:id/intake` - Record device intake
- `POST /api/v1/cases/:id/ownership` - Verify ownership
- `GET /api/v1/cases/:id/audit` - Get audit log

**Workflow Execution**
- `POST /api/v1/cases/:id/workflows/:workflowId/run` - Execute workflow
- `GET /api/v1/workflows` - List available workflows

**Export**
- `GET /api/v1/cases/:id/audit` - Get audit log (JSON)
- Custom export logic for Markdown format

### Data Models

**Device**
```typescript
{
  device_uid: string;
  display_name: string;
  platform_hint: string;
  mode: string;
  confidence: number;
  correlation_badge?: string;
  evidence?: Record<string, unknown>;
}
```

**Case**
```typescript
{
  id: string;
  title: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  devicePassport?: DevicePassport;
  auditLog: AuditEvent[];
}
```

**Audit Event**
```typescript
{
  timestamp: string;
  event: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  policyGate?: string;
  exitCode?: number;
}
```

---

## User Experience

### Workflow: Create Repair Case

1. User connects device to USB
2. Dashboard shows device in queue (2.5s polling)
3. User clicks device to select
4. User clicks "Create Case" button
5. User enters case title and notes
6. System creates case and redirects to case view
7. User performs device intake (read-only)
8. User confirms ownership verification (typed phrase)
9. User runs diagnostic workflow
10. User exports diagnostic report
11. Case is saved with complete audit trail

### Safety Confirmation Pattern

All sensitive operations require explicit confirmation:

```
┌─────────────────────────────────────────┐
│  ⚠️  Ownership Verification Required    │
├─────────────────────────────────────────┤
│  To proceed, please type:               │
│                                         │
│  I CONFIRM AUTHORIZED SERVICE           │
│                                         │
│  [                               ]      │
│                                         │
│  [Cancel]              [Verify]         │
└─────────────────────────────────────────┘
```

---

## Success Metrics

### MVP Launch Criteria

- [ ] Device detection works for Android (ADB/Fastboot)
- [ ] Device detection works for iOS (libimobiledevice)
- [ ] Case creation and management functional
- [ ] Diagnostic workflows execute successfully
- [ ] Export to JSON format works
- [ ] Export to Markdown format works
- [ ] Audit logging captures all events
- [ ] Healthcheck script passes
- [ ] Smoke test script passes

### Performance Targets

- Device detection latency: < 3 seconds
- Dashboard UI responsiveness: < 100ms
- Workflow execution: depends on platform (acceptable delays for hardware operations)
- Export generation: < 2 seconds for typical case

### Quality Targets

- Zero destructive operations without explicit confirmation
- 100% audit trail coverage for sensitive operations
- All operations return structured error envelopes
- Build passes on all target platforms (Windows, macOS, Linux)

---

## Risk Assessment

### Technical Risks

1. **USB Device Detection Reliability**
   - Risk: Inconsistent device enumeration across platforms
   - Mitigation: Mock-safe fallback, correlation confidence scoring

2. **Platform Tool Dependencies**
   - Risk: ADB/Fastboot/libimobiledevice not installed
   - Mitigation: Clear error messages, installation guidance

3. **Audit Log Performance**
   - Risk: High-frequency events may impact performance
   - Mitigation: Async logging, event batching for future releases

### Safety Risks

1. **Accidental Destructive Operations**
   - Risk: User performs destructive action by mistake
   - Mitigation: Dry-run default, explicit typed confirmations, audit trails

2. **Unauthorized Device Access**
   - Risk: Technician services device without owner consent
   - Mitigation: Ownership verification required, audit logging of all attempts

---

## Dependencies

### Runtime Dependencies

- Node.js 20+
- Python 3.11+ (for FastAPI backend)
- Rust 1.75+ (for BootForge USB)

### Platform Tools (Optional)

- ADB (Android Debug Bridge)
- Fastboot
- libimobiledevice (iOS)
- Odin/Heimdall (Samsung)

### External Services

- None (fully offline-capable)

---

## Deployment Strategy

### Packaging

- **Windows**: MSI and NSIS installers via Tauri
- **macOS**: DMG and App via Tauri
- **Linux**: AppImage and DEB via Tauri

### Distribution

- GitHub Releases (primary)
- Direct download from Bobby's World website (future)
- No app store distribution in MVP

### Installation

1. Download installer for target platform
2. Run installer (standard OS installation flow)
3. Launch Bobby's Workshop
4. Install platform tools if needed (ADB, Fastboot, etc.)
5. Connect device and begin repair workflow

---

## Future Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed future plans.

### Next Major Features (Post-MVP)

1. **Enhanced Device Auto-Detection**
   - Faster correlation algorithms
   - More device types (laptops, tablets, IoT)
   - Background monitoring

2. **Advanced Report Formatting**
   - PDF export with branding
   - HTML export for web viewing
   - Customizable templates

3. **Full Audit Pipeline**
   - Event retention policies
   - Log rotation and archival
   - Search and filter capabilities

4. **Multi-User Support**
   - Role-based access control
   - User authentication
   - Team collaboration features

---

## Appendix

### Glossary

- **Case**: A repair session tracking a single device through diagnosis and repair
- **Device Passport**: Read-only device information captured at intake
- **Dry-Run**: Operation mode that simulates but doesn't execute changes
- **Audit Log**: Chronological record of all operations and events
- **Correlation**: Matching USB devices with platform tools (ADB, Fastboot)
- **Ownership Verification**: Explicit confirmation that user is authorized to service device

### References

- [app.metadata.json](../app.metadata.json) - App metadata and safety contract
- [ROADMAP.md](./ROADMAP.md) - Product roadmap
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) - Release validation checklist
- [APP_CONTRACT.md](./APP_CONTRACT.md) - UX contract and API boundaries

---

**Document Owner:** Bobby's Workshop Team
**Review Cycle:** Quarterly
**Next Review:** 2026-08-23
