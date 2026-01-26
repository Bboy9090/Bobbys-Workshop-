# 💼 PHOENIX KEY / BOOTFORGE
## Enterprise Licensing, Orgs, Seats & Billing Law v1.0

**Status:** Commercial Law  
**Date:** 2025-01-27

---

## I. CORE PRINCIPLE (IMMUTABLE)

**Billing systems collect money.**
**Licensing systems grant authority.**
**They are never the same thing.**

Stripe, invoices, receipts — none of these decide access.

**Your system does.**

---

## II. LICENSING TIERS (FINAL, LOCKED)

### 🟢 FREE (Default, No Account Required)

- Core boot + recovery
- Manual operations
- Single-seat
- No automation
- No audit export
- Offline always allowed

**Purpose:** trust-building, survival use, ethics compliance.

### 🔵 PRO (Individual / Small Team)

- All tools unlocked
- Automation enabled
- Persistence & cloning
- Limited bulk operations
- Up to 5 seats
- Offline license file supported

**Purpose:** professionals, technicians, power users.

### 🟣 ENTERPRISE (Organization / Institution)

- Everything in Pro
- Organizations & teams
- Seat enforcement
- Audit export
- Bulk & scripted ops
- SLA eligibility
- Offline + airgap bundles
- Custom capabilities

**Purpose:** companies, governments, regulated environments.

---

## III. LICENSE OBJECT (CANONICAL)

Every license token must include:

```json
{
  "license_id": "lic-uuid",
  "subject": "user@org.com",
  "org_id": "org-uuid | null",
  "tier": "free | pro | enterprise",
  "seats": 1,
  "capabilities": ["bulk_ops", "audit_export"],
  "issued_at": 1700000000,
  "expires_at": 1730000000,
  "issuer_id": "issuer-2026-01",
  "env": "PROD"
}
```

**This object is:**
- Signed
- Offline-verifiable
- Portable
- Auditable

---

## IV. ORGANIZATIONS & SEATS

### Organization Model
```
Org
 ├─ org_id
 ├─ name
 ├─ tier
 ├─ seat_limit
 └─ policies
```

### Member Model
```
Member
 ├─ email
 ├─ role (admin | operator | viewer)
 └─ assigned_seat (bool)
```

### Enforcement Rules
- Seats are consumed, not shared
- Seat assignment is auditable
- Overages deny new sessions, not existing work
- Admins manage seats offline if required

---

## V. OFFLINE SEAT ENFORCEMENT

For AIRGAP / USB:

- Seat leases stored locally
- Leases expire gracefully
- Admin can reclaim seats manually
- Logs record every assignment

**No online calls required.**

---

## VI. BILLING SYSTEM (STRIPE AS A SERVANT)

### Stripe's Role
- Collect payment
- Handle subscriptions
- Issue receipts
- Notify events

### Stripe's Limits
- Cannot issue licenses
- Cannot revoke licenses
- Cannot decide entitlements
- Cannot gate tools

**Stripe is informational, never authoritative.**

---

## VII. BILLING → LICENSING FLOW

```
Stripe Event
↓
Internal Review / Automation
↓
Issuer Key Signs License
↓
License Delivered (email / portal / file)
↓
System Verifies Offline
```

**If Stripe goes down, licenses still work.**

---

## VIII. LICENSE DELIVERY METHODS

- Cloud portal download
- Email attachment
- USB import
- QR code (optional)
- Manual file placement

**No forced login required to use your own tools.**

---

## IX. EXPIRATION & GRACE LAW

### Expiry Behavior
- Grace period enabled (default 7–30 days)
- Existing sessions continue
- New privileged actions may degrade
- User always warned

**Expired ≠ Bricked**

This is not DRM malware.

---

## X. UPGRADE / DOWNGRADE RULES

- Free → Pro: instant via license import
- Pro → Enterprise: org license replaces individual
- Downgrade: takes effect at renewal
- License stacking forbidden unless explicit

**Everything is deterministic.**

---

## XI. ABUSE & FRAUD HANDLING

- License cloning → seat exhaustion
- Excess seats → deny new sessions
- Abuse logged, not punished silently
- Revocation is targeted, not nuclear

**Professional, not petty.**

---

**Status:** 🔒 LICENSING LAW LOCKED  
**Next:** Implementation in /core/license/ + Stripe integration
