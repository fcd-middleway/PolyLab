#!/bin/bash
# PolyLab Desktop App - Build & Run Script

set -e

# Navigate to project root (script is in scripts/)
cd "$(dirname "$0")/.."

echo "🖥️  PolyLab Desktop Application"
echo "================================"
echo ""

echo "🔨 Building polylab-desktop (Rust native)..."
cargo build --release --bin polylab-desktop

echo ""
echo "✅ Build complete!"
echo ""
echo "🚀 Launching desktop viewer..."
echo ""

cargo run --release --bin polylab-desktop
