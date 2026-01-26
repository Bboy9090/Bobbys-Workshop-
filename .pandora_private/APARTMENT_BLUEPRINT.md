# BOBBY'S SECRET WORKSHOP — APARTMENT BLUEPRINT

> **INTERNAL ONLY — NOT FOR PUBLIC DOCUMENTATION**
> This is the canonical truth of how the Workshop is structured.

---

## The Apartment Metaphor

Bobby's Workshop is built like a 90s Bronx apartment repair spot:
- Clean, professional shop up front
- Deeper rooms behind locked doors
- Trapdoors only where earned
- Things exist but aren't shown

---

## Physical Layer Canon

```
┌─────────────────────────────────────────────────────────────┐
│                      CEILING HATCH                          │
│                    (Warp Routing Layer)                     │
│         Emergency exits, cross-room teleports,              │
│              context-aware shortcuts                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐  ┌─────────────────┐                 │
│   │   FRONT ROOM    │  │   BACK ROOM     │                 │
│   │                 │  │                 │                 │
│   │  Phoenix Forge  │  │  Codex Access   │                 │
│   │  (Public UI)    │  │  (Restricted)   │                 │
│   │                 │  │                 │                 │
│   │  - Dashboard    │  │  - Sonic Codex  │                 │
│   │  - Devices      │  │  - Ghost Codex  │                 │
│   │  - Flashing     │  │  - Pandora Codex│                 │
│   │  - Cases        │  │                 │                 │
│   │  - Workflows    │  │  [PASSCODE REQ] │                 │
│   │                 │  │                 │                 │
│   └────────┬────────┘  └────────┬────────┘                 │
│            │                    │                          │
│   ┌────────┴────────┐  ┌────────┴────────┐                 │
│   │     CLOSET      │  │   FLOOR TRAP    │                 │
│   │                 │  │                 │                 │
│   │  Phoenix Keys   │  │  Local Tooling  │                 │
│   │  (USB Builders) │  │  (Never Remote) │                 │
│   │                 │  │                 │                 │
│   │  - Boot repair  │  │  - Root Vault   │                 │
│   │  - OS deploy    │  │  - Bypass Lab   │                 │
│   │  - State freeze │  │  - Shadow Ops   │                 │
│   │                 │  │                 │                 │
│   └─────────────────┘  └─────────────────┘                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      BASEMENT                               │
│                 (BootForge USB Layer)                       │
│         Raw hardware, drivers, enumeration                  │
│              Rust-only, never exposed                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Room Definitions

### FRONT ROOM — Phoenix Forge Surface
**Access:** Public (default view)
**Purpose:** Professional device repair interface

Contains:
- Command Center (Dashboard)
- Device Management
- Flash Forge (standard flashing)
- Case Management
- Workflow Execution
- Settings

Rules:
- Everything here is customer-safe
- No destructive operations without confirmation
- Full audit trail on every action
- Clean, professional presentation

---

### BACK ROOM — Codex Access
**Access:** Passcode required
**Purpose:** Intelligence and analysis

Contains:
- Sonic Codex (audio/signal intelligence)
- Ghost Codex (metadata hygiene)
- Pandora Codex (hardware state research)

Rules:
- **CODEX ROOMS NEVER EXECUTE BLINDLY**
- Codex only: Observe, Classify, Recommend, Hand off
- Execution happens through Front Room or Phoenix Key
- Analysis is read-only by default

---

### CLOSET — Phoenix Keys
**Access:** From Front Room, with confirmation
**Purpose:** Bootable recovery media creation

Contains:
- Phoenix Key Builder
- USB imaging tools
- Boot repair utilities
- State-agnostic recovery

Rules:
- Physical action required (USB insertion)
- Offline-capable operations
- Signed and controlled output
- No network required for core function

---

### FLOOR TRAP — Local Tooling
**Access:** Contextual, passcode + device present
**Purpose:** Advanced device operations

Contains:
- Root Vault (root operations)
- Bypass Laboratory (security research)
- Jailbreak Sanctum (iOS operations)
- Shadow Archive (sensitive data)
- Unlock Chamber (device unlocking)

Rules:
- **TRAPDOORS ARE CONTEXTUAL**
- Only visible when conditions met
- Never bookmarked, never direct-linked
- Requires: device state match + operator present + local verification

---

### CEILING HATCH — Warp Routing
**Access:** System-controlled
**Purpose:** Emergency and context-aware navigation

Contains:
- Emergency exits from deep operations
- Cross-room context preservation
- Shortcut routing based on device state
- Fallback pathways

Rules:
- Invisible to users
- Activated by system conditions
- Preserves audit trail across warps
- Never interrupts critical operations

---

### BASEMENT — BootForge USB Layer
**Access:** Code-only (never UI)
**Purpose:** Raw hardware interaction

Contains:
- libbootforge (Rust library)
- USB enumeration
- Driver management
- Platform-specific bindings

Rules:
- Never directly exposed to UI
- All access through Phoenix Core
- Rust-only implementation
- Security boundary maintained

---

## The Codex Rule

```
╔══════════════════════════════════════════════════════════╗
║                    CODEX RULE                            ║
║                                                          ║
║  Codex rooms NEVER execute blindly.                      ║
║                                                          ║
║  They ONLY:                                              ║
║    ○ OBSERVE   — Watch device/system state               ║
║    ○ CLASSIFY  — Categorize what they see                ║
║    ○ RECOMMEND — Suggest actions                         ║
║    ○ HAND OFF  — Pass to execution layer                 ║
║                                                          ║
║  Execution ALWAYS happens through:                       ║
║    → Phoenix Forge (Front Room)                          ║
║    → Phoenix Key (Closet)                                ║
║    → Explicit local confirmation (Floor Trap)            ║
║                                                          ║
║  This keeps the Workshop clean forever.                  ║
╚══════════════════════════════════════════════════════════╝
```

---

## The Trapdoor Rule

```
╔══════════════════════════════════════════════════════════╗
║                   TRAPDOOR RULE                          ║
║                                                          ║
║  Trapdoors are:                                          ║
║    ○ CONTEXTUAL  — Appear based on conditions            ║
║    ○ EPHEMERAL   — Exist only while conditions hold      ║
║    ○ NEVER BOOKMARKED — No direct URLs or shortcuts      ║
║                                                          ║
║  They appear ONLY when:                                  ║
║    ✓ Device state matches required conditions            ║
║    ✓ Operator is present and verified                    ║
║    ✓ Local environment is confirmed                      ║
║                                                          ║
║  This is how you keep secrets secret                     ║
║  without hiding code.                                    ║
╚══════════════════════════════════════════════════════════╝
```

---

## Access Control Matrix

| Layer | Visibility | Access Method | Persistence |
|-------|------------|---------------|-------------|
| Front Room | Always visible | Direct | Permanent |
| Back Room | Tab visible | Passcode | Session |
| Closet | Button visible | Confirmation | Action-scoped |
| Floor Trap | Conditional | Context + Passcode | Ephemeral |
| Ceiling Hatch | Never visible | System-triggered | Invisible |
| Basement | Never visible | Code-only | N/A |

---

## State Machine

```
                    ┌──────────────┐
                    │   VISITOR    │
                    │  (No access) │
                    └──────┬───────┘
                           │ App load
                           ▼
                    ┌──────────────┐
                    │   SURFACE    │
                    │ (Front Room) │
                    └──────┬───────┘
                           │ Passcode entered
                           ▼
                    ┌──────────────┐
                    │   OPERATOR   │
                    │ (Back Room)  │
                    └──────┬───────┘
                           │ Device + Context match
                           ▼
                    ┌──────────────┐
                    │   TRUSTED    │
                    │ (Floor Trap) │
                    └──────┬───────┘
                           │ Local confirmation
                           ▼
                    ┌──────────────┐
                    │  EXECUTING   │
                    │ (Operation)  │
                    └──────────────┘
```

---

## Mental Rulebook

1. **If it can't be justified in the Front Room, it belongs below.**
2. **Codex observes. Phoenix executes.**
3. **Trapdoors are earned, not navigated.**
4. **The Basement is never seen, only felt.**
5. **Warps preserve context, never break it.**
6. **Professional up front. Quiet depth underneath.**
7. **No automation without intent.**
8. **Every action leaves a trace.**

---

## File Organization

```
src/
├── components/
│   ├── screens/          # Front Room screens
│   ├── trapdoor/         # Floor Trap components
│   ├── codex/            # Back Room (Codex) components
│   └── phoenix-key/      # Closet components
├── lib/
│   ├── apartment/        # Layer routing logic
│   ├── codex/            # Codex rule enforcement
│   └── trapdoor/         # Trapdoor visibility rules
└── core/                 # Basement abstractions
```

---

**This document is the canonical truth.**
**When in doubt, consult the apartment.**
