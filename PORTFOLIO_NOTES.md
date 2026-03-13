# Portfolio Cleanup Notes

This document tracks recommendations for organizing the GitHub portfolio. Based on the cleanup plan, here's the status and next steps for each repository.

## ✅ Completed

### Bobbys-Workshop- (This Repository)
**Status:** Polished and public
**Identity:** Complete application - Phoenix Forge device repair platform
**Actions Taken:**
- ✅ Clarified repository identity (full app, not umbrella repo)
- ✅ Tightened README opening paragraph
- ✅ Enhanced architecture diagram
- ✅ Added screenshots section (placeholder ready)
- ✅ Added Releases section
- ✅ Added build status badges

**Recommendation:** Pin this repository on your profile

---

## 📋 Week 1 Priority (Do First)

### 1. REFORGE
**Action:** Archive immediately
**Reason:** Empty public repositories confuse visitors
**Steps:**
```bash
# On GitHub:
# Settings → General → Danger Zone → Archive this repository
```

### 2. SagaArchitect
**Action:** Make naming consistent
**Current Issue:** Unclear if it's SagaArchitect vs SagaLoreBuilder
**Do Next:**
- [ ] Choose one name (SagaArchitect OR SagaLoreBuilder)
- [ ] Make repo name, README title, and app title match exactly
- [ ] Add screenshots of the product
- [ ] Add use-cases section (books/comics/games)
- [ ] Pin on profile after cleanup

**Example README improvement:**
```markdown
# SagaArchitect

Build epic story worlds for books, comics, and games.

[Screenshot here]

## What it does
...

## Who it's for
- Game developers building narrative-driven games
- Comic book creators tracking character arcs
- Authors managing complex fictional universes
```

### 3. Bootforge-usb
**Action:** Redefine or merge
**Current Issue:** Confusing relationship with Phoenix Forge
**Options:**
1. **If it's a standalone library:** Make README crystal clear that it's a component used by Phoenix Forge
2. **If it's internal only:** Make it private or move into Phoenix Forge monorepo
3. **If it's deprecated:** Archive it

**Recommended README structure (if keeping public):**
```markdown
# BootForge USB

Low-level USB device communication library for device repair tools.

**Used by:** [Phoenix Forge](https://github.com/Bboy9090/Bobbys-Workshop-)

## Purpose
This is the Rust-based USB communication layer extracted from Phoenix Forge.
Use this library if you're building custom device management tools.

## Installation
...

## Related Projects
- Phoenix Forge - Complete device repair platform using this library
```

### 4. PhoenixCore-
**Action:** Polish and pin
**Do Next:**
- [ ] Tighten README opening paragraph
- [ ] Add architecture diagram or system overview
- [ ] Add screenshots/demos
- [ ] Add Releases section if missing
- [ ] Verify demo/build status is current
- [ ] Pin on profile

### 5. Atlas-verify
**Action:** Polish and pin
**Do Next:**
- [ ] Verify "secrets incident" language is still accurate
- [ ] Add product screenshots
- [ ] Tighten "who this is for" section at top
- [ ] Pin on profile

---

## 📅 Week 2 Priority (Do After Week 1)

### 6. Legends-of-Kai-Jax-The-memory-Hero
**Action:** Strategic evaluation
**Decision needed:** Is this legacy, active, or replaced?
- **If active:** Rewrite README around current vision
- **If legacy/pivoted:** Archive and create successor repo with clear name
- **If abandoned:** Archive

### 7. REFORGE-OS
**Action:** Assess overlap with BootForge
**Decision needed:** Is this distinct from BootForge-usb?
- **If distinct:** Write sharp differentiation in README
- **If overlapping:** Merge concepts and reduce clutter
- **If deprecated:** Archive

### 8. Puttogether
**Action:** Improve documentation
**Do Next:**
- [ ] Explain what it does (clear purpose statement)
- [ ] Show how it works (with examples)
- [ ] Provide input/output examples
- [ ] Add privacy note if extracting sensitive data

---

## 🔒 Needs Review Before Public

### 9. GhostWriter-
**Action:** Review later
**Steps:** Check scope before making public

### 10. VelocitySystems
**Action:** Review later
**Steps:** Check scope before making public

---

## 🔐 Keep Private (Unless Improved)

### 11. patient-bag-inventor
**Status:** Keep private unless improved

### 12. Sonic_codex
**Status:** Keep private unless improved
**Note:** May be integrated into Phoenix Forge's Sonic Codex module

### 13. universal-cart-brows
**Status:** Keep private unless improved

---

## 🌟 Pinned Repository Strategy

**Recommended pins (pick your top 4-6):**
1. **Phoenix Forge (Bobbys-Workshop-)** - Your flagship product
2. **PhoenixCore-** - Core decision engine (if distinct from Phoenix Forge)
3. **SagaArchitect** - Story building tool (after cleanup)
4. **Atlas-verify** - Security/verification tool (after polish)
5. **Rainstorms** - (if polished with demo)
6. **Ultimate-SoulCodex-Engine** - (after simplifying branding)

---

## 📝 Portfolio Consistency Guidelines

Apply these to all public repos:

### 1. README Structure
```markdown
# Project Name

One-line pitch.

[Badges: Build status, version, license]

## What it is
Clear 2-3 sentence explanation.

## Screenshots
[Visual proof it works]

## Features
Bullet points, no fluff.

## Getting Started
Quick install and run.

## Who it's for
Specific user personas.

## Releases
Link to releases page.

## License
```

### 2. Naming Consistency
- Repo name = README title = Package name
- No confusion between working title and brand

### 3. Visual Proof
- Every public repo should have screenshots OR demo link
- No "coming soon" - hide the feature or show what exists

### 4. Clear Purpose
- Is it a library? Say "library for X"
- Is it an app? Say "app that does X"
- Is it a tool? Say "tool to help you X"

---

## 🚫 Rules Until Cleanup Complete

1. **No new repository names** until existing ones are cleaned up
2. **No renaming for the sake of renaming** - only if it genuinely reduces confusion
3. **Archive before creating successor** - don't let dead repos accumulate
4. **Pin only polished repos** - your pinned repos are your resume

---

## ✨ Ultimate-SoulCodex-Engine-of-the-Eternal-Now

**Special case:** The name is creative but may confuse outsiders

**Action:** Keep repo name (renaming is annoying), but simplify presentation
- [ ] Use "SoulCodex" as display brand in README
- [ ] Create clean one-paragraph pitch
- [ ] Separate mystical branding from product utility
  - Put the philosophy in a PHILOSOPHY.md
  - Make README product-focused

**Example:**
```markdown
# SoulCodex

A personal knowledge engine that learns from your creative process.

[What it actually does in plain language]

---

*Originally conceived as the Ultimate SoulCodex Engine of the Eternal Now -
for the full vision, see [PHILOSOPHY.md](PHILOSOPHY.md)*
```

---

## 📊 Rainstorms

**Action:** Polish and pin
**Do Next:**
- [ ] Add live demo link near top (if available)
- [ ] Add roadmap snapshot (what's working, what's planned)
- [ ] Add sample output images or PDF previews
- [ ] Pin on profile

---

## Summary Checklist

**Week 1 (Essential):**
- [ ] Archive REFORGE
- [ ] Fix SagaArchitect naming
- [ ] Clarify or merge Bootforge-usb
- [ ] Polish PhoenixCore-
- [ ] Polish Atlas-verify
- [ ] Pin top 4-5 repos

**Week 2 (Important):**
- [ ] Evaluate Legends-of-Kai-Jax
- [ ] Assess REFORGE-OS overlap
- [ ] Improve Puttogether docs
- [ ] Review GhostWriter- and VelocitySystems for public readiness

**Ongoing:**
- Maintain consistency across public repos
- No new repos until cleanup complete
- Update pinned repos as projects evolve
