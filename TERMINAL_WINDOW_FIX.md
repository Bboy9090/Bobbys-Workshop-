# 🔧 Terminal Window Bug Fix

**Issue:** Terminal boxes opening and closing nonstop  
**Root Cause:** Backend server using `Stdio::inherit()` in debug mode  
**Status:** ✅ FIXED

---

## ✅ Fix Applied

**File:** `src-tauri/src/main.rs` (lines ~1157-1180)

**Changed:**
- **Before:** In debug mode, backend used `Stdio::inherit()` which caused terminal windows to open
- **After:** Always redirect stdout/stderr to log file, even in debug mode

**Result:** No more terminal windows popping up!

---

## 📝 Log File Location

Backend logs are now written to:
```
%LOCALAPPDATA%\BobbysWorkshop\logs\backend.log
```

Or:
```
%TEMP%\bobbysworkshop\logs\backend.log
```

---

## 🔍 How to View Logs

If you need to see backend output:

1. **Open log file:**
   ```powershell
   notepad "$env:LOCALAPPDATA\BobbysWorkshop\logs\backend.log"
   ```

2. **Or tail logs:**
   ```powershell
   Get-Content "$env:LOCALAPPDATA\BobbysWorkshop\logs\backend.log" -Wait -Tail 50
   ```

---

## ✅ Verification

After rebuilding the app:
- ✅ No terminal windows should open
- ✅ Backend still runs normally
- ✅ All output goes to log file
- ✅ App functions normally

---

**Fix Date:** 2025-01-27  
**Status:** ✅ Fixed - Terminal windows suppressed
