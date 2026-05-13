# 🦀 PolyLab

**Modular and high-performance 3D viewer for web and desktop**

Personal 3D graphics experimentation project based on Rust + WebGPU, with long-term goal of progressive mesh compression.

📖 **See [docs/project/VISION.md](docs/project/VISION.md) for full context and roadmap**

---

## 🏗️ Project Structure

```
PolyLab/
├── docs/                       # 📚 Documentation
│   ├── project/                # Vision, roadmap, architecture
│   └── phases/                 # Phase-specific docs
├── scripts/                    # 🔧 Build and utility scripts
├── code/                       # 💻 Source code
│   ├── crates/                 # Rust libraries
│   │   ├── polylab-core/       # 3D data structures
│   │   └── polylab-viewer/     # WebGPU rendering engine
│   └── app/
│       └── web/                # TypeScript + Vite web app
└── target/                     # Build artifacts
```

---

## 🚀 Quick Start

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable) ✅
- [Node.js](https://nodejs.org/) (v20+) ✅
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

### Install wasm-pack

```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### Phase 1.1 - WebGPU Hello World 🎬

**Easy way** (automated script):
```bash
./scripts/run-phase1.sh
```

**Manual way**:
```bash
# 1. Add WASM target
rustup target add wasm32-unknown-unknown

# 2. Build viewer to WASM
cd code/crates/polylab-viewer
wasm-pack build --target web --dev
cd ../../..

# 3. Launch web app
cd code/app/web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) - you should see a **colored triangle**! 🎉

---

## 🧪 Testing Rust Crates

### Compile all crates

```bash
# Compile everything
cargo build

# Run tests
cargo test
```

---

## 📚 Learning Rust

**New to Rust?** Start with:

1. [The Rust Book](https://doc.rust-lang.org/book/) (chapters 1-10)
2. [Rustlings](https://github.com/rust-lang/rustlings) (interactive exercises)
3. Focus on ownership, borrowing and lifetimes (chapters 4-5)

---

## 🗓️ Roadmap

| Week | Goal |
|---------|----------|
| **W1** | Learn Rust + mini .obj parser project |
| **W2** | 3D structures + complete parser |
| **W3** | First WebGPU render |
| **W4** | Interactive viewer with camera |

Details in [VISION.md](VISION.md).

---

## 📝 Status

**Current Phase**: Setup and Rust learning  
**Started**: May 12, 2026

---

## 📄 License

MIT
