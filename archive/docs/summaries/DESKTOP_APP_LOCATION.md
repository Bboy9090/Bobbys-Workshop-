# 📍 Where Is the Desktop App?

## Project folder (source code)

```
c:\Users\Bobby\Bobbys-secret-Workshop-
```

This is the **workshop root**. All code, Transcendent Legendary Enterprise UI, and build scripts live here.

---

## Built app (after you build)

| What | Folder |
|------|--------|
| **Release build (Windows)** | `c:\Users\Bobby\Bobbys-secret-Workshop-\src-tauri\target\release\` |
| **Windows MSVC build** | `c:\Users\Bobbys-secret-Workshop-\src-tauri\target\x86_64-pc-windows-msvc\release\` |

**Executable name:** `bobbys-secret-workshop.exe`  
**Installers (MSI/NSIS):** `src-tauri\target\...\release\bundle\msi\` or `...\bundle\nsis\`

---

## How to open / run it

### 1. Desktop shortcut (recommended)

A shortcut is created on your **Desktop**:

- **Name:** `Bobbys Workshop.lnk` (or `Transcendent Legendary Enterprise.lnk`)
- **Location:** `C:\Users\Bobby\Desktop\`

Double‑click it to launch:

- If you’ve **built** the app → runs `bobbys-secret-workshop.exe`
- If **not** built yet → runs `npm run tauri:dev` (dev mode with hot reload)

### 2. From project folder (terminal)

```powershell
cd c:\Users\Bobby\Bobbys-secret-Workshop-

# Dev mode (no build needed) — opens app + Vite + backend
npm run tauri:dev

# Or Electron
npm run electron:dev
```

### 3. Run the .exe directly (after build)

```powershell
cd c:\Users\Bobby\Bobbys-secret-Workshop-\src-tauri\target\release
.\bobbys-secret-workshop.exe
```

---

## Transcendent Legendary Enterprise tab

The **Transcendent** screen (Autonomous AI, Neural Networks, Self‑Evolution) is **inside** the same app:

1. Open the app (shortcut, `tauri:dev`, or .exe).
2. In the top tab bar, click **Transcendent** (sparkle icon).

---

## Build the desktop app (first-time)

From the project root:

```powershell
cd c:\Users\Bobby\Bobbys-secret-Workshop-
npm install
npm run server:install
npm run build
npm run prepare:bundle
npm run tauri:build:windows
```

Or use the full installer script:

```powershell
npm run build:complete:windows
```

---

## Create / refresh Desktop shortcut

```powershell
cd c:\Users\Bobby\Bobbys-secret-Workshop-
.\scripts\create-desktop-shortcut.ps1
```

Shortcut is created on your Desktop. If no release build exists, the shortcut runs **dev mode** (`npm run tauri:dev`) instead.

---

## Summary

| Question | Answer |
|----------|--------|
| **Project folder?** | `c:\Users\Bobby\Bobbys-secret-Workshop-\` |
| **Built .exe?** | `src-tauri\target\release\bobbys-secret-workshop.exe` |
| **Desktop shortcut?** | `C:\Users\Bobby\Desktop\Bobbys Workshop.lnk` |
| **Transcendent tab?** | Open app → **Transcendent** tab in the UI |
