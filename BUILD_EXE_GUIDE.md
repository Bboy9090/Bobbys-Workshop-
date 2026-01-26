# 🔥 Pandora Codex - Create Standalone EXE Installer

## 🎯 What This Creates

A **single-file installer** that includes:
- ✅ Complete Pandora Codex application
- ✅ All dependencies bundled
- ✅ Desktop & Start Menu shortcuts
- ✅ One-click installation
- ✅ Professional installer/uninstaller
- ✅ Portable mode (no install needed)

---

## 🚀 Quick Build

### **Option 1: Run the Build Script**
```powershell
# Open PowerShell in project directory
.\build-installer.ps1
```

**This creates:**
- 📁 `dist-installer/` folder with all installer files
- 📦 `PandoraCodex-Portable-v1.0.0.zip` (ready to distribute)
- 🔥 `PandoraCodex-Setup-v1.0.0.exe` (if 7-Zip installed)

---

### **Option 2: Create Self-Extracting EXE (Recommended)**

**Step 1: Install 7-Zip**
```powershell
# Using Scoop
scoop install 7zip

# Or download from: https://www.7-zip.org/
```

**Step 2: Build the installer**
```powershell
.\build-installer.ps1
```

**Output:**
- ✅ `PandoraCodex-Setup-v1.0.0.exe` (self-extracting installer)

---

## 📦 What Gets Packaged

### Application Files:
```
dist-installer/
├── INSTALL.bat           ← One-click installer
├── UNINSTALL.bat         ← One-click uninstaller
├── RUN_PORTABLE.bat      ← Portable mode (no install)
├── START.bat             ← Server launcher
├── install.ps1           ← System tools installer
├── dist/                 ← Built frontend
├── server/               ← Backend server
├── data/                 ← Configuration & data
├── package.json          ← Dependencies
├── INSTALLER_README.md   ← User guide
├── QUICK_START.md        ← Quick start guide
└── README.md             ← Full documentation
```

### System Tools (installed via install.ps1):
- Android Platform Tools (adb, fastboot)
- scrcpy (Android screen mirror)
- FFmpeg (media conversion)
- Node.js (if missing)

---

## 🎯 User Installation Flow

### **For End Users:**

**Step 1: Extract/Run Installer**
```
Double-click: PandoraCodex-Setup-v1.0.0.exe
(Or extract ZIP and run INSTALL.bat)
```

**Step 2: Install System Tools**
```powershell
# Right-click PowerShell → "Run as Administrator"
cd %LOCALAPPDATA%\PandoraCodex
.\install.ps1
```

**Step 3: Launch**
```
Double-click "Pandora Codex" on Desktop
```

**Done! Opens http://localhost:3001**

---

## 🎨 Installer Features

### **INSTALL.bat:**
- ✅ Copies all files to `%LOCALAPPDATA%\PandoraCodex`
- ✅ Creates desktop shortcut
- ✅ Creates start menu entry
- ✅ Installs npm dependencies
- ✅ Professional installation wizard

### **UNINSTALL.bat:**
- ✅ Removes all files
- ✅ Deletes shortcuts
- ✅ Confirmation prompt
- ✅ Clean uninstall

### **RUN_PORTABLE.bat:**
- ✅ No installation required
- ✅ Runs from any folder
- ✅ Auto-installs dependencies
- ✅ Perfect for USB drives

### **START.bat:**
- ✅ One-click server startup
- ✅ Auto-opens browser
- ✅ Dependency checks
- ✅ Tool detection

---

## 🔧 Advanced Options

### **Create Windows Installer (MSI)**

**Using WiX Toolset:**
```powershell
# Install WiX
scoop install wixtoolset

# Create MSI
candle installer.wxs
light installer.wixobj
```

### **Create NSIS Installer**

**Using NSIS:**
```powershell
# Install NSIS
scoop install nsis

# Create installer
makensis installer.nsi
```

### **Package as Single EXE (pkg)**

```powershell
# Install pkg
npm install -g pkg

# Package as EXE
npm run package-exe
```

---

## 📊 File Sizes

| Component | Size (approx) |
|-----------|---------------|
| Frontend (dist/) | ~5 MB |
| Backend (server/) | ~1 MB |
| Node modules | ~50 MB |
| **Total ZIP** | **~55 MB** |
| **Self-extracting EXE** | **~55 MB** |

---

## 🎁 Distribution Methods

### **Method 1: ZIP File (Simple)**
```
PandoraCodex-Portable-v1.0.0.zip
↓
Users extract and run INSTALL.bat
```

### **Method 2: Self-Extracting EXE (Professional)**
```
PandoraCodex-Setup-v1.0.0.exe
↓
Users double-click (auto-extracts and installs)
```

### **Method 3: Portable USB**
```
Copy dist-installer/ to USB drive
↓
Run RUN_PORTABLE.bat (no install needed)
```

### **Method 4: GitHub Releases**
```
Upload ZIP/EXE to GitHub Releases
↓
Users download and install
```

---

## 🔐 Code Signing (Optional)

**For trusted installer:**
```powershell
# Get code signing certificate
# Sign the EXE
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com PandoraCodex-Setup-v1.0.0.exe
```

---

## ✅ Testing Checklist

### **Before Distribution:**
- [ ] Run `build-installer.ps1`
- [ ] Test `INSTALL.bat` in fresh VM
- [ ] Verify shortcuts work
- [ ] Test `install.ps1` (tools installation)
- [ ] Test `START.bat`
- [ ] Verify server starts at localhost:3001
- [ ] Test all features (screen mirror, backup, etc.)
- [ ] Test `UNINSTALL.bat`
- [ ] Test portable mode (`RUN_PORTABLE.bat`)
- [ ] Scan with antivirus (false positive check)

---

## 🚀 Build Commands Summary

```powershell
# Build everything
.\build-installer.ps1

# Test installation (in dist-installer/)
cd dist-installer
.\INSTALL.bat

# Test portable mode
.\RUN_PORTABLE.bat

# Create self-signed EXE
# (Requires 7-Zip installed)
.\build-installer.ps1
# Output: PandoraCodex-Setup-v1.0.0.exe
```

---

## 📝 Customization

### **Change Installation Location:**
Edit `INSTALL.bat`:
```batch
set INSTALL_DIR=C:\PandoraCodex
```

### **Change App Name:**
Edit `build-installer.ps1`:
```powershell
$APP_NAME = "MyCustomName"
```

### **Add Custom Icon:**
1. Place `icon.ico` in `dist-installer/`
2. Shortcuts will use it automatically

### **Bundle Additional Tools:**
Edit `dist-installer/install.ps1` to add more tools

---

## 🎉 Result

**You Get:**
1. ✅ Professional installer package
2. ✅ Single-file distribution (ZIP or EXE)
3. ✅ Desktop shortcut for users
4. ✅ Start menu integration
5. ✅ Complete uninstaller
6. ✅ Portable mode option
7. ✅ All features unlocked
8. ✅ No external dependencies

**Distribution Ready in 5 Minutes!** 🚀

---

## 📦 Share Your Installer

**Upload to:**
- GitHub Releases
- Google Drive
- OneDrive
- Website/Blog
- USB Drive

**Users simply:**
1. Download
2. Run INSTALL.bat
3. Run install.ps1 (as Admin)
4. Double-click desktop shortcut
5. Enjoy! 🎉

---

**Build Time:** ~2-5 minutes
**Install Time (for users):** ~3 minutes
**Total Setup Time:** ~8 minutes from zero to running!
