# PolyLab - Project Overview

**Last updated**: 28 mai 2026

---

## 🎯 Project Vision

**PolyLab** is a personal 3D experimentation project focused on creating a **modular, high-performance 3D viewer** for web browsers and desktop.

### Origin

During my PhD in computer graphics, I worked on **progressive 3D mesh compression**. Originally implemented in C++, I now want to revisit these concepts with modern technologies (Rust + WebGPU), avoiding memory management issues.

### Tech Stack

- **Rust**: Business logic, algorithms, 3D structures (compiles to WebAssembly for web)
- **WebGPU (wgpu)**: Low-level 3D rendering, custom shaders (WGSL)
- **TypeScript**: UI, web glue, interactions
- **Vite**: Fast web development and build tool

### Core Architecture

```
┌─────────────────────────────────────────┐
│         APP (Orchestration + UI)        │  ← TypeScript web app
│  - Project management                   │
│  - UI (panels, toolbars, controls)      │
│  - Glue between viewer and modules      │
└───────────────┬─────────────────────────┘
                │ uses
┌───────────────▼─────────────────────────┐
│      VIEWER (Rendering Engine)          │  ← Rust crate → WASM
│  - WebGPU wrapper                       │
│  - Camera system                        │
│  - Mesh rendering                       │
│  - Pure rendering, no UI, no logic      │
└───────────────┬─────────────────────────┘
                │ renders data from
┌───────────────▼─────────────────────────┐
│       MODULES (Business Logic)          │  ← Rust crates → WASM
│  - polylab-terrain   (Perlin noise)     │
│  - polylab-rover     (stereo vision)    │
│  - polylab-core      (mesh structures)  │
└─────────────────────────────────────────┘
```

**Key principle**: Clean separation of concerns. Each layer is independent and reusable.

---

## 📦 Active Projects

### 1. **3D Viewer** (Foundation) ✅ OPERATIONAL
**Status**: Core viewer complete and functional

**Features**:
- ✅ WebGPU-based rendering (wgpu 29.0)
- ✅ Multi-platform support (web + desktop via winit)
- ✅ Camera controls (orbit, pan, zoom)
- ✅ Mesh loading (.obj format)
- ✅ Multiple render modes (solid, wireframe, vertices)
- ✅ Project system with BaseProject interface
- ✅ UI components (panels, toolbars, status bar)

**Completed iterations**:
- Phase 1.1: WebGPU Hello World (triangle rendering)
- Phase 1.1.5: Code refactoring and documentation
- Phase 1.1.8: Desktop support with winit
- Phase 1.2-1.7: Mesh loading, camera, UI components
- Viewer Iteration 7: Polish and keyboard shortcuts (Escape key)

---

### 2. **Rover Stereo Vision** 🚧 IN PROGRESS
**Status**: Iteration 1 complete, starting Iteration 2 (layouts)

**Goal**: Rover simulation with stereoscopic vision for 3D reconstruction

**Completed (Iteration 1)**:
- ✅ Keyboard controls (arrow keys: move forward/backward, rotate)
- ✅ 3rd person camera following the rover
- ✅ GPU-based mesh transformation (60 FPS smooth movement)
- ✅ Rover logical position tracking
- ✅ Basic scene (ground plane, rover mesh, target cube)

**Next (Iteration 2 - Layouts)**:
- 🎯 Stereo camera system (left/right cameras attached to rover)
- 🎯 Layout modes: Main Camera, Stereo Left, Stereo Right, Stereo Split
- 🎯 Switch between views in real-time

**Future iterations**:
- Ground collision detection (raycasting)
- Point cloud capture and visualization
- Depth map generation
- 3D reconstruction from stereo pairs

See: `docs/ROVER/` for detailed specs

---

### 3. **Procedural Terrain Generation** ✅ COMPLETE
**Status**: Perlin noise terrain generation implemented

**Features**:
- ✅ Perlin noise implementation in Rust
- ✅ Configurable terrain parameters (size, octaves, persistence)
- ✅ Mesh generation from heightmap
- ✅ WASM bindings for web integration
- ✅ Dedicated `polylab-terrain` crate

**Usage**: Can generate infinite procedural terrains for testing and visualization

See: `docs/TERRAIN/` for implementation details

---

### 4. **Progressive 3D Mesh Compression** 💡 PLANNED
**Status**: Not started - long-term main project

**Goal**: Implement progressive mesh compression algorithm from PhD research

**Key concepts**:
- Progressive transmission (coarse → detailed)
- Edge collapse simplification
- Incremental reconstruction
- Texture compression integration

**Why later**: Requires solid foundation (viewer, data structures, UI). Will build on top of completed projects.

See: `docs/COMPRESSION/` for theory and architecture

---

## 🗓️ Current Status (28 mai 2026)

### What's Working
- ✅ Core 3D viewer (web + desktop)
- ✅ Mesh rendering with multiple modes
- ✅ Camera controls and navigation
- ✅ Rover movement with keyboard controls
- ✅ GPU-based transformation (60 FPS)
- ✅ Procedural terrain generation

### In Progress
- 🚧 Rover Iteration 2: Stereo camera layouts

### Next Milestones
1. Implement stereo camera system
2. Add layout switching (multiple views)
3. Capture and display stereo images
4. Begin basic depth map visualization

---

## 📂 Repository Structure

```
PolyLab/
├── README.md                    # Main documentation
├── Cargo.toml                   # Rust workspace
├── docs/                        # 📚 All documentation
│   ├── PROJECT-OVERVIEW.md      # This file
│   ├── COMPRESSION/             # Compression project docs
│   ├── ROVER/                   # Rover project docs
│   └── TERRAIN/                 # Terrain generation docs
├── scripts/                     # 🔧 Utility scripts
│   ├── run-web-app.sh
│   └── run-desktop-app.sh
└── code/                        # 💻 All source code
    ├── crates/                  # Rust libraries
    │   ├── polylab-core/        # Shared mesh structures
    │   ├── polylab-viewer/      # WebGPU renderer (3.0 MB WASM)
    │   ├── polylab-rover/       # Stereo vision (595 KB WASM)
    │   └── polylab-terrain/     # Perlin noise (48 KB WASM)
    └── app/                     # Applications
        └── web/                 # TypeScript + Vite web app
```

---

## 🚀 Getting Started

### Prerequisites
- Rust + wasm-pack
- Node.js + npm

### Run Web App
```bash
./scripts/run-web-app.sh
```

### Run Desktop App
```bash
./scripts/run-desktop-app.sh
```

---

## 🎓 Learning Resources

- [Learn wgpu](https://sotrh.github.io/learn-wgpu/) - WebGPU rendering tutorial
- [WebGPU Fundamentals](https://webgpufundamentals.org/) - Core concepts
- [The Rust Book](https://doc.rust-lang.org/book/) - Rust language guide
