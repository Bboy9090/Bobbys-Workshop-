# Trapdoor Admin Architecture - Integration Guide

**Date:** 2024-12-27  
**Status:** Fully Integrated

## ✅ Integration Complete

The Trapdoor Admin Architecture has been fully integrated with Bobby's Workshop backend. All new Secret Rooms (Sonic, Ghost, Pandora) are connected and ready for implementation.

## 🏗️ Architecture Overview

```
Backend Server (Express)
├── /api/v1/trapdoor/
│   ├── /execute          → Policy-enforced operation execution
│   ├── /simulate         → Dry-run operation simulation
│   ├── /operations       → List available operations
│   ├── /unlock           → Unlock Chamber (existing)
│   ├── /flash            → Flash Forge (existing)
│   ├── /ios              → Jailbreak Sanctum (existing)
│   ├── /root             → Root Vault (existing)
│   ├── /bypass           → Bypass Laboratory (existing)
│   ├── /workflows        → Workflow Engine (existing)
│   ├── /logs             → Shadow Archive (existing)
│   ├── /sonic            → Sonic Codex (NEW)
│   ├── /ghost            → Ghost Codex (NEW)
│   └── /pandora          → Pandora Codex (NEW)
```

## 🔐 Authentication Flow

All Trapdoor endpoints use the existing `requireTrapdoorPasscode` middleware:

```javascript
// All routes protected by:
router.use('/trapdoor', rateLimiter('trapdoor'), requireTrapdoorPasscode, trapdoorRouter);
```

**Authentication Methods:**
- `X-Secret-Room-Passcode` header
- `X-Trapdoor-Passcode` header
- `X-API-Key` header (for new execute/simulate endpoints)

## 📡 New Endpoints

### 1. Execute Operations (Policy-Enforced)

```bash
POST /api/v1/trapdoor/execute
Headers: {
  "X-Secret-Room-Passcode": "your-passcode",
  "Content-Type": "application/json"
}
Body: {
  "operation": "reboot_device",
  "params": {
    "deviceSerial": "ABC123",
    "mode": "system"
  },
  "correlationId": "optional-id"
}
```

**Response:** Operation envelope with execution results

### 2. Simulate Operations (Dry-Run)

```bash
POST /api/v1/trapdoor/simulate
Headers: {
  "X-Secret-Room-Passcode": "your-passcode",
  "Content-Type": "application/json"
}
Body: {
  "operation": "reboot_device",
  "params": {
    "deviceSerial": "ABC123"
  }
  }
}
```

**Response:** Simulation envelope with policy checks and validation results

### 3. List Available Operations

```bash
GET /api/v1/trapdoor/operations
Headers: {
  "X-Secret-Room-Passcode": "your-passcode"
}
```

**Response:** List of operations available for the authenticated role

## 🎯 Secret Rooms

### Sonic Codex (Audio Processing)

**Endpoints:**
- `POST /api/v1/trapdoor/sonic/capture` - Capture audio
- `POST /api/v1/trapdoor/sonic/transcribe` - Whisper transcription
- `POST /api/v1/trapdoor/sonic/enhance` - Forensic enhancement
- `POST /api/v1/trapdoor/sonic/diarize` - Speaker diarization

**Status:** Routes created, implementation pending

### Ghost Codex (Privacy Tools)

**Endpoints:**
- `POST /api/v1/trapdoor/ghost/shred` - Metadata shredding
- `POST /api/v1/trapdoor/ghost/canary` - Canary token generation
- `POST /api/v1/trapdoor/ghost/persona` - Burner persona creation
- `POST /api/v1/trapdoor/ghost/partition` - Hidden partition management

**Status:** Routes created, implementation pending

### Pandora Codex (Hardware Manipulation)

**Endpoints:**
- `POST /api/v1/trapdoor/pandora/chainbreaker` - Chain-Breaker operations
- `POST /api/v1/trapdoor/pandora/dfu` - DFU mode detection/manipulation
- `POST /api/v1/trapdoor/pandora/manipulate` - Hardware manipulation
- `POST /api/v1/trapdoor/pandora/jailbreak` - Jailbreak automation

**Status:** Routes created, implementation pending

## 🔧 Operation Catalog System

### Adding New Operations

1. **Create Operation Specification**

Create a JSON file in `core/catalog/operations/`:

```json
{
  "operation": "your_operation_id",
  "displayName": "Your Operation Name",
  "description": "What this operation does",
  "category": "safe|diagnostics|backup|restore|destructive",
  "riskLevel": "low|medium|high|destructive",
  "requiresConfirmation": false,
  "allowedRoles": ["owner", "admin", "technician"],
  "requiredCapabilities": ["adb"],
  "parameters": {
    "deviceSerial": {
      "type": "string",
      "required": true,
      "pattern": "^[A-Za-z0-9]{6,20}$"
    }
  },
  "auditLogging": "standard",
  "rateLimitPerMinute": 10
}
```

2. **Operation is Automatically Available**

The operation loader will automatically discover and load your operation spec.

3. **Implement Handler**

Add execution logic in `server/routes/v1/trapdoor/operations.js`:

```javascript
async function executeOperation(operation, params, operationSpec) {
  switch (operation) {
    case 'your_operation_id':
      return await yourOperationHandler(params);
    // ... other operations
  }
}
```

## 🛡️ Security Features

### Policy Enforcement

All operations go through policy evaluation:

1. **Role Check** - User role must be in `allowedRoles`
2. **Category Permission** - Role must have permission for operation category
3. **Risk Level** - Destructive operations require confirmation
4. **Parameter Validation** - All parameters validated against schema

### Shadow Logging

All operations are logged to encrypted shadow logs:

- Operation request
- Policy evaluation results
- Execution results
- Errors and failures

### Rate Limiting

- Trapdoor API: 20 requests/minute
- Per-endpoint limits configurable in operation specs

## 📝 Example Usage

### Execute a Safe Operation

```bash
curl -X POST http://localhost:3001/api/v1/trapdoor/execute \
  -H "X-Secret-Room-Passcode: your-passcode" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "reboot_device",
    "params": {
      "deviceSerial": "ABC123",
      "mode": "system"
    }
  }'
```

### Simulate Before Execution

```bash
curl -X POST http://localhost:3001/api/v1/trapdoor/simulate \
  -H "X-Secret-Room-Passcode: your-passcode" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "reboot_device",
    "params": {
      "deviceSerial": "ABC123"
    }
  }'
```

### List Available Operations

```bash
curl http://localhost:3001/api/v1/trapdoor/operations \
  -H "X-Secret-Room-Passcode: your-passcode"
```

## 🚀 Next Steps

### Immediate (Ready to Implement)

1. **Operation Handlers** - Connect operations to actual device manipulation
2. **Sonic Codex** - Implement audio capture and Whisper integration
3. **Ghost Codex** - Implement metadata shredding and privacy tools
4. **Pandora Codex** - Implement hardware manipulation and jailbreak automation

### Short Term

1. **Workflow Engine Integration** - Connect complex operations to workflow system
2. **Provider Modules** - Enhance ADB, Fastboot, iOS providers with validation
3. **Frontend UI** - Build Pandora Room interface components

### Long Term

1. **JWT Authentication** - Replace API key with proper JWT tokens
2. **Session Management** - Implement session-based authentication
3. **Advanced Policies** - Time-based, device-based policy rules
4. **Operation Streaming** - Real-time progress for long-running operations

## 📚 Related Documentation

- [Trapdoor Admin Architecture](./TRAPDOOR_ADMIN_ARCHITECTURE.md) - Complete architecture spec
- [Trapdoor Implementation Status](./TRAPDOOR_IMPLEMENTATION_STATUS.md) - Current status
- [Operation Envelopes](../OPERATION_ENVELOPES.md) - Envelope format
- [Bobby's Secret Rooms](../BOBBYS_SECRET_ROOMS.md) - User documentation

## ✅ Integration Checklist

- [x] Policy Evaluator module created
- [x] Operation Envelope system created
- [x] Authentication middleware created
- [x] Trapdoor API routes created
- [x] Operation catalog system created
- [x] Operation loader implemented
- [x] Sonic Codex routes created
- [x] Ghost Codex routes created
- [x] Pandora Codex routes created
- [x] Integration with existing trapdoor router
- [x] Shadow logging integration
- [x] Rate limiting configured
- [ ] Operation execution handlers (pending implementation)
- [ ] Frontend UI components (pending)
- [ ] Provider module enhancements (pending)

## 🎯 Status Summary

**Backend Integration:** ✅ Complete  
**Routes:** ✅ All created and registered  
**Authentication:** ✅ Integrated with existing system  
**Policy System:** ✅ Fully functional  
**Operation Catalog:** ✅ Ready for expansion  
**Implementation:** 🚧 Pending (handlers need implementation)

The architecture is **fully integrated and ready for operation handler implementation**.
