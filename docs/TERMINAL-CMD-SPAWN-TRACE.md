# Terminal / CMD Window Spawn Trace

All code paths that spawn processes or run shell commands. **Bold** = can open console on Windows; **Fix** = recommended change.

---

## 1. Rust (Tauri) – `src-tauri/`

| Location | What | CREATE_NO_WINDOW / Stdio | Fix |
|----------|------|---------------------------|-----|
| **`fastapi_backend.rs:54–56`** | `Command::new("python").arg("--version").output()` – PATH probe | **None** | Add `creation_flags(0x08000000)` before `.output()` on Windows |
| `fastapi_backend.rs:141–190` | FastAPI uvicorn spawn | Yes (0x08000000), stdout/stderr → log | OK |
| `main.rs:248–266` | `run_command_capture_lines` | Yes | OK |
| `main.rs:269–294` | `fastboot_exists` / `adb_exists` | Yes, Stdio::null | OK |
| `main.rs:296–337` | `adb_list_serials` / `fastboot_list_serials` | Yes | OK |
| `main.rs:590–700` | Fastboot flash / reboot / getvar | Yes | OK |
| `main.rs:988–1002` | Node `--version` probe | Yes | OK |
| `main.rs:1148–1188` | Node backend spawn | Yes, stdout/stderr → log | OK |
| `python_backend.rs:29–48` | Python worker spawn | Yes | OK |
| `python_backend.rs:92–107` | Python `--version` fallback | Yes | OK |
| `bootforge_backend.rs` | adb/fastboot invocations | Yes | OK |

---

## 2. Node – Server (bundled at `src-tauri/bundle/resources/server/`)

Bundle source: `server/` via `scripts/bundle-server.ps1`. Then `fix-bundle-execsync.ps1` patches `execSync(where|which|command -v)`.

### 2.1 `server/index.js`

| Location | What | windowsHide / shell:false | Fix |
|----------|------|---------------------------|-----|
| `939–963` | `safeExec(cmd)` – `spawnSync(parts[0], parts[1..])` | Yes | OK. Naive split breaks `2>&1` etc. |
| `1054` | `safeExec(\`powershell -NoProfile -WindowStyle Hidden ...\`)` | Via safeExec | Verify no flash |
| `1167` | BootForgeUSB `spawnSync(cmd, ['scan','--json'])` | Yes | OK |
| `1657` | ADB auth trigger `spawnSync(adbCmd, [...])` | Yes | OK |
| `2049` | Fastboot flash `spawnSync('fastboot', [...])` | Yes | OK |
| `2440, 2460` | Cargo build/install for BootForge | Yes | OK |

### 2.2 `server/utils/`

| File | Location | What | windowsHide | Fix |
|------|----------|------|-------------|-----|
| **`phoenix-core-wrapper.js`** | **76, 125** | **`execSync(\`python3 -c "..."\`)`** | **No** | **Add `windowsHide: true`** (and prefer `python` on Windows) |
| `system-metrics.js` | 74, 100 | `execSync('wmic...')` / `execSync('df -k...')` | Yes | OK |
| `startup-validation.js` | 85 | `spawnSync('adb', ['version'])` | Yes | OK |
| `safe-exec.js` | spawn/safeSpawn | All spawns | Yes | OK |
| `safe-exec.js` | `findToolPathInPath` Unix | `spawnSync('which', [cmd])` | N/A (Unix) | OK |
| `universal/platform-detector.js` | **Source** | **Uses `commandExistsInPath` / `findToolPathInPath`** | N/A | **OK in source** |
| **`universal/platform-detector.js`** | **Bundled** | **Still uses `execSync(where|which|cat|groups)`** | **No** | **Bundle copies from `server/`. Re-run `prepare:bundle` so bundle gets refactor. Fix script does not fully fix platform-detector.** |

### 2.3 `server/routes/v1/`

| File | What | windowsHide | Fix |
|------|------|-------------|-----|
| `adb.js` | `safeExec` (execSync), `commandExists` (PATH check) | Yes | OK |
| `fastboot.js` | Same | Yes | OK |
| `flash.js` | Same | Yes | OK |
| `system-tools.js` | `safeExec`, `spawnSync('which', ...)` | Yes | OK |

### 2.4 `server/operations.js`

| Location | What | windowsHide | Fix |
|----------|------|-------------|-----|
| 187–188 | `spawnSync('adb', ['devices','-l'])` | Yes | OK |
| 212–213 | `spawnSync('fastboot', ['devices'])` | Yes | OK |
| 237, 265, 282, 317, 324 | idevice_id, ideviceinfo, adb shell, adb reboot | Yes | OK |

### 2.5 `server/authorization-triggers.js`

| Location | What | windowsHide | Fix |
|----------|------|-------------|-----|
| 68 | `spawnSync('command', ['-v', tool])` (Unix) | Yes | OK. `command` is Unix-only. |
| 99–119 | `execAsync` for trapdoor triggers | Yes | OK |
| 88–89 | `resolveToolPath` → PATH / `command -v` | Uses safe-exec style | OK |

### 2.6 `server/tools-manager.js`

| Location | What | windowsHide | Fix |
|----------|------|-------------|-----|
| 206, 267 | `execSync(fullCommand)` version / execute | Yes | OK |
| 168 | `commandExistsInPath` from safe-exec | N/A | OK |

### 2.7 `server/tools-inspect.js`

| Location | What | windowsHide | Fix |
|----------|------|-------------|-----|
| 28–34 | `safeExec` → `execSync(cmd)` | Yes | OK |
| 47–72 | `commandExists` → PATH check on Windows | N/A | OK |

---

## 3. Core lib (`core/lib/`) – used by Trapdoor operations, adb-library-wrapper

**Bundled:** `core/` → `src-tauri/bundle/resources/core/` via `bundle-server.ps1`.

| File | Location | What | windowsHide | Fix |
|------|----------|------|-------------|-----|
| **`adb.js`** | **58–61, 108–111** | **`spawn('adb', ...)`** | **No** | **Add `windowsHide: true` to spawn options** |
| **`fastboot.js`** | **55–59** **`spawn('fastboot', ...)`** | **No** | **Add `windowsHide: true`** |
| **`ios.js`** | **55–58** **`spawn(\`idevice${command}\`, ...)`** | **No** | **Add `windowsHide: true`** |

---

## 4. Other spawners (dev/build only, not desktop runtime)

| Location | What | Note |
|----------|------|------|
| `scripts/bundle-nodejs.js` | `spawn` for unzip | Build-time |
| `scripts/build-standalone.js` | `execSync` | Build-time |
| `scripts/check-rust.js`, `check-android-tools.js`, `dev-arsenal-status.js` | `execSync` | Dev tooling |
| `vite-plugin-backend-auto-start.ts` | `spawn` with `windowsHide` | Dev server |
| `electron/main.cjs` | `spawn` | Electron path, not Tauri |

---

## 5. Summary – fix list

1. **`src-tauri/src/fastapi_backend.rs`**  
   Add `creation_flags(0x08000000)` before `Command::new("python"|"python3").arg("--version").output()` on Windows.

2. **`server/utils/phoenix-core-wrapper.js`**  
   Add `windowsHide: true` to both `execSync(\`python3 -c "..."\`)` calls.

3. **`core/lib/adb.js`**  
   Add `windowsHide: true` to all `spawn('adb', ...)` options.

4. **`core/lib/fastboot.js`**  
   Add `windowsHide: true` to all `spawn('fastboot', ...)` options.

5. **`core/lib/ios.js`**  
   Add `windowsHide: true` to `spawn(\`idevice${command}\`, ...)` options.

5. **`server/utils/universal/platform-detector.js`**  
   Source already refactored to safe-exec. Ensure **`prepare:bundle`** is run so **bundle** gets the updated file (no `execSync` where/which/cat/groups).

6. **Bundled platform-detector**  
   If bundle still has old code after prepare:bundle, bundle-server copies from `server/`; confirm no stale copy. Fix-bundle-execsync cannot fully fix platform-detector (findToolPath returns path, not boolean).

---

## 6. Compact fix list (file:line)

| File | Line(s) | Issue | Change |
|------|---------|-------|--------|
| `src-tauri/src/fastapi_backend.rs` | 54–56 | Python probe | `creation_flags(0x08000000)` before `.output()` on Windows |
| `server/utils/phoenix-core-wrapper.js` | 76, 125 | execSync python3 | `windowsHide: true` |
| `core/lib/adb.js` | 58–61, 108–111 | spawn adb | `windowsHide: true` |
| `core/lib/fastboot.js` | 55–59 | spawn fastboot | `windowsHide: true` |
| `core/lib/ios.js` | 55–58 | spawn idevice* | `windowsHide: true` |
| `server/utils/universal/platform-detector.js` | — | Source refactored | Re-bundle so bundle gets it |

---

## 7. Flow when desktop app runs

1. Tauri starts → `main.rs` launches Node backend (from bundle) and optionally FastAPI.
2. Node server uses `server/index.js` safeExec, routes, operations, etc.
3. Trapdoor / device ops use `core/lib/adb.js`, `core/lib/fastboot.js`, and `core/lib/ios.js` **spawn** → **all lack windowsHide**.
4. Platform detection uses bundled `platform-detector` → must be refactored copy (no execSync).
5. Phoenix core checks use `phoenix-core-wrapper` **execSync** → **no windowsHide**.
6. FastAPI launcher uses `Command::new("python").output()` for PATH probe → **no CREATE_NO_WINDOW** (Windows).

---

*Generated from codebase grep/trace. Re-check after fixes.*
