#!/bin/bash
# Complete Build Script - macOS/Linux
# Builds Tauri app with Python runtime, Node.js, and all dependencies
# Creates DMG/PKG for macOS or AppImage for Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "=== Complete Bundle Build (macOS/Linux) ==="
echo ""

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
    TARGET="x86_64-apple-darwin"
    BUNDLES="dmg,app"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
    TARGET="x86_64-unknown-linux-gnu"
    BUNDLES="appimage"
else
    echo "Unsupported platform: $OSTYPE"
    exit 1
fi

echo "Platform: $PLATFORM"
echo "Target: $TARGET"
echo ""

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
cd "$ROOT_DIR"
npm install
if [ $? -ne 0 ]; then
    echo "npm install failed"
    exit 1
fi

# Step 2: Build frontend
echo ""
echo "Step 2: Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed"
    exit 1
fi

# Step 3: Prepare bundle (Node.js + Server + Python)
echo ""
echo "Step 3: Preparing bundle (Node.js + Server + Python)..."
npm run prepare:bundle
if [ $? -ne 0 ]; then
    echo "Bundle preparation failed"
    exit 1
fi

# Step 4: Copy Python runtime to Tauri bundle
echo ""
echo "Step 4: Copying Python runtime to Tauri bundle..."
PYTHON_RUNTIME="$ROOT_DIR/python/runtime/python-embedded"
TAURI_BUNDLE="$ROOT_DIR/src-tauri/bundle/resources/python/runtime"

if [ -d "$PYTHON_RUNTIME" ]; then
    if [ -d "$TAURI_BUNDLE" ]; then
        rm -rf "$TAURI_BUNDLE"
    fi
    mkdir -p "$(dirname "$TAURI_BUNDLE")"
    cp -r "$PYTHON_RUNTIME" "$TAURI_BUNDLE"
    echo "✓ Python runtime copied"
else
    echo "⚠ Python runtime not found, skipping..."
fi

# Step 5: Copy unified launcher
echo ""
echo "Step 5: Copying unified launcher..."
LAUNCHER_SRC="$SCRIPT_DIR/unified-launcher.sh"
LAUNCHER_DEST="$ROOT_DIR/src-tauri/bundle/resources/unified-launcher.sh"
if [ -f "$LAUNCHER_SRC" ]; then
    cp "$LAUNCHER_SRC" "$LAUNCHER_DEST"
    chmod +x "$LAUNCHER_DEST"
    echo "✓ Unified launcher copied"
fi

# Step 6: Build Tauri
echo ""
echo "Step 6: Building Tauri app..."
cd "$ROOT_DIR/src-tauri"

if [[ "$PLATFORM" == "macos" ]]; then
    cargo tauri build --target "$TARGET" --bundles "$BUNDLES"
else
    cargo tauri build --target "$TARGET" --bundles "$BUNDLES"
fi

if [ $? -ne 0 ]; then
    echo "Tauri build failed"
    exit 1
fi

# Step 7: Collect artifacts
echo ""
echo "Step 7: Collecting artifacts..."
cd "$ROOT_DIR"
ARTIFACTS_DIR="$ROOT_DIR/dist-artifacts/$PLATFORM"
mkdir -p "$ARTIFACTS_DIR"

TAURI_OUTPUT="$ROOT_DIR/src-tauri/target/$TARGET/release/bundle"

if [[ "$PLATFORM" == "macos" ]]; then
    # Copy DMG
    DMG=$(find "$TAURI_OUTPUT" -name "*.dmg" | head -1)
    if [ -n "$DMG" ]; then
        cp "$DMG" "$ARTIFACTS_DIR/"
        echo "✓ DMG copied: $(basename "$DMG")"
    fi
    
    # Copy PKG
    PKG=$(find "$TAURI_OUTPUT" -name "*.pkg" | head -1)
    if [ -n "$PKG" ]; then
        cp "$PKG" "$ARTIFACTS_DIR/"
        echo "✓ PKG copied: $(basename "$PKG")"
    fi
    
    # Copy .app bundle
    APP=$(find "$TAURI_OUTPUT/macos" -name "*.app" -type d | head -1)
    if [ -n "$APP" ]; then
        cp -r "$APP" "$ARTIFACTS_DIR/"
        echo "✓ App bundle copied: $(basename "$APP")"
    fi
else
    # Copy AppImage
    APPIMAGE=$(find "$TAURI_OUTPUT" -name "*.AppImage" | head -1)
    if [ -n "$APPIMAGE" ]; then
        cp "$APPIMAGE" "$ARTIFACTS_DIR/"
        chmod +x "$ARTIFACTS_DIR/$(basename "$APPIMAGE")"
        echo "✓ AppImage copied: $(basename "$APPIMAGE")"
    fi
fi

echo ""
echo "=== Build Complete ==="
echo ""
echo "Artifacts location: $ARTIFACTS_DIR"
echo ""
echo "The bundle includes:"
echo "  ✓ Frontend (React + Vite)"
echo "  ✓ Node.js runtime"
echo "  ✓ Node.js server"
echo "  ✓ Python runtime"
echo "  ✓ FastAPI backend"
echo "  ✓ All dependencies"
echo ""
echo "Ready for distribution! 🚀"
