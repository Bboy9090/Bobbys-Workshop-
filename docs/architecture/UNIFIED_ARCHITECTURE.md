# 🏗️ BOBBY'S WORKSHOP - UNIFIED ARCHITECTURE
## Complete System Architecture Specification

**Version:** 1.0  
**Status:** Architecture Blueprint  
**Last Updated:** 2025-01-27

---

## 📋 EXECUTIVE SUMMARY

This document defines the complete unified architecture for Bobby's Workshop, combining:
- **Trapdoor Admin Architecture** - Secure, auditable privileged operations
- **Secret Rooms System** - 10 specialized rooms with Codex services
- **Space Jam + 90s Hip-Hop Design** - Legendary visual identity
- **Modular Component System** - Reusable, composable UI elements
- **FastAPI Backend Services** - Sonic, Ghost, Pandora Codex

---

## 🎯 ARCHITECTURAL PRINCIPLES

### Core Principles

1. **Legal Operations Only** - No bypass/exploit/evasion features
2. **Strict Separation** - Admin endpoints isolated from normal UI
3. **Explicit Authorization** - Role-based access with operation allowlists
4. **Complete Auditability** - All operations logged with shadow encryption
5. **Defensive by Default** - Input validation, path safety, rate limiting
6. **Modular Design** - Composable components and services
7. **Design System** - Unified visual identity across all features

---

## 🏗️ SYSTEM ARCHITECTURE

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Normal     │  │  Secret      │  │   Shadow     │          │
│  │   Tabs       │  │  Rooms       │  │   Logs       │          │
│  │              │  │  (10 Rooms)  │  │   Viewer     │          │
│  │  • Dashboard │  │  • Unlock    │  │              │          │
│  │  • Devices   │  │  • Flash     │  │  • Encrypted │          │
│  │  • Flashing  │  │  • Jailbreak │  │  • Analytics │          │
│  │  • Settings  │  │  • Root      │  │  • Export    │          │
│  │              │  │  • Bypass    │  │              │          │
│  │              │  │  • Workflow  │  │              │          │
│  │              │  │  • Archive   │  │              │          │
│  │              │  │  • Sonic     │  │              │          │
│  │              │  │  • Ghost     │  │              │          │
│  │              │  │  • Pandora   │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          │ Public API       │ Admin API        │ Admin Read
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   /api/*     │  │/api/trapdoor/│  │ /api/logs/   │          │
│  │  (Public)    │  │   (Admin)    │  │   (Admin)    │          │
│  │              │  │              │  │              │          │
│  │  • Catalog   │  │  • Execute   │  │  • Shadow    │          │
│  │  • Devices   │  │  • Simulate  │  │  • Analytics │          │
│  │  • Tools     │  │  • Operations│  │  • Export    │          │
│  │  • Workflows │  │  • Secret    │  │              │          │
│  │              │  │    Rooms     │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                 │                   │
│         │                  ▼                 │                   │
│         │          ┌───────────────┐         │                   │
│         │          │ requireAdmin  │         │                   │
│         │          │  Middleware   │         │                   │
│         │          └───────┬───────┘         │                   │
└─────────┼──────────────────┼─────────────────┼───────────────────┘
          │                  │                 │
          ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CORE OPERATIONS LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Catalog    │  │   Workflow   │  │    Shadow    │          │
│  │    API       │  │    Engine    │  │   Logger     │          │
│  │              │  │              │  │              │          │
│  │  • Load ops  │  │  • Execute   │  │  • AES-256   │          │
│  │  • List ops  │  │  • Steps     │  │  • Append    │          │
│  │  • Metadata  │  │  • Validate  │  │  • Rotate    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                 │                   │
│         │  ┌───────────────┴─────┐          │                   │
│         │  │  Policy Evaluator   │          │                   │
│         │  │  (Role + Operation) │          │                   │
│         │  └─────────────────────┘          │                   │
└─────────┼───────────────────────────────────┼───────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PROVIDER LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   ADB    │  │ Fastboot │  │   iOS    │  │  File    │        │
│  │ Provider │  │ Provider │  │ Provider │  │ System   │        │
│  │          │  │          │  │          │  │ Provider │        │
│  │ • Detect │  │ • Flash  │  │ • DFU    │  │ • Read   │        │
│  │ • Execute│  │ • Unlock │  │ • Restore│  │ • Write  │        │
│  │ • Shell  │  │ • Reboot │  │ • Backup │  │ • Validate│       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼──────────────┼──────────────┘
        │             │             │              │
        ▼             ▼             ▼              ▼
   Android        Bootloader       iOS         Filesystem
   Devices        Mode            Devices

┌─────────────────────────────────────────────────────────────────┐
│                  FASTAPI CODEX SERVICES                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  Sonic   │  │  Ghost   │  │ Pandora  │                      │
│  │  Codex   │  │  Codex   │  │  Codex   │                      │
│  │          │  │          │  │          │                      │
│  │ • Audio  │  │ • Metadata│  │ • Hardware│                    │
│  │ • Transcribe│ • Shredder│  │ • DFU    │                    │
│  │ • Enhance│  │ • Canary │  │ • Jailbreak│                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
└───────┼─────────────┼──────────────┼────────────────────────────┘
        │             │              │
        ▼             ▼              ▼
   Audio           Privacy        Hardware
   Processing      Tools          Manipulation
```

---

## 🔐 AUTHORIZATION MODEL

### Role Hierarchy

```
Owner (Highest Privilege)
  ├─ All capabilities enabled
  ├─ Execute destructive operations
  ├─ Access all logs and audits
  └─ Manage technician accounts

Admin (High Privilege)
  ├─ Execute most operations
  ├─ Access shadow logs
  ├─ Cannot modify system settings
  └─ Cannot create new admin accounts

Technician (Standard Privilege)
  ├─ Diagnostics and inspections
  ├─ Low to medium risk operations
  ├─ Cannot execute destructive operations
  └─ Read-only log access

Viewer (Read-Only)
  ├─ View device information
  ├─ Read public logs
  ├─ Cannot execute operations
  └─ Cannot access shadow logs
```

### Operation Allowlists

Each operation has an explicit allowlist:

```json
{
  "operation": "reboot_device",
  "displayName": "Reboot Device",
  "category": "safe",
  "riskLevel": "low",
  "requiresConfirmation": false,
  "allowedRoles": ["owner", "admin", "technician"],
  "requiredCapabilities": ["adb"],
  "auditLogging": "standard",
  "rateLimitPerMinute": 10
}
```

### Risk Levels

1. **Low** - Read-only operations, no state changes
2. **Medium** - Reversible state changes
3. **High** - Data modifications, limited reversibility
4. **Destructive** - Permanent changes, cannot be undone

---

## 🏛️ SECRET ROOMS ARCHITECTURE

### Room Structure

Each Secret Room has:
- **UI Component** - React component in `src/components/trapdoor/`
- **Backend Route** - Express route in `server/routes/v1/trapdoor/`
- **Operation Handlers** - Logic in `core/lib/` or FastAPI
- **API Endpoints** - REST endpoints with authentication
- **Theme Styling** - Jordan colorway based on risk level

### 10 Secret Rooms

| Room | Purpose | Risk | Theme | API Route |
|------|---------|------|-------|-----------|
| Unlock Chamber | Device unlock | High | Jordan Bred | `/api/v1/trapdoor/unlock` |
| Flash Forge | Multi-brand flash | High | Jordan Space Jam | `/api/v1/trapdoor/flash` |
| Jailbreak Sanctum | iOS manipulation | High | Jordan Concord | `/api/v1/trapdoor/ios` |
| Root Vault | Root management | Medium | Jordan Royal | `/api/v1/trapdoor/root` |
| Bypass Laboratory | Security bypass | High | Jordan Bred | `/api/v1/trapdoor/bypass` |
| Workflow Engine | Workflow execution | Medium | Jordan Chicago | `/api/v1/trapdoor/workflows` |
| Shadow Archive | Operation history | Admin | Trap House | `/api/v1/trapdoor/logs` |
| Sonic Codex | Audio processing | Medium | Boom Bap | `/api/v1/trapdoor/sonic` |
| Ghost Codex | Privacy tools | Medium | Trap House | `/api/v1/trapdoor/ghost` |
| Pandora Codex | Hardware manipulation | High | Jordan Cement | `/api/v1/trapdoor/pandora` |

---

## 🎨 DESIGN SYSTEM ARCHITECTURE

### Theme Layers

```
Master Theme (master-theme.css)
  ├─ Space Jam Theme
  │   ├─ Colors (purple/orange)
  │   ├─ Components (header, nav, card)
  │   └─ Animations (bounce, glow)
  │
  ├─ 90s Hip-Hop Theme
  │   ├─ Baseball cards
  │   ├─ CD jewel cases
  │   ├─ Jordan colorways
  │   ├─ Boom bap panels
  │   ├─ Vinyl/cassette styles
  │   └─ Sound effects
  │
  ├─ NYC Playground Theme
  │   ├─ Concrete textures
  │   ├─ Graffiti effects
  │   └─ Trap house vibes
  │
  └─ Design Tokens
      ├─ Colors
      ├─ Typography
      ├─ Spacing
      └─ Motion
```

### Component System

```
Base Components
  ├─ SpaceJamHeader
  ├─ SpaceJamNav
  ├─ SpaceJamCard
  │
  ├─ DeviceCard (baseball card style)
  ├─ SettingsPanel (boom bap style)
  ├─ BackupCard (CD jewel case style)
  │
  └─ RiskButton (Jordan colorways)
      ├─ jordan-bred (high risk)
      ├─ jordan-chicago (medium risk)
      └─ jordan-royal (low risk)
```

---

## 📡 API ARCHITECTURE

### REST API Structure

```
/api/
  ├─ v1/
  │   ├─ catalog/              # Public catalog
  │   ├─ devices/              # Public device operations
  │   ├─ trapdoor/             # Admin operations
  │   │   ├─ execute           # Execute operation
  │   │   ├─ simulate          # Simulate operation
  │   │   ├─ operations        # List operations
  │   │   ├─ unlock            # Unlock Chamber
  │   │   ├─ flash              # Flash Forge
  │   │   ├─ ios                # Jailbreak Sanctum
  │   │   ├─ root               # Root Vault
  │   │   ├─ bypass             # Bypass Laboratory
  │   │   ├─ workflows          # Workflow Engine
  │   │   ├─ logs               # Shadow Archive
  │   │   ├─ sonic/             # Sonic Codex (proxy)
  │   │   ├─ ghost/             # Ghost Codex (proxy)
  │   │   └─ pandora/           # Pandora Codex (proxy)
  │   └─ logs/                  # Log access
```

### FastAPI Services

```
python/fastapi_backend/
  ├─ main.py                   # FastAPI app
  └─ modules/
      ├─ sonic/                # Sonic Codex
      │   ├─ routes.py
      │   ├─ job_manager.py
      │   └─ ...
      ├─ ghost/                # Ghost Codex
      │   ├─ routes.py
      │   ├─ shredder.py
      │   └─ ...
      └─ pandora/              # Pandora Codex
          ├─ routes.py
          ├─ detector.py
          └─ ...
```

### Operation Envelope System

All operations return standardized envelopes:

```typescript
interface OperationEnvelope {
  envelope: {
    type: 'inspect' | 'execute' | 'simulate' | 'policy-deny';
    version: string;
    timestamp: string;
    correlationId: string;
  };
  operation: {
    id: string;
    status: 'success' | 'failure' | 'denied' | 'partial';
    error?: {
      message: string;
      code: string;
      details?: any;
    };
  };
  data: any;
  metadata: Record<string, any>;
}
```

---

## 🔒 SECURITY ARCHITECTURE

### Security Layers

1. **Input Validation** - Schema validation (Zod/Yup)
2. **Authentication** - API keys, passcodes, JWT tokens
3. **Authorization** - Role-based access control
4. **Rate Limiting** - Request throttling
5. **Command Hardening** - Safe execution patterns
6. **Path Validation** - Prevent traversal attacks
7. **Timeout Enforcement** - Prevent hanging operations
8. **Output Sanitization** - Clean error messages
9. **Audit Logging** - Track all operations
10. **Encryption** - Protect sensitive logs (AES-256)

### Shadow Logging

- **Encryption**: AES-256-CBC
- **Format**: Append-only JSONL
- **Retention**: 90 days for shadow logs
- **Rotation**: Automatic daily rotation
- **Access**: Admin/Owner roles only

---

## 📁 FILE STRUCTURE

```
Bobbys-secret-Workshop-/
├── src/
│   ├── components/
│   │   ├── space-jam/          # Space Jam components
│   │   ├── trapdoor/           # Secret Rooms UI
│   │   └── SecretRoom/         # Room panels
│   ├── styles/
│   │   ├── space-jam-theme.css
│   │   ├── workshop-vibe.css
│   │   ├── design-tokens.css
│   │   └── master-theme.css    # Combined theme
│   └── lib/
│       └── soundManager.ts
├── server/
│   └── routes/
│       └── v1/
│           └── trapdoor/       # Admin routes
├── core/
│   ├── lib/                    # Providers
│   │   ├── adb.js
│   │   ├── fastboot.js
│   │   ├── ios.js
│   │   ├── shadow-logger.js
│   │   ├── policy-evaluator.js
│   │   └── operation-envelope.js
│   └── catalog/
│       └── operations/         # Operation specs
├── python/
│   └── fastapi_backend/        # Codex services
│       ├── main.py
│       └── modules/
│           ├── sonic/
│           ├── ghost/
│           └── pandora/
└── docs/
    ├── TRAPDOOR_ADMIN_ARCHITECTURE.md
    ├── MASTER_INTEGRATION_PLAN.md
    └── UNIFIED_ARCHITECTURE.md  # This file
```

---

## 🔄 DATA FLOW

### Operation Execution Flow

```
User Action
    │
    ▼
UI Component
    │
    ▼
API Request (with auth)
    │
    ▼
API Gateway (rate limit, auth)
    │
    ▼
Operation Handler
    │
    ├─→ Policy Evaluator (check permissions)
    │
    ├─→ Workflow Engine (execute steps)
    │
    ├─→ Provider (ADB/Fastboot/iOS)
    │
    └─→ Shadow Logger (audit log)
    │
    ▼
Operation Envelope (response)
    │
    ▼
UI Update
```

### Secret Room Access Flow

```
User Navigates to Secret Room
    │
    ▼
Trapdoor Entry Gate (authentication)
    │
    ├─→ Check Passcode/API Key
    │
    └─→ Rate Limit Check
    │
    ▼
Room Panel Render
    │
    ▼
Operation Request
    │
    ▼
API Route (Node.js or FastAPI proxy)
    │
    ├─→ Node.js Route (Express)
    │   └─→ Core Operations Layer
    │
    └─→ FastAPI Route (Sonic/Ghost/Pandora)
        └─→ FastAPI Service
    │
    ▼
Response (Operation Envelope)
    │
    ▼
UI Update
```

---

## 🚀 DEPLOYMENT ARCHITECTURE

### Application Structure

```
Desktop Application (Tauri)
  ├─ Frontend (React + Vite)
  │   └─ Runs in browser window
  │
  └─ Backend Services
      ├─ Node.js Server (Express)
      │   ├─ REST API
      │   ├─ WebSocket server
      │   └─ Device providers
      │
      └─ FastAPI Server (Python)
          ├─ Sonic Codex
          ├─ Ghost Codex
          └─ Pandora Codex
```

### Startup Sequence

1. Tauri app launches
2. Backend services start (Node.js + FastAPI)
3. Frontend connects to backend
4. Health checks complete
5. UI renders with device detection

---

## 📊 MONITORING & OBSERVABILITY

### Logging Levels

1. **Public Logs** - Standard application logs (30-day retention)
2. **Shadow Logs** - Encrypted audit logs (90-day retention)
3. **Operation Metrics** - Performance metrics (1-year retention)

### Metrics

- Operation execution times
- Success/failure rates
- Device connection/disconnection events
- API request rates
- Error rates by operation type

---

## 🔗 INTEGRATION POINTS

### External Dependencies

- **ADB/Fastboot** - Android device tools
- **libimobiledevice** - iOS device tools
- **FastAPI** - Python backend services
- **Tauri** - Desktop application framework
- **React** - UI framework
- **Tailwind CSS** - Styling framework

### Internal Integrations

- **Trapdoor API** ↔ **Core Operations Layer**
- **Core Operations** ↔ **Provider Layer**
- **Node.js API** ↔ **FastAPI Services** (proxied)
- **UI Components** ↔ **API Gateway**
- **Shadow Logger** ↔ **All Operations**

---

## 📝 NEXT STEPS

1. **Implement Master Theme** - Combine all theme files
2. **Complete Secret Rooms** - Finish all 10 room implementations
3. **Integrate Codex Services** - Wire FastAPI to UI
4. **Add Operation Handlers** - Implement all operation types
5. **Polish & Test** - Cross-browser, performance, accessibility

---

**Status:** Architecture Complete - Ready for Implementation  
**Legendary Level:** ARCHITECTURAL EXCELLENCE 🏗️🔥
