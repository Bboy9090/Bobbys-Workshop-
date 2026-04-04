Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "🚀 INITIATING PHOENIX FORGE ENTERPRISE COMPILATION" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Ensuring dependencies
if (-Not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "[-] ERROR: Python is not installed or not in target path." -ForegroundColor Red
    exit
}

# STEP 1: Python Engine Obfuscation & Compilation
Write-Host "`n[1/4] Compiling Python Backend to C-Level Machine Code..." -ForegroundColor Yellow
Write-Host "[*] Using Nuitka for maximum reverse-engineering protection." -ForegroundColor DarkGray

# Check for Nuitka
python -m pip install nuitka zstandard --quiet

# We compile the FastAPI server into a standalone executable.
# --onefile makes it a single binary, --standalone includes all dependencies.
python -m nuitka --standalone --onefile --remove-output --output-dir=dist backend/server.py

if (-Not (Test-Path "dist\server.exe")) {
    Write-Host "[-] FATAL: Python compilation failed." -ForegroundColor Red
    exit
}
Write-Host "[+] Backend compiled successfully." -ForegroundColor Green

# STEP 2: Tauri Sidecar Injection
Write-Host "`n[2/4] Injecting Python Engine into Rust Sidecar..." -ForegroundColor Yellow
$TargetTriple = "x86_64-pc-windows-msvc" # Standard 64-bit Windows target
$SidecarName = "phoenix_backend-$TargetTriple.exe"
$SidecarDir = "src-tauri\binaries"

# Create the binaries folder if it doesn't exist
if (-Not (Test-Path $SidecarDir)) { New-Item -ItemType Directory -Force -Path $SidecarDir | Out-Null }

# Move the compiled Python .exe into the Tauri Rust folder with the specific triple name
Move-Item -Path "dist\server.exe" -Destination "$SidecarDir\$SidecarName" -Force
Write-Host "[+] Sidecar injected: $SidecarName" -ForegroundColor Green

# STEP 3: React UI Compilation
Write-Host "`n[3/4] Building React/Tailwind Dashboard..." -ForegroundColor Yellow
# Using npx --package typescript tsc to ensure the compiler is correctly invoked
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] FATAL: React frontend compilation failed." -ForegroundColor Red
    exit
}
Write-Host "[+] UI compiled successfully." -ForegroundColor Green

# STEP 4: Rust/Tauri Final Bundling
Write-Host "`n[4/4] Forging the final Executable and MSI Installer..." -ForegroundColor Yellow
npx tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] FATAL: Tauri Rust compilation failed." -ForegroundColor Red
    exit
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "✅ PHOENIX FORGE BUILD COMPLETE." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Your installer is ready at: src-tauri\target\release\bundle\msi\" -ForegroundColor White
