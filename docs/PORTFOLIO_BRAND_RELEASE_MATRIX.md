# Bobby's Workshop — Portfolio Brand & Release Matrix

Updated: 2026-11-04

This file is the portfolio-level source of truth for public names, repository lineage, branding state, and release blockers. It deliberately distinguishes source/build evidence from store publication and physical-device validation.

## Wave 1 / Wave 2 product family

| Public product | Canonical repository | Public brand state | Release evidence | Current blocker / next gate |
|---|---|---|---|---|
| ARCWYRE Native / Eternum / Live | `Bboy9090/bluephoenix-native` | Public OS family; Phoenix Prime Kernel remains kernel identity | Release-candidate and evidence-bundle workflows can pass independently | Native repo currently fails hygiene on tracked build artifacts and exact-head checks because builds modify tracked source; clean brand PR #458 remains unmerged |
| Boot It Back | `Bboy9090/PhoenixCore-` | Public computer recovery surface | Brand-boundary PR merged; PhoenixCore release/app-reality/governance/artifact/boot-matrix workflows passed on the branding branch | Continue product-surface migration from internal PhoenixCore naming only when compatibility-safe |
| Phoenix Key | `Bboy9090/PhoenixCore-` and internal `Bootforge-usb` support | Public recovery-media product | PhoenixCore brand boundary merged; BootForge internal-only boundary merged | Physical write/boot evidence remains a separate hardware qualification requirement |
| BobFWTools | `Bboy9090/Bobbys-Workshop-` | Public name already canonical | macOS foundation merged; Node.js CI and BobFWTools macOS Core CI passed; universal app and Developer ID direct-distribution evidence recorded | Mac App Store lane requires matching provisioning profile for `com.bobbyblanco.bobfwtools`; physical Android qualification requires connected hardware |
| Bobby's Word Bench | `Bboy9090/GhostWriter-` | Public rename merged | CI, E2E, Vercel, and Railway status passed on branding branch | Continue store packaging and final production asset replacement |
| Bobby's Audio Bench — AEGIS Edition | `Bboy9090/Sonic_codex` | Public rename merged | CI, PWA readiness, mobile-store qualification, brand-assets, and Google resource-contract checks passed | Continue release packaging and production asset replacement |
| Bobby's Story Bench | `Bboy9090/Rainstorms` | Public rename merged | Node CI, Enterprise CI, mobile-store qualification, and fan-favorite foundation passed | Vercel preview checks were rate-limit failures, not code failures; production preview quota/deploy should be revalidated when capacity is available |
| Bobby's Case File | `Bboy9090/atlas-verify` | Next.js metadata + PWA manifest already public; README alignment PR #53 open | Product has case/public-record evidence lanes and brand contract in main | Railway deployment check on README-alignment PR is still pending; do not merge until it resolves or is shown to be infrastructure-only |
| Phoenix Creator Bench | `Bboy9090/SagaArchitect` | Public rename merged | Vercel and fan-favorite foundation passed on branding branch | Continue creator-suite expansion and production asset replacement |
| Bobby's House of Hidden Doors | dedicated entertainment lineage required | Brand/canon approved; product split PR #22 documents the separation | No dedicated game repository/build yet | Existing `Super_Bobbys_World_of_Secret_Rooms` is a device/compliance world-map platform and must not be falsely relabeled as the puzzle/adventure game |

## Internal identities that must not be promoted as customer-facing products

- **PhoenixCore** — internal orchestration/device-intelligence layer.
- **BootForge / libbootforge** — internal low-level discovery/media engine.
- **AtlasVerify** — compatibility/internal package/schema/provider identity behind Bobby's Case File.
- **GhostWriter** — compatibility/storage lineage behind Bobby's Word Bench.
- **Sonic Codex** — compatibility/API/package lineage behind Bobby's Audio Bench where migration is not yet qualified.
- **SagaArchitect / phoenix-creator-studio** — repository/package lineage behind Phoenix Creator Bench.

## Brand asset rule

Concept boards are approved direction, not proof that production icon files are installed.

For every product, replacement is complete only when:
1. source icon/splash masters exist,
2. platform-specific exports are generated,
3. manifests/configs reference the new assets,
4. build/package gates pass,
5. resulting installers/apps are inspected,
6. store screenshots match real runtime UI,
7. no legacy identifier needed for data/update compatibility is accidentally renamed.

## Wave 3 queue

| Project | Repository state | Next objective |
|---|---|---|
| Legends of Kai-Jax: The Memory Hero | `Bboy9090/Legends-of-Kai-Jax-The-memory-Hero` | Reconcile current canonical character art, touch-safe UI, mission availability, Android build/install evidence, and release branding |
| Dad's Million Miles | `Bboy9090/dads-million-miles` | Reconcile current app/audio state, brand assets, install/build gates, and store package readiness |
| Soul Codex | `Bboy9090/Ultimate-SoulCodex` | Preserve existing store identity; audit only for current-version release evidence and asset consistency before changing anything |
| Zero Code: Bloodline Racers | no installed GitHub repository located in this wave | Creative/Drive manuscript lane; do not invent a software repo |
| World Order series | no installed GitHub repository located in this wave | Creative/Drive manuscript/canon lane |
| Super Smash Grand Saga | no installed GitHub repository located in this wave | Creative/Drive manuscript/canon lane; preserve existing crossover canon and publication constraints |

## Next execution order

1. Repair bluephoenix-native repository hygiene and exact-head mutation failures without weakening gates.
2. Qualify and merge Bobby's Case File PR #53 when deployment evidence resolves.
3. Qualify and merge House of Hidden Doors product-split PR #22 when CI/guards finish.
4. Replace production brand assets in already-renamed apps one product at a time and prove builds.
5. Continue BobFWTools store-signing lane once a matching provisioning profile is available; keep physical-device qualification separate.
6. Begin Kai-Jax release/asset audit.
7. Begin Dad's Million Miles audio/release audit.
8. Audit Soul Codex current shipped/store state without unnecessary renaming.
9. Keep Zero Code, World Order, and Smash in their creative source-of-truth lane rather than fabricating software release work.
