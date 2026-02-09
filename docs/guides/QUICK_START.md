# 🚀 Pandora Codex - Quick Start Guide

## 🎯 One-Click Installation & Run

### **Windows Users:**

#### **Step 1: Install Everything**
```powershell
# Right-click PowerShell and "Run as Administrator"
.\install.ps1
```

#### **Step 2: Start the Server**
```cmd
# Double-click this file:
START.bat
```

**Or run in terminal:**
```powershell
npm run dev
```

---

### **macOS Users:**

#### **Step 1: Install Everything**
```bash
chmod +x install.sh
./install.sh
```

#### **Step 2: Start the Server**
```bash
chmod +x start.sh
./start.sh
```

**Or run in terminal:**
```bash
npm run dev
```

---

### **Linux Users:**

#### **Step 1: Install Everything**
```bash
chmod +x install.sh
sudo ./install.sh
```

#### **Step 2: Start the Server**
```bash
chmod +x start.sh
./start.sh
```

**Or run in terminal:**
```bash
npm run dev
```

---

## 📦 What Gets Installed

### **Android Tools:**
- ✅ ADB (Android Debug Bridge)
- ✅ Fastboot (bootloader interface)
- ✅ scrcpy (screen mirroring)

### **iOS Tools:**
- ✅ libimobiledevice (macOS/Linux)
- ✅ idevicebackup2 (backup/restore)
- ⚠️ iTunes required (Windows)

### **Universal Tools:**
- ✅ FFmpeg (media conversion)
- ✅ Node.js (runtime)
- ✅ Git (version control)

### **Optional Tools:**
- mitmproxy (network inspection)
- Appium (automation)

---

## 🚀 Quick Start (After Install)

1. **Connect your device via USB**

2. **Enable USB Debugging (Android):**
   - Settings → About Phone → Tap Build Number 7 times
   - Settings → Developer Options → Enable USB Debugging

3. **Trust Computer (iOS):**
   - Connect device → "Trust This Computer?" → Trust

4. **Open browser:**
   ```
   http://localhost:3001
   ```

5. **Start using features!**

---

## 🎯 Available Features (After Install)

### **Android:**
- 📱 Screen Mirror (scrcpy)
- 🗑️ Bloatware Remover
- 💾 ADB Backup/Restore
- 📦 Firmware Downloads
- 🎬 Media Conversion

### **iOS:**
- 💾 Device Backup/Restore
- 📦 IPSW Downloads
- 📱 Device Info
- 🔄 Firmware Restore

### **Universal:**
- 🎥 Video/Audio Conversion
- 🎞️ GIF Creator
- 📂 File Management
- 🔍 Device Detection

---

## 🛠️ Manual Installation (Advanced)

### **Windows:**
```powershell
# Install Scoop package manager
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install tools
scoop install adb scrcpy ffmpeg git nodejs-lts

# Install npm dependencies
npm install
```

### **macOS:**
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install tools
brew install android-platform-tools libimobiledevice scrcpy ffmpeg node

# Install npm dependencies
npm install
```

### **Linux (Ubuntu/Debian):**
```bash
# Update packages
sudo apt update

# Install tools
sudo apt install -y android-tools-adb android-tools-fastboot \
    libimobiledevice-utils scrcpy ffmpeg nodejs npm

# Install npm dependencies
npm install
```

---

## 🔧 Troubleshooting

### **"Command not found: adb"**
- **Windows:** Run `install.ps1` as Administrator
- **macOS:** Run `brew install android-platform-tools`
- **Linux:** Run `sudo apt install android-tools-adb`

### **"Device not detected"**
- Enable USB Debugging (Android)
- Trust This Computer (iOS)
- Try a different USB cable
- Restart ADB: `adb kill-server && adb start-server`

### **"Permission denied"**
- **Linux:** Add user to plugdev group:
  ```bash
  sudo usermod -aG plugdev $USER
  sudo udevadm control --reload-rules
  ```

### **"Port 3001 already in use"**
- Change port in `.env`:
  ```
  PORT=3002
  ```

---

## 📝 Scripts Included

| File | Purpose | Platform |
|------|---------|----------|
| `install.ps1` | One-click installer | Windows |
| `install.sh` | One-click installer | macOS/Linux |
| `START.bat` | One-click run | Windows |
| `start.sh` | One-click run | macOS/Linux |
| `package.json` | npm scripts | All |

---

## 🎉 You're Ready!

**Everything is set up. Just run:**

```bash
# Windows
START.bat

# macOS/Linux
./start.sh
```

**Then open:** http://localhost:3001

**Connect your device and start using Pandora Codex!** 🚀
