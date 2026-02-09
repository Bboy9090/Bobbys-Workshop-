# 🔐 PHOENIX KEY / BOOTFORGE
## Trust & Key Architecture v1.0

**Status:** Institution-Grade Design  
**Date:** 2025-01-27  
**Authority:** Phoenix Forge Holdings

---

## I. TRUST HIERARCHY (THE CROWN STRUCTURE)

### Four-Tier Key Model

```
ROOT KEY
 └── ISSUER KEY(S)
      └── ENVIRONMENT KEYS
           └── LICENSE TOKENS
```

Each layer has strict limits.

---

## II. KEY DEFINITIONS

### 1. ROOT SIGNING KEY (ABSOLUTE AUTHORITY)

**Purpose:**
- Signs Issuer Keys only
- Never signs licenses
- Never touches production systems

**Properties:**
- Generated offline
- Stored offline (air-gapped)
- Used rarely
- Rotation extremely rare

**If compromised:**
→ Entire trust chain must be re-established

---

### 2. LICENSE ISSUER KEYS (OPERATIONAL AUTHORITY)

**Purpose:**
- Sign licenses
- Can be revoked
- Can be rotated

**Properties:**
- One per major generation
- Stored in hardened environment
- Delegated by Root Key

**Why this exists:**
- Stripe compromise ≠ total collapse
- Operator mistake ≠ platform death

---

### 3. ENVIRONMENT KEYS (SCOPED CONTROL)

**Purpose:**
- Bind licenses to environment intent
- Prevent cross-environment abuse

**Examples:**
- PROD
- STAGING
- AIRGAP
- OEM

A PROD key cannot issue AIRGAP licenses.

---

### 4. LICENSE TOKENS (USER-LEVEL AUTHORITY)

**Purpose:**
- Grant feature access
- Portable
- Offline verifiable

**Contains:**
- Tier
- Seats
- Capabilities
- Expiry
- Org ID
- Issuer ID
- Environment
- Signature

---

## III. CRYPTOGRAPHIC CHOICES

| Use | Algorithm | Reason |
|-----|-----------|--------|
| Root / Issuer | Ed25519 | Modern, fast, safe |
| License Tokens | Ed25519 or HMAC-SHA256 | Offline & deterministic |
| Audit Sealing | SHA-256 | Proven, portable |

**You do not invent crypto.**

---

## IV. KEY STORAGE DOCTRINE

### Root Key
- Stored offline
- Never committed
- Never loaded into runtime

### Issuer Keys
- Encrypted at rest
- Loaded only in licensing service
- Rotatable without breaking old licenses

### Public Keys
- Shipped with binaries
- Versioned
- Immutable per release

---

## V. KEY ROTATION STRATEGY

### Rotation Without Collapse

Each license includes:

```json
{
  "issuer_id": "issuer-2026-01",
  "env": "PROD"
}
```

**Verification:**
1. Read issuer_id
2. Load corresponding public key
3. Verify signature

**Old keys remain valid until revoked.**

---

## VI. REVOCATION MODEL

### What Can Be Revoked
- Issuer key
- License token
- Capability subset

### What Cannot
- Root key silently
- User's access to their data

### Revocation Delivery
- Online: sync list
- Offline: bundled revocation file
- USB: manual import supported

**No phoning home required.**

---

## VII. EMERGENCY KILL-SWITCH

### Emergency Revoke Key
- Separate from Root
- Cold storage
- Can invalidate:
  - Issuer keys
  - Entire license generations

### Used only if:
- Issuer fully compromised
- Legal mandate
- Catastrophic breach

**Every activation is auditable and public.**

---

## VIII. OFFLINE SURVIVABILITY

A Phoenix Key USB must:

- Validate licenses with embedded public keys
- Honor expiry + grace
- Honor revocation bundles
- Never brick tools due to connectivity

**Offline is first-class, not fallback.**

---

## IX. VERIFICATION FLOW (ALL SURFACES)

```
Load license token
↓
Read issuer_id
↓
Load public key
↓
Verify signature
↓
Check revocation
↓
Check expiry / grace
↓
Authorize features
```

**No shortcut. No UI override.**

---

## X. FAILURE MODES

| Failure | Behavior |
|---------|----------|
| Expired | Grace → degrade |
| Revoked | Feature lock |
| Unknown issuer | Reject |
| Missing license | Free tier |
| Clock skew | Grace tolerance |

**Nothing explodes. Nothing bricks.**

---

**Status:** 🔒 TRUST ARCHITECTURE LOCKED  
**Next:** Implementation in /core/trust/
