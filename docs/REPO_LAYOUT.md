## Canonical repo layout (source vs generated)

### Source of truth (edit these)
- `src/`: React/Vite frontend (Tauri UI)
- `server/`: Node backend source (API server)
- `core/`: Node “core providers” used by `server/` (adb/fastboot/ios wrappers, etc.)
- `src-tauri/src/`: Rust/Tauri app (launchers, bundling, process control)
- `scripts/`: Build + bundling automation
- `docs/`: Documentation (curated)

### Generated (do not edit; do not commit)
- `target/`: Rust build artifacts (repo root)
- `src-tauri/target/`: Rust build artifacts for Tauri
- `src-tauri/bundle/resources/`: **generated** runtime payload created by `npm run prepare:bundle`
- `src-tauri/resources/`: legacy/generated copy (avoid editing; prefer `server/` + `core/`)

### Local-only third-party tools (not committed)
Use the local tools registry:
- `%LOCALAPPDATA%\\Bobbys-Workshop\\tools\\third_party\\bin` (Windows)
- `~/.bobbys-workshop/tools/third_party/bin` (fallback)

The backend will search these directories before PATH.

### In-repo upstream drops (kept for reference)

If you keep upstream tool drops/installers in the repo, place them here:

- `third_party/tool_dumps/`

Then run `scripts/ingest-third-party-tools.ps1` to copy relevant executables into the local-only bin (without committing them).

### Build flow
- `npm run build`: frontend build
- `npm run prepare:bundle`: generates `src-tauri/bundle/resources/` from `server/`, `core/`, runtime assets, and local tools (if present)
- `npm run tauri:build:windows`: produces installer/bundles from the generated resources

