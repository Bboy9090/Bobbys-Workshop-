# BobFWTools Reality Requalification — 2026-11-02

This marker intentionally triggers the current macOS core qualification workflow on the exact active foundation branch.

It does not certify release readiness by itself.

Required evidence remains:
- production reality gate
- frontend typecheck/build/tests
- production dependency audits
- BootForge USB check/tests
- Tauri core check
- qualified-flash compile/tests
- universal macOS app build and artifact verification
- separate identity-backed signing/notarization evidence before distribution

Hardware-sensitive functionality must continue to distinguish observed device evidence from blocked, unavailable, dry-run, fixture, or test-only behavior.
