# Roadmap

## Bobby's Workshop - Product Roadmap

**Last Updated:** 2026-05-23

---

## Vision

Build a professional, safety-first device repair platform that empowers technicians with intelligent workflows, comprehensive diagnostics, and complete audit trails—all while preventing destructive operations and maintaining full traceability.

---

## Release Timeline

### ✅ v5.0.0 - Reforged MVP (Current)

**Status:** In Development
**Target:** Q2 2026
**Theme:** Foundation & Safety

**Delivered Features:**
- ✅ Device dashboard with real-time USB detection
- ✅ Multi-platform support (Android, iOS, Windows, IoT)
- ✅ Repair case management with audit logging
- ✅ Read-only diagnostic workflows
- ✅ Export diagnostic reports (JSON/Markdown)
- ✅ Dry-run default for all operations
- ✅ Explicit ownership verification
- ✅ Mock-safe fallback for development
- ✅ React 19 + Tailwind CSS v4 UI
- ✅ Tauri desktop packaging (MSI/NSIS/DMG/App)

**Documentation:**
- ✅ PRD (Product Requirements Document)
- ✅ Roadmap (this document)
- ✅ Release Checklist
- ✅ App Contract (UX boundaries)
- ✅ Packaging Guide

**Validation:**
- ✅ Healthcheck script
- ✅ Smoke test script

---

## Future Releases

### 🚀 v5.1.0 - Enhanced Detection

**Target:** Q3 2026
**Theme:** Smarter Device Recognition

**Planned Features:**
- **Device Auto-Detection Enhancements**
  - Faster correlation algorithms (< 1 second)
  - Background device monitoring
  - Correlation confidence improvements
  - More device signatures (laptops, tablets, smartwatches)

- **Detection Improvements**
  - USB-C hub support
  - Multi-port detection
  - Device state change notifications
  - Platform-specific serial number extraction

- **UI Enhancements**
  - Device detail view with hardware specs
  - Connection history timeline
  - Device comparison view

**Success Metrics:**
- Device detection < 1 second
- 95% correlation accuracy for known devices
- Zero false positives

---

### 🚀 v5.2.0 - Advanced Reporting

**Target:** Q4 2026
**Theme:** Professional Reports & Documentation

**Planned Features:**
- **Report Formatting**
  - PDF export with custom branding
  - HTML export for web viewing
  - Customizable report templates
  - Report preview before export

- **Report Content**
  - Visual device diagrams
  - Test result charts and graphs
  - Photo attachment support
  - Customer-friendly summary section

- **Report Management**
  - Report library with search
  - Report versioning
  - Batch export multiple cases
  - Email integration for sharing

**Success Metrics:**
- PDF generation < 3 seconds
- Custom branding support
- 100% of MVP data included in exports

---

### 🚀 v5.3.0 - Full Audit Pipeline

**Target:** Q1 2027
**Theme:** Compliance & Traceability

**Planned Features:**
- **Audit System Enhancements**
  - Event retention policies (configurable)
  - Log rotation and archival
  - Search and filter audit logs
  - Audit log export (CSV, JSON)

- **Event Analytics**
  - Operation statistics dashboard
  - Technician performance metrics
  - Common failure pattern detection
  - Audit trail visualization

- **Compliance Features**
  - Tamper-evident log signatures
  - Regulatory compliance reports
  - Data retention policies
  - GDPR-compliant data export

**Success Metrics:**
- 100% event capture rate
- Audit search < 1 second
- Zero audit log data loss

---

### 🚀 v6.0.0 - Team Edition

**Target:** Q2 2027
**Theme:** Multi-User Collaboration

**Planned Features:**
- **Multi-User Support**
  - User authentication and authorization
  - Role-based access control (Admin, Technician, Viewer)
  - User activity tracking
  - Session management

- **Team Collaboration**
  - Case assignment and handoff
  - Team chat and comments on cases
  - Shared workflow templates
  - Team performance dashboards

- **Cloud Sync (Optional)**
  - Cloud backup for cases and audit logs
  - Multi-device sync
  - Offline-first with sync when online
  - End-to-end encryption

**Success Metrics:**
- Support 5+ concurrent users
- Sub-second role switching
- 99.9% cloud sync reliability

---

### 🚀 v6.1.0 - Workflow Automation

**Target:** Q3 2027
**Theme:** Intelligent Repair Workflows

**Planned Features:**
- **Advanced Workflow Engine**
  - Visual workflow builder
  - Conditional logic and branching
  - Parallel step execution
  - Workflow templates marketplace

- **AI-Assisted Diagnosis**
  - Symptom-based workflow suggestions
  - Historical pattern matching
  - Predictive failure detection
  - Automated test selection

- **Workflow Analytics**
  - Success rate tracking per workflow
  - Average execution time
  - Common failure points
  - Optimization recommendations

**Success Metrics:**
- 50+ pre-built workflow templates
- 20% reduction in diagnostic time
- 90% workflow success rate

---

### 🚀 v7.0.0 - Platform Expansion

**Target:** Q4 2027
**Theme:** Beyond Mobile Devices

**Planned Features:**
- **New Device Categories**
  - Laptop repair workflows
  - Tablet diagnostics
  - Smartwatch support
  - IoT device management

- **Platform-Specific Tools**
  - BIOS/UEFI diagnostics
  - Hard drive health checks
  - Battery calibration tools
  - Firmware update manager

- **Integration Ecosystem**
  - Third-party tool integrations
  - API for custom extensions
  - Plugin marketplace
  - Webhook support

**Success Metrics:**
- Support 10+ device categories
- 3rd party integration SDK published
- 10+ community plugins

---

## Feature Requests & Community Input

### Most Requested Features

Based on community feedback and user interviews:

1. **Batch Operations** (Planned v5.4.0)
   - Run diagnostics on multiple devices simultaneously
   - Batch firmware updates
   - Bulk case export

2. **Remote Diagnostics** (Planned v6.2.0)
   - Remote device connection over network
   - Screen sharing for remote assistance
   - Remote workflow execution

3. **Inventory Management** (Planned v7.1.0)
   - Parts inventory tracking
   - Device history linked to parts used
   - Low stock alerts

4. **Customer Portal** (Planned v7.2.0)
   - Customer-facing status updates
   - Repair estimate approval
   - Online payment integration

### How to Submit Feature Requests

1. Open an issue on GitHub: https://github.com/Bboy9090/Bobbys-Workshop-/issues
2. Label as "feature-request"
3. Describe the problem you're solving
4. Propose a solution (optional)

We review feature requests quarterly and prioritize based on:
- User impact (how many users benefit)
- Alignment with vision
- Technical feasibility
- Resource availability

---

## Development Principles

### Safety First

- No destructive operations without explicit confirmation
- Dry-run default for all modifications
- Complete audit trail for compliance
- Mock-safe fallback for development

### Professional Quality

- Clean, intuitive UI for daily operations
- Advanced features accessible when needed
- Fast performance (< 100ms UI responsiveness)
- Cross-platform support (Windows, macOS, Linux)

### Open & Transparent

- Public roadmap (this document)
- Community-driven feature prioritization
- Open source (MIT license)
- No vendor lock-in

---

## Known Limitations (Current MVP)

These are intentional limitations in v5.0.0 that will be addressed in future releases:

1. **Single User Only**
   - MVP supports one user at a time
   - No authentication or authorization
   - Fixed in v6.0.0 Team Edition

2. **Limited Export Formats**
   - Only JSON and Markdown supported
   - No PDF or HTML exports
   - Fixed in v5.2.0 Advanced Reporting

3. **No Cloud Sync**
   - All data stored locally
   - No backup or multi-device sync
   - Optional in v6.0.0 Team Edition

4. **Manual Device Detection**
   - Requires manual refresh (2.5s polling)
   - No background monitoring
   - Fixed in v5.1.0 Enhanced Detection

5. **No Batch Operations**
   - One device at a time
   - No simultaneous diagnostics
   - Fixed in v5.4.0 Batch Operations

---

## Deprecation Policy

We maintain backwards compatibility for:
- API endpoints (v1 endpoints deprecated with 6 month notice)
- Data formats (JSON schema versioned, old versions supported for 1 year)
- Configuration files (auto-migration provided)

When deprecating features:
1. Announce 6 months before removal
2. Provide migration guide
3. Show deprecation warnings in app
4. Offer support for migration

---

## Release Cadence

- **Major releases** (x.0.0): Every 6 months
- **Minor releases** (x.y.0): Every 1-2 months
- **Patch releases** (x.y.z): As needed for bug fixes

---

## Appendix

### Dependencies Roadmap

**Current:**
- React 19 (stable)
- Tailwind CSS v4 (stable)
- Node.js 20+ (LTS)
- Tauri (latest stable)

**Planned Updates:**
- React 20 (when stable, estimated 2027)
- Node.js 22 LTS (when available, estimated 2027)

**No Plans to Change:**
- Vite (stable, performant)
- TypeScript (stable)
- Rust (for BootForge USB)

### Platform Support

**Current:**
- Windows 10+ (MSI/NSIS)
- macOS 10.13+ (DMG/App)
- Linux (AppImage/DEB)

**Future:**
- Windows ARM (v6.0.0)
- macOS ARM (v6.0.0)
- Linux Snap/Flatpak (v6.0.0)

---

**Roadmap Owner:** Bobby's Workshop Team
**Review Cycle:** Quarterly
**Next Review:** 2026-08-23

> This roadmap is a living document and may be adjusted based on user feedback, technical constraints, and strategic priorities.
