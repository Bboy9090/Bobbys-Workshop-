# How to Create GitHub Release for v3.0.0

## Quick Steps

1. **Go to GitHub Releases Page:**
   https://github.com/Bboy9090/Bobbys-Workshop-/releases/new

2. **Fill in the form:**
   - **Tag:** Select `v3.0.0` from dropdown (or type it)
   - **Release title:** `v3.0.0 - Major Release with BootForge USB Hardening`
   - **Description:** Copy and paste the content from `RELEASE_NOTES_v3.0.0.md`

3. **Attach Files:**
   Drag and drop these files from the `dist/` folder:
   - `Bobbys Workshop_3.0.0_x64-setup.exe` (2.32 MB)
   - `Bobbys Workshop_3.0.0_x64_en-US.msi` (3.3 MB)
   - `bobbys-workshop.exe` (8.98 MB)

4. **Click "Publish release"**

## Alternative: Automated Script

If you have a GitHub Personal Access Token:

```powershell
# Set your token
$env:GITHUB_TOKEN = 'your-github-token-here'

# Run the script
powershell -File scripts/publish-github-release.ps1
```

To get a token:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select `repo` scope
4. Copy the token and use it above

## Files Location

All installer files are in: `C:\Users\Bobby\Bobbys-Workshop-\dist\`
