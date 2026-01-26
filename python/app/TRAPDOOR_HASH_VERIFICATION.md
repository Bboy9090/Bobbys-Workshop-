# Trapdoor Hash Verification Guide

## Overview

The Trapdoor module includes SHA256 hash verification to ensure tool authenticity before execution. This prevents execution of tampered or malicious binaries.

## How It Works

1. **Hash Storage**: Each tool in `TOOLS` dictionary has an optional `sha256` field
2. **Verification**: Before execution, the module calculates the SHA256 hash of the tool file
3. **Comparison**: The calculated hash is compared against the expected hash
4. **Blocking**: If hashes don't match, execution is blocked with a security alert

## Adding Hash Verification

### Step 1: Calculate the Hash

On **Linux/macOS**:
```bash
shasum -a 256 path/to/tool
```

On **Windows** (PowerShell):
```powershell
Get-FileHash -Path "path\to\tool" -Algorithm SHA256
```

### Step 2: Update trapdoor.py

Find the tool in the `TOOLS` dictionary and replace `None` with the hash:

```python
"palera1n": {
    "path": os.path.join(PRIVATE_BASE, "palera1n-main", "palera1n"),
    "desc": "Palera1n Jailbreak Tool",
    "args": ["-v"],
    "type": "bin",
    "sha256": "a1b2c3d4e5f6..."  # Replace None with actual hash
}
```

### Step 3: Verify It Works

Run the trapdoor menu and select the tool. You should see:
```
[SECURITY] Verifying tool authenticity...
[VERIFY] ✓ Hash verified for palera1n
```

## Security Behavior

### Hash Configured and Matches
- ✅ Tool executes normally
- Logs: `[VERIFY] ✓ Hash verified for {tool}`

### Hash Configured but Mismatch
- ❌ Execution BLOCKED
- Displays detailed error with expected vs actual hash
- User must re-download from official source

### No Hash Configured
- ⚠️ Tool executes with warning
- Logs: `[WARNING] No SHA256 hash configured for {tool}. Skipping verification.`
- **Recommendation**: Add hash verification for production use

## Getting Official Hashes

### From GitHub Releases
Most tools publish SHA256 hashes in their release notes:
1. Go to the tool's GitHub releases page
2. Find the release you downloaded
3. Look for "SHA256" or "Checksums" section
4. Copy the hash for your platform

### From Official Websites
- **Palera1n**: https://github.com/palera1n/palera1n/releases
- **Checkra1n**: https://checkra.in/releases
- **ADB/Fastboot**: https://developer.android.com/studio/releases/platform-tools

### From Package Managers
If you installed via package manager, verify the package hash:
```bash
# Homebrew (macOS)
brew info adb  # Shows hash info

# apt (Linux)
apt-cache show adb  # Shows SHA256
```

## Example: Adding Hash for Palera1n

1. Download palera1n from official source
2. Calculate hash:
   ```bash
   shasum -a 256 ~/.bootforge_private/palera1n-main/palera1n
   # Output: 3f8a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
   ```
3. Update `trapdoor.py`:
   ```python
   "palera1n": {
       "sha256": "3f8a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
   }
   ```

## Troubleshooting

### "HASH MISMATCH" Error

**Cause**: File doesn't match expected hash

**Solutions**:
1. Re-download from official source
2. Verify you're using the correct version
3. Check if file was corrupted during download
4. Update hash in code if using a different version

### "Failed to calculate file hash"

**Cause**: File access or read error

**Solutions**:
1. Check file permissions: `chmod +x path/to/tool`
2. Verify file exists and is readable
3. Check disk space and file system integrity

### Hash Verification Skipped

**Cause**: No hash configured (sha256 is None)

**Action**: Add hash verification following steps above

## Best Practices

1. **Always verify hashes from official sources** - Don't trust third-party sites
2. **Update hashes when upgrading tools** - Different versions have different hashes
3. **Document hash sources** - Add comments in code showing where hash came from
4. **Use version control** - Commit hash updates so team members have correct values
5. **Regular audits** - Periodically verify all tools still match their hashes

## Security Notes

- Hash verification prevents execution of tampered binaries
- It does NOT prevent malicious code if the official tool itself is compromised
- Always download from official, verified sources
- Consider code signing verification for additional security (future enhancement)
