#!/bin/bash
# Complete Python Runtime Bundler (macOS/Linux)
# Downloads embedded Python, installs dependencies, and prepares for bundling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_DIR="$ROOT_DIR/python"
RUNTIME_DIR="$PYTHON_DIR/runtime"
EMBEDDED_DIR="$RUNTIME_DIR/python-embedded"

echo ""
echo "=== Complete Python Runtime Bundler ==="
echo ""

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
else
    echo "Unsupported platform: $OSTYPE"
    exit 1
fi

ARCH=$(uname -m)
echo "Platform: $PLATFORM ($ARCH)"
echo ""

# Create directories
mkdir -p "$PYTHON_DIR"
mkdir -p "$RUNTIME_DIR"
mkdir -p "$EMBEDDED_DIR"

# Python version
PYTHON_VERSION="3.12.1"
PYTHON_VERSION_SHORT="3.12"

if [[ "$PLATFORM" == "macos" ]]; then
    echo "=== macOS Python Runtime Bundle ==="
    echo ""
    echo "For macOS, we'll create a portable Python bundle"
    echo "or use system Python with proper paths"
    echo ""
    
    # Check if Python 3 is available
    if command -v python3 &> /dev/null; then
        PYTHON_CMD=$(which python3)
        echo "✓ Found system Python: $PYTHON_CMD"
        
        # Create a portable structure
        mkdir -p "$EMBEDDED_DIR/bin"
        mkdir -p "$EMBEDDED_DIR/lib"
        
        # Create launcher that uses system Python with proper paths
        cat > "$EMBEDDED_DIR/start-backend.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/../.."
export PYTHONPATH="$(pwd)/backend:$(pwd)/python/runtime/python-embedded:$PYTHONPATH"
python3 -m backend.main
EOF
        chmod +x "$EMBEDDED_DIR/start-backend.sh"
        echo "✓ Created launcher script"
        
    else
        echo "✗ Python 3 not found. Please install Python 3.12+"
        exit 1
    fi
    
elif [[ "$PLATFORM" == "linux" ]]; then
    echo "=== Linux Python Runtime Bundle ==="
    echo ""
    
    # Check if Python 3 is available
    if command -v python3 &> /dev/null; then
        PYTHON_CMD=$(which python3)
        echo "✓ Found system Python: $PYTHON_CMD"
        
        # Create launcher
        cat > "$EMBEDDED_DIR/start-backend.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/../.."
export PYTHONPATH="$(pwd)/backend:$(pwd)/python/runtime/python-embedded:$PYTHONPATH"
python3 -m backend.main
EOF
        chmod +x "$EMBEDDED_DIR/start-backend.sh"
        echo "✓ Created launcher script"
        
    else
        echo "✗ Python 3 not found. Please install Python 3.12+"
        exit 1
    fi
fi

# Install dependencies
echo ""
echo "Installing Python dependencies..."
REQUIREMENTS_FILE="$ROOT_DIR/requirements.txt"

if [[ -f "$REQUIREMENTS_FILE" ]]; then
    python3 -m pip install --upgrade pip --quiet
    python3 -m pip install -r "$REQUIREMENTS_FILE" --quiet
    echo "✓ Installed Python dependencies"
else
    echo "⚠ requirements.txt not found, skipping dependency installation"
fi

# Copy backend modules
echo ""
echo "Copying backend modules..."
BACKEND_SRC="$ROOT_DIR/backend"
BACKEND_DEST="$EMBEDDED_DIR/backend"

if [[ -d "$BACKEND_SRC" ]]; then
    if [[ -d "$BACKEND_DEST" ]]; then
        rm -rf "$BACKEND_DEST"
    fi
    cp -r "$BACKEND_SRC" "$BACKEND_DEST"
    echo "✓ Copied backend modules"
fi

echo ""
echo "=== Python Runtime Bundle Complete ==="
echo "Location: $EMBEDDED_DIR"
echo ""
echo "Next steps:"
echo "  1. Run: npm run prepare:bundle"
echo "  2. Run: npm run tauri:build"
echo ""
