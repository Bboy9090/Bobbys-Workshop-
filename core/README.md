# Phoenix Core — Backend Infrastructure

This directory contains the core backend APIs, libraries, and task management for Phoenix Forge.

## Architecture

```
core/
├── api/               # API handlers for REST endpoints
│   └── trapdoor.js    # Trapdoor contextual operations API
├── catalog/           # Operation definitions and metadata
│   ├── operation-loader.js
│   └── operations/    # Individual operation specs (JSON)
├── lib/               # Core libraries
│   ├── adb.js              # Android Debug Bridge integration
│   ├── api-envelope.ts     # Type-safe API response wrapper
│   ├── authority-router.js # 🔥 Operation routing table
│   ├── fastboot.js         # Fastboot protocol handler
│   ├── ios.js              # iOS device integration
│   ├── memory-persistence.js # 🔥 Persistent memory layer
│   ├── operation-envelope.js # Operation wrapper
│   ├── policy-evaluator.js # Role-based authorization
│   ├── power-star.js       # 🔥 Multi-factor verification
│   ├── shadow-logger.js    # Encrypted audit logging
│   └── workflow-validator.js # Workflow validation
└── tasks/             # Background task execution
    └── workflow-engine.js
```

## 🔥 Legendary Core Stack

### Authority Router (`lib/authority-router.js`)

Centralized routing table for all system operations. Determines which subsystem handles each request based on:
- Operation type (diagnostic, flash, unlock, etc.)
- Device state and mode
- User permissions and role
- Context conditions

```javascript
import { routeOperation, AUTHORITY_DOMAINS } from './lib/authority-router.js';

const result = routeOperation('flash.boot', {
  role: 'admin',
  device: { id: 'ABC123', mode: 'fastboot' }
});

// result.domain === AUTHORITY_DOMAINS.BOOTFORGE
// result.requiresConfirmation === true
```

**Authority Domains:**
- `REFORGE_OS` - Surface layer, standard user operations
- `WORKBENCH` - Operator layer, technician tools
- `CODEX` - Analysis and recommendations
- `PHOENIX_KEYS` - Special unlock capabilities
- `TRAPDOOR` - Contextual hidden operations
- `BOOTFORGE` - Direct hardware communication

### Memory Persistence (`lib/memory-persistence.js`)

Persistent memory layer that survives restarts while providing fast in-memory access:

```javascript
import { getPhoenixMemory } from './lib/memory-persistence.js';

const memory = getPhoenixMemory();

// Device state persistence
memory.setDeviceState('ABC123', { model: 'Pixel 8', mode: 'adb' });
const state = memory.getDeviceState('ABC123');

// Session management
memory.setSession('session_001', { operatorId: 'tech1', role: 'admin' });

// Operation history
memory.recordOperation({ type: 'flash', deviceId: 'ABC123', success: true });
const history = memory.getOperationHistory({ deviceId: 'ABC123', limit: 50 });

// Auto-save and cleanup happen automatically
```

**Namespaces:**
- `devices` - Device state persistence
- `sessions` - Active session data (24h TTL)
- `operations` - Operation history (30d TTL)
- `cache` - Frequently accessed data
- `preferences` - User preferences
- `workflows` - Workflow state

### Power Star Verification (`lib/power-star.js`)

Multi-factor verification system for high-privilege operations:

```javascript
import { requestPowerStar, verifyPowerStar, getPowerStarManager } from './lib/power-star.js';

// Request a Power Star for a sensitive operation
const result = requestPowerStar('flash.boot', operationSpec, {
  role: 'admin',
  device: { serial: 'ABC123' }
});

if (result.required) {
  // User must complete challenges
  const star = result.star;
  
  // Complete each challenge
  const manager = getPowerStarManager();
  manager.completeChallenge(star.id, challengeId, response, 'operator1');
  
  // Verify star is ready
  const verification = verifyPowerStar(star.id, 'flash.boot', 'ABC123');
  if (verification.valid) {
    // Execute operation
    manager.consumeStar(star.id);
  }
}
```

**Challenge Types:**
- `CONFIRM` - Simple confirmation
- `DEVICE_SERIAL` - Device serial match
- `PASSCODE` - Passcode entry
- `TIME_LOCK` - Time-delayed approval
- `DUAL_OPERATOR` - Second operator approval
- `KNOWLEDGE` - Operation understanding check

## Existing Libraries

### Policy Evaluator (`lib/policy-evaluator.js`)

Role-based authorization engine for all operations:

```javascript
import { evaluatePolicy, ROLES, RISK_LEVELS } from './lib/policy-evaluator.js';

const result = evaluatePolicy(ROLES.TECHNICIAN, operationSpec);
// result.allowed, result.reason, result.requiresConfirmation
```

### Shadow Logger (`lib/shadow-logger.js`)

Encrypted audit logging for sensitive operations using AES-256-GCM:

```javascript
import ShadowLogger from './lib/shadow-logger.js';

const logger = new ShadowLogger();
await logger.logShadow({
  operation: 'flash.boot',
  deviceSerial: 'ABC123',
  success: true,
  metadata: { duration: 45000 }
});
```

## Security Model

1. **Authorization First** - All operations require role-based policy evaluation
2. **Authority Routing** - Operations routed to appropriate subsystem based on context
3. **Power Star Verification** - Sensitive operations require multi-factor challenges
4. **Audit Trail** - All operations logged with encryption
5. **Memory Persistence** - State survives restarts with TTL-based expiration

## Integration

The core libraries integrate with:
- **Server** (`/server`) - Express API endpoints
- **Frontend** (`/src`) - React UI components
- **BootForge USB** (`/crates/bootforge-usb`) - Rust hardware layer
- **Python Backend** (`/python`) - Specialized services
