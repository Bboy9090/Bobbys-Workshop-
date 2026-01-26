#!/bin/bash
# Unified Launcher for Node.js Server + FastAPI Backend (macOS/Linux)
# Starts both services and manages their lifecycle

set -e

RESOURCE_DIR="${1:-$(dirname "$0")/..}"
NODE_PORT="${2:-3001}"
FASTAPI_PORT="${3:-8000}"

LOG_DIR="$HOME/.bobbysworkshop/logs"
mkdir -p "$LOG_DIR"

NODE_LOG="$LOG_DIR/node-server.log"
FASTAPI_LOG="$LOG_DIR/fastapi-backend.log"

echo "[Launcher] Starting services..." 

# Find Node.js executable
NODE_EXE=""
BUNDLED_NODE="$RESOURCE_DIR/nodejs/bin/node"
if [[ -f "$BUNDLED_NODE" ]]; then
    NODE_EXE="$BUNDLED_NODE"
elif command -v node &> /dev/null; then
    NODE_EXE=$(which node)
else
    echo "[Launcher] ERROR: Node.js not found!" >&2
    exit 1
fi

# Find Python executable
PYTHON_EXE=""
BUNDLED_PYTHON="$RESOURCE_DIR/python/runtime/python-embedded/bin/python3"
if [[ -f "$BUNDLED_PYTHON" ]]; then
    PYTHON_EXE="$BUNDLED_PYTHON"
elif command -v python3 &> /dev/null; then
    PYTHON_EXE=$(which python3)
else
    echo "[Launcher] ERROR: Python not found!" >&2
    exit 1
fi

# Start Node.js server
echo "[Launcher] Starting Node.js server on port $NODE_PORT..."
SERVER_PATH="$RESOURCE_DIR/server/index.js"
SERVER_DIR="$RESOURCE_DIR/server"

if [[ ! -f "$SERVER_PATH" ]]; then
    echo "[Launcher] ERROR: Server not found at $SERVER_PATH" >&2
    exit 1
fi

cd "$SERVER_DIR"
"$NODE_EXE" "$SERVER_PATH" > "$NODE_LOG" 2>&1 &
NODE_PID=$!
echo "[Launcher] Node.js server started (PID: $NODE_PID)"

# Start FastAPI backend
echo "[Launcher] Starting FastAPI backend on port $FASTAPI_PORT..."
BACKEND_DIR="$RESOURCE_DIR/python/runtime/python-embedded"

if [[ ! -d "$BACKEND_DIR/backend" ]]; then
    echo "[Launcher] WARNING: FastAPI backend not found, skipping..."
    FASTAPI_PID=""
else
    cd "$BACKEND_DIR"
    export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"
    "$PYTHON_EXE" -m uvicorn backend.main:app --host 127.0.0.1 --port "$FASTAPI_PORT" > "$FASTAPI_LOG" 2>&1 &
    FASTAPI_PID=$!
    echo "[Launcher] FastAPI backend started (PID: $FASTAPI_PID)"
fi

# Wait for services to be ready
echo "[Launcher] Waiting for services to be ready..."
sleep 3

# Check if services are running
if kill -0 $NODE_PID 2>/dev/null; then
    echo "[Launcher] ✓ Node.js server is running"
else
    echo "[Launcher] ✗ Node.js server failed to start"
    exit 1
fi

if [[ -n "$FASTAPI_PID" ]] && kill -0 $FASTAPI_PID 2>/dev/null; then
    echo "[Launcher] ✓ FastAPI backend is running"
else
    echo "[Launcher] ✗ FastAPI backend failed to start"
fi

echo "[Launcher] Services started. Logs: $LOG_DIR"
echo "[Launcher] Press Ctrl+C to stop all services"

# Cleanup function
cleanup() {
    echo ""
    echo "[Launcher] Shutting down services..."
    
    if [[ -n "$NODE_PID" ]] && kill -0 $NODE_PID 2>/dev/null; then
        kill $NODE_PID 2>/dev/null || true
        echo "[Launcher] Stopped Node.js server"
    fi
    
    if [[ -n "$FASTAPI_PID" ]] && kill -0 $FASTAPI_PID 2>/dev/null; then
        kill $FASTAPI_PID 2>/dev/null || true
        echo "[Launcher] Stopped FastAPI backend"
    fi
    
    echo "[Launcher] All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
while true; do
    sleep 1
    
    # Check if processes are still running
    if ! kill -0 $NODE_PID 2>/dev/null; then
        echo "[Launcher] Node.js server stopped unexpectedly"
        cleanup
    fi
    
    if [[ -n "$FASTAPI_PID" ]] && ! kill -0 $FASTAPI_PID 2>/dev/null; then
        echo "[Launcher] FastAPI backend stopped unexpectedly"
        cleanup
    fi
done
