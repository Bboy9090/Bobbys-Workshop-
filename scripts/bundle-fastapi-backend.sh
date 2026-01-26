#!/bin/bash
# Bundle FastAPI Backend for Tauri
# Copies FastAPI backend to bundle resources

set -e

echo ""
echo "📦 Bundling FastAPI Backend..."
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FASTAPI_SOURCE="$ROOT_DIR/python/fastapi_backend"
BUNDLE_TARGET="$ROOT_DIR/src-tauri/bundle/resources/python/fastapi_backend"

# Create target directory
echo "Creating target directory: $BUNDLE_TARGET"
mkdir -p "$BUNDLE_TARGET"

# Copy FastAPI backend (exclude cache files)
echo "Copying FastAPI backend files..."
rsync -av --exclude '__pycache__' \
          --exclude '*.pyc' \
          --exclude '.pytest_cache' \
          --exclude '*.log' \
          "$FASTAPI_SOURCE/" "$BUNDLE_TARGET/"

# Create __init__.py if missing
if [ ! -f "$BUNDLE_TARGET/__init__.py" ]; then
    touch "$BUNDLE_TARGET/__init__.py"
fi

echo ""
echo "✅ FastAPI Backend bundled successfully!"
echo ""
echo "Location: $BUNDLE_TARGET"
