# 🔨 BOBBY'S WORKSHOP — SHADOW GENIUS BAR INTEGRATION
## How Shadow Genius Diagnostics Integrates with Existing Platform

**Version:** 1.0  
**Date:** 2025-01-27  
**Core System:** Bobby's Secret Workshop

---

## INTEGRATION OVERVIEW

Shadow Genius Bar is not a separate system.
It is **the diagnostic brain** that plugs into Bobby's Workshop's existing architecture.

---

## EXISTING BOBBY'S WORKSHOP ARCHITECTURE

### Current Components
- **Frontend:** React + TypeScript (Tauri desktop)
- **Backend:** Node.js/Express (port 3001)
- **Core Libraries:** `core/lib/` (adb.js, ios.js, fastboot.js, shadow-logger.js)
- **Device Detection:** BootForgeUSB (Rust + Python bindings)
- **Workflows:** JSON-defined device operations
- **Observability:** Universal Legend Status (metrics, traces, logs)
- **Secret Rooms:** 10 specialized rooms with Codex services

### Current Device Support
- Android (ADB, Fastboot)
- iOS (libimobiledevice)
- USB enumeration (BootForgeUSB)

---

## SHADOW GENIUS INTEGRATION POINTS

### 1) New Backend Routes

**Location:** `server/routes/v1/shadow-genius/`

```
shadow-genius/
├── apple/
│   ├── diagnostics.js      # SGDE-A
│   ├── trust-check.js      # macOS trust gate
│   └── stress-tests.js     # FCP + Logic
├── android/
│   ├── diagnostics.js      # SGDE-Android
│   ├── oem-profile.js      # OEM security
│   └── stress-tests.js     # Camera, GPU, Modem
├── windows/
│   ├── diagnostics.js      # SGDE-W
│   ├── firmware-check.js   # UEFI, Secure Boot, TPM
│   └── stress-tests.js     # CPU/GPU/RAM/IO
└── consoles/
    ├── diagnostics.js      # SGDE-C
    ├── ban-risk.js          # Firmware + network trust
    └── stress-tests.js      # Thermal soak + gameplay
```

### 2) Frontend Components

**Location:** `src/components/ShadowGenius/`

```
ShadowGenius/
├── IntakeWizard.tsx         # Multi-platform intake
├── DiagnosticsPanel.tsx     # SGDE results display
├── TrustGate.tsx            # Platform-specific gates
├── StressTestRunner.tsx     # Automated stress execution
├── DecisionMatrix.tsx       # SAFE/RISK/STOP display
├── HealthCertificate.tsx    # Customer-facing cert
└── LedgerViewer.tsx         # Immutable history
```

### 3) Core Library Extensions

**Location:** `core/lib/shadow-genius/`

```
shadow-genius/
├── sgde-apple.js           # Apple diagnostic engine
├── sgde-android.js         # Android diagnostic engine
├── sgde-windows.js         # Windows diagnostic engine
├── sgde-consoles.js        # Console diagnostic engine
├── risk-engine.js          # Unified risk scoring
├── health-scoring.js       # Unified health index
└── decision-layer.js       # SAFE/RISK/STOP logic
```

### 4) Workflow Integration

**Location:** `workflows/shadow-genius/`

```
shadow-genius/
├── apple/
│   ├── full-diagnostic.json
│   ├── trust-verification.json
│   └── stress-test-suite.json
├── android/
│   ├── full-diagnostic.json
│   ├── oem-profile.json
│   └── stress-test-suite.json
├── windows/
│   ├── full-diagnostic.json
│   ├── firmware-check.json
│   └── stress-test-suite.json
└── consoles/
    ├── full-diagnostic.json
    ├── ban-risk-check.json
    └── stress-test-suite.json
```

---

## DATABASE SCHEMA EXTENSIONS

### New Tables

```sql
-- Shadow Genius Sessions
CREATE TABLE shadow_genius_sessions (
  id UUID PRIMARY KEY,
  device_platform VARCHAR(50), -- 'apple', 'android', 'windows', 'console'
  device_model VARCHAR(255),
  session_start TIMESTAMP,
  session_end TIMESTAMP,
  technician_tier INTEGER,
  final_decision VARCHAR(10), -- 'SAFE', 'RISK', 'STOP'
  certificate_hash VARCHAR(64)
);

-- SGDE Results (Platform-Specific)
CREATE TABLE sgde_results (
  session_id UUID REFERENCES shadow_genius_sessions(id),
  platform VARCHAR(50),
  module_name VARCHAR(100),
  module_result JSONB,
  trust_score INTEGER,
  created_at TIMESTAMP
);

-- Stress Test Results
CREATE TABLE stress_test_results (
  session_id UUID REFERENCES shadow_genius_sessions(id),
  platform VARCHAR(50),
  test_type VARCHAR(100), -- 'fcp', 'logic', 'camera', 'gpu', etc.
  test_result JSONB,
  health_score INTEGER,
  created_at TIMESTAMP
);

-- Risk Assessments
CREATE TABLE risk_assessments (
  session_id UUID REFERENCES shadow_genius_sessions(id),
  risk_category VARCHAR(50), -- 'lockout', 'feature_loss', 'data_loss', etc.
  probability INTEGER,
  severity VARCHAR(20),
  explanation TEXT,
  created_at TIMESTAMP
);

-- Health Certificates
CREATE TABLE health_certificates (
  session_id UUID REFERENCES shadow_genius_sessions(id),
  platform VARCHAR(50),
  certificate_data JSONB,
  certificate_hash VARCHAR(64),
  customer_viewable BOOLEAN,
  created_at TIMESTAMP
);

-- Immutable Ledger
CREATE TABLE shadow_genius_ledger (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES shadow_genius_sessions(id),
  action_type VARCHAR(100),
  action_data JSONB,
  technician_id UUID,
  timestamp TIMESTAMP,
  hash VARCHAR(64) -- Immutable verification
);
```

---

## API ENDPOINTS

### Apple Endpoints
```
POST /api/v1/shadow-genius/apple/diagnostics
POST /api/v1/shadow-genius/apple/trust-check
POST /api/v1/shadow-genius/apple/stress-tests
GET  /api/v1/shadow-genius/apple/certificate/:sessionId
```

### Android Endpoints
```
POST /api/v1/shadow-genius/android/diagnostics
POST /api/v1/shadow-genius/android/oem-profile
POST /api/v1/shadow-genius/android/stress-tests
GET  /api/v1/shadow-genius/android/certificate/:sessionId
```

### Windows Endpoints
```
POST /api/v1/shadow-genius/windows/diagnostics
POST /api/v1/shadow-genius/windows/firmware-check
POST /api/v1/shadow-genius/windows/stress-tests
GET  /api/v1/shadow-genius/windows/certificate/:sessionId
```

### Console Endpoints
```
POST /api/v1/shadow-genius/consoles/diagnostics
POST /api/v1/shadow-genius/consoles/ban-risk
POST /api/v1/shadow-genius/consoles/stress-tests
GET  /api/v1/shadow-genius/consoles/certificate/:sessionId
```

### Unified Endpoints
```
GET  /api/v1/shadow-genius/sessions/:sessionId
GET  /api/v1/shadow-genius/ledger/:sessionId
POST /api/v1/shadow-genius/decision/:sessionId
```

---

## UI FLOW INTEGRATION

### New Tab: "Shadow Genius Bar"

**Navigation:** Main menu → Shadow Genius Bar

**Flow:**
1. **Platform Selection** (Apple / Android / Windows / Console)
2. **Intake Wizard** (device info, consent, boundaries)
3. **Diagnostics Panel** (SGDE execution, real-time results)
4. **Trust Gate** (auto-block if risk detected)
5. **Stress Test Runner** (automated, logged)
6. **Decision Matrix** (SAFE/RISK/STOP with explanation)
7. **Repair Approval** (if SAFE or RISK with disclosure)
8. **Post-Validation** (mandatory rerun)
9. **Certificate Generation** (auto, immutable)
10. **Ledger View** (complete history)

---

## OBSERVABILITY INTEGRATION

### Universal Legend Status Metrics

**New Metrics:**
- `shadow_genius_sessions_total` (by platform)
- `shadow_genius_decisions_total` (by decision type)
- `shadow_genius_trust_scores` (histogram)
- `shadow_genius_health_scores` (histogram)
- `shadow_genius_stress_test_duration` (by test type)
- `shadow_genius_override_count` (by tier)

**New Traces:**
- `shadow_genius.session.lifecycle`
- `shadow_genius.diagnostics.execution`
- `shadow_genius.stress_test.execution`
- `shadow_genius.decision.generation`

**New Logs:**
- Structured JSON logs for all SGDE operations
- Risk assessment logs
- Certificate generation logs
- Ledger entries

---

## SECRET ROOMS INTEGRATION

### New Room: "Shadow Genius Command Center"

**Purpose:** Central hub for all Shadow Genius operations

**Features:**
- Real-time session monitoring
- Platform-specific dashboards
- Certificate archive
- Ledger explorer
- Staff certification management
- SOP enforcement status

---

## WORKFLOW ENGINE INTEGRATION

Shadow Genius workflows plug into existing workflow engine:

```json
{
  "id": "shadow-genius-apple-full",
  "name": "Shadow Genius - Apple Full Diagnostic",
  "platform": "apple",
  "steps": [
    {
      "type": "shadow-genius-intake",
      "config": { "platform": "apple" }
    },
    {
      "type": "sgde-apple",
      "config": { "modules": ["identity", "sensors", "calibration", "pairing", "trust"] }
    },
    {
      "type": "trust-gate",
      "config": { "platform": "apple", "threshold": 70 }
    },
    {
      "type": "stress-tests",
      "config": { "tests": ["fcp", "logic"] }
    },
    {
      "type": "decision-matrix",
      "config": { "platform": "apple" }
    }
  ]
}
```

---

## BOOTFORGEUSB INTEGRATION

BootForgeUSB already provides:
- USB device enumeration
- Evidence-based detection
- Platform hint classification

**Shadow Genius extends this with:**
- Platform-specific deep diagnostics
- Trust chain verification
- Stress test orchestration
- Health scoring

**Integration point:** `server/routes/v1/shadow-genius/*` calls BootForgeUSB for device detection, then runs platform-specific SGDE modules.

---

## SHADOW LOGGER INTEGRATION

All Shadow Genius operations log to Shadow Logger:

```javascript
await shadowLogger.logShadow({
  category: 'shadow-genius',
  platform: 'apple',
  sessionId: session.id,
  action: 'sgde-execution',
  result: sgdeResult,
  riskAssessment: riskEngine.assess(sgdeResult),
  encrypted: true
});
```

---

## CERTIFICATION SYSTEM INTEGRATION

### New User Roles

**Location:** `server/routes/v1/auth/roles.js`

```javascript
const SHADOW_GENIUS_ROLES = {
  SGC_I: 'shadow-genius-intake',      // Tier I
  SGC_II: 'shadow-genius-diagnostics', // Tier II
  SGC_III: 'shadow-genius-authority'   // Tier III
};
```

**Enforcement:** Middleware checks certification tier before allowing actions.

---

## DEPLOYMENT PLAN

### Phase 1: Apple Integration (Week 1-2)
- SGDE-A backend routes
- Apple diagnostics UI
- Trust gate enforcement
- FCP + Logic stress tests

### Phase 2: Android Integration (Week 3-4)
- SGDE-Android backend routes
- Android diagnostics UI
- OEM profiling
- Camera/GPU/Modem stress tests

### Phase 3: Windows + Consoles (Week 5-6)
- SGDE-W + SGDE-C backend routes
- Windows/Console diagnostics UI
- Firmware/ban-risk checks
- Platform-specific stress tests

### Phase 4: Unified Dashboard (Week 7-8)
- Multi-platform intake
- Unified decision matrix
- Certificate generation
- Ledger viewer

### Phase 5: SOP Enforcement (Week 9-10)
- Gate enforcement middleware
- Role-based UI locking
- Override logging
- Certification management

---

## SUCCESS METRICS

- **Diagnostic Accuracy:** >95% correct SAFE/RISK/STOP decisions
- **Stress Test Reliability:** Repeatable results within 5%
- **Certificate Generation:** 100% automated, 0 manual edits
- **Override Rate:** <2% of sessions (trending down)
- **Customer Satisfaction:** Health certificates reduce disputes by 80%

---

**Status:** 🔒 INTEGRATION BLUEPRINT COMPLETE  
**Next:** Implementation Phase 1 (Apple Integration)
