#!/bin/bash
# Phase 1.1 Build & Run Script

set -e

# Navigate to project root (script is in scripts/)
cd "$(dirname "$0")/.."

echo "🦀 PolyLab Phase 1.1 - WebGPU Hello World"
echo "========================================="
echo ""

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack is not installed."
    echo "Install it with:"
    echo "  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    exit 1
fi

# Check if rustup wasm target is installed
if ! rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
    echo "📦 Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

echo "🔨 Building polylab-viewer (Rust → WASM)..."
cd code/crates/polylab-viewer
wasm-pack build --target web --dev
cd ../../..

echo ""
echo "✅ WASM build complete!"
echo ""
echo "📦 Installing npm dependencies..."
cd code/app/web
npm install

echo ""
echo "🚀 Starting development server..."
echo ""
echo "Open your browser to: http://localhost:5173"
echo ""
npm run dev
