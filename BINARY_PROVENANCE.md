# 📦 PHOENIX KEY / BOOTFORGE
## Binary Provenance & Build Integrity v1.0

**Status:** Release Law  
**Date:** 2025-01-27

---

## I. RELEASE LAW (ABSOLUTE)

🚫 **NOTHING SHIPS UNLESS:**

- Source is versioned
- Build is deterministic
- Provenance is embedded
- Artifact is sealed
- Authority is traceable

**Unsigned or unsealed artifacts are untrusted by definition.**

---

## II. CANONICAL PROVENANCE OBJECT

Every artifact embeds this machine-readable record:

**`/build/provenance/provenance.json`**

```json
{
  "product": "Phoenix Key",
  "edition": "BootForge",
  "version": "1.0.0",
  "build_id": "2026.01.21.001",
  "git_commit": "a91f3e2c9",
  "git_branch": "main",
  "build_env": "PROD",
  "builder": "github-actions",
  "built_at": "2026-01-21T03:12:44Z",
  "core_hash": "sha256:...",
  "entitlement_matrix_hash": "sha256:...",
  "public_keys": [
    "issuer-2026-01.pub"
  ],
  "signed": true
}
```

**This file:**
- Lives inside the ISO
- Is readable offline
- Is immutable after build

---

## III. DETERMINISTIC BUILD RULES

### Required Properties
- Fixed dependency versions
- Locked OS image version
- Ordered file operations
- Explicit timestamps (UTC)
- No randomness

### Practical Enforcement
- `package-lock.json` / `poetry.lock`
- Fixed SystemRescue version
- Sorted file copy
- Explicit build time injection

**If two builds differ → build pipeline is invalid.**

---

## IV. BUILD PIPELINE (AUTHORITATIVE)

```
git commit
↓
CI build
↓
core hash computed
↓
provenance.json generated
↓
artifact sealed
↓
signature applied
↓
release published
```

**Human machines do not publish production artifacts.**

---

## V. ARTIFACT SEALING

### Seal Algorithm
SHA-256 over:
- Entire ISO
- provenance.json
- entitlement matrix
- public keys

### Output
- `PhoenixKey.iso`
- `PhoenixKey.iso.seal`
- `PhoenixKey.iso.sig`

### Verification (offline)
```bash
sha256sum -c PhoenixKey.iso.seal
```

---

## VI. SIGNING AUTHORITY

### Signing Rules
- Only Issuer Keys sign artifacts
- Root Key never signs binaries
- Public keys embedded per release
- Old releases remain verifiable forever

**Revocation invalidates future trust, not history.**

---

## VII. RELEASE CHANNELS

| Channel | Use |
|---------|-----|
| DEV | Internal |
| STAGING | Validation |
| PROD | Customers |
| OEM | Locked partners |
| AIRGAP | USB / gov |

**Artifacts cannot cross channels silently.**

---

## VIII. VERSIONING LAW

### Semantic + Epoch
`<epoch>.<major>.<minor>`

**Example:**
- `1.0.0` → first stable
- `2.0.0` → trust model change

**Epoch increments on breaking trust changes**

---

## IX. VERIFICATION TOOLS

Phoenix Key must include:

- `phoenix verify`
- `phoenix provenance`
- `phoenix seal verify`

**Users can verify you. That's confidence.**

---

## X. FAILURE MODES

| Scenario | Outcome |
|----------|---------|
| Missing provenance | Reject |
| Invalid seal | Warn + restrict |
| Unknown signer | Reject |
| Tampered ISO | Refuse boot (configurable) |
| Offline | Full verification still works |

**No surprises.**

---

**Status:** 🔒 PROVENANCE SYSTEM LOCKED  
**Next:** Build script integration
