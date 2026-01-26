# Unified Launcher for Node.js Server + FastAPI Backend
# Starts both services and manages their lifecycle

$ErrorActionPreference = "Stop"

param(
    [string]$ResourceDir = $PSScriptRoot,
    [int]$NodePort = 3001,
    [int]$FastAPIPort = 8000
)

$LogDir = Join-Path $env:APPDATA "BobbysWorkshop\logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$NodeLog = Join-Path $LogDir "node-server.log"
$FastAPILog = Join-Path $LogDir "fastapi-backend.log"

Write-Host "[Launcher] Starting services..." -ForegroundColor Cyan

# Find Node.js executable
$NodeExe = $null
$BundledNode = Join-Path $ResourceDir "nodejs\node.exe"
if (Test-Path $BundledNode) {
    $NodeExe = $BundledNode
} else {
    $NodeExe = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $NodeExe) {
        Write-Host "[Launcher] ERROR: Node.js not found!" -ForegroundColor Red
        exit 1
    }
}

# Find Python executable
$PythonExe = $null
$BundledPython = Join-Path $ResourceDir "python\runtime\python-embedded\python.exe"
if (Test-Path $BundledPython) {
    $PythonExe = $BundledPython
} else {
    $PythonExe = Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $PythonExe) {
        Write-Host "[Launcher] ERROR: Python not found!" -ForegroundColor Red
        exit 1
    }
}

# Start Node.js server
Write-Host "[Launcher] Starting Node.js server on port $NodePort..." -ForegroundColor Yellow
$ServerPath = Join-Path $ResourceDir "server\index.js"
$ServerDir = Join-Path $ResourceDir "server"

if (-not (Test-Path $ServerPath)) {
    Write-Host "[Launcher] ERROR: Server not found at $ServerPath" -ForegroundColor Red
    exit 1
}

$NodeProcess = Start-Process -FilePath $NodeExe -ArgumentList $ServerPath -WorkingDirectory $ServerDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $NodeLog -RedirectStandardError $NodeLog
Write-Host "[Launcher] Node.js server started (PID: $($NodeProcess.Id))" -ForegroundColor Green

# Start FastAPI backend
Write-Host "[Launcher] Starting FastAPI backend on port $FastAPIPort..." -ForegroundColor Yellow
$BackendPath = Join-Path $ResourceDir "python\runtime\python-embedded\backend\main.py"
$BackendDir = Join-Path $ResourceDir "python\runtime\python-embedded"

if (-not (Test-Path $BackendPath)) {
    Write-Host "[Launcher] WARNING: FastAPI backend not found, skipping..." -ForegroundColor Yellow
} else {
    $FastAPIProcess = Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", $FastAPIPort -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $FastAPILog -RedirectStandardError $FastAPILog
    Write-Host "[Launcher] FastAPI backend started (PID: $($FastAPIProcess.Id))" -ForegroundColor Green
}

# Wait for services to be ready
Write-Host "[Launcher] Waiting for services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Check if services are running
$NodeRunning = Get-Process -Id $NodeProcess.Id -ErrorAction SilentlyContinue
if ($NodeRunning) {
    Write-Host "[Launcher] ✓ Node.js server is running" -ForegroundColor Green
} else {
    Write-Host "[Launcher] ✗ Node.js server failed to start" -ForegroundColor Red
}

if ($FastAPIProcess) {
    $FastAPIRunning = Get-Process -Id $FastAPIProcess.Id -ErrorAction SilentlyContinue
    if ($FastAPIRunning) {
        Write-Host "[Launcher] ✓ FastAPI backend is running" -ForegroundColor Green
    } else {
        Write-Host "[Launcher] ✗ FastAPI backend failed to start" -ForegroundColor Red
    }
}

Write-Host "[Launcher] Services started. Logs: $LogDir" -ForegroundColor Cyan
Write-Host "[Launcher] Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Keep script running and handle cleanup
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if processes are still running
        if (-not (Get-Process -Id $NodeProcess.Id -ErrorAction SilentlyContinue)) {
            Write-Host "[Launcher] Node.js server stopped unexpectedly" -ForegroundColor Red
            break
        }
        
        if ($FastAPIProcess -and -not (Get-Process -Id $FastAPIProcess.Id -ErrorAction SilentlyContinue)) {
            Write-Host "[Launcher] FastAPI backend stopped unexpectedly" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "[Launcher] Shutting down services..." -ForegroundColor Yellow
    
    if ($NodeProcess -and (Get-Process -Id $NodeProcess.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $NodeProcess.Id -Force
        Write-Host "[Launcher] Stopped Node.js server" -ForegroundColor Green
    }
    
    if ($FastAPIProcess -and (Get-Process -Id $FastAPIProcess.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $FastAPIProcess.Id -Force
        Write-Host "[Launcher] Stopped FastAPI backend" -ForegroundColor Green
    }
    
    Write-Host "[Launcher] All services stopped" -ForegroundColor Green
}
