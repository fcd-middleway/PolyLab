# PolyLab - Vision & Roadmap

## 🎯 Project Vision

**PolyLab** is a personal 3D experimentation project focused on creating a **modular, high-performance 3D viewer** for web browsers (and desktop).

### Origin

During my PhD in computer graphics, I worked on **progressive 3D mesh compression**. Originally implemented in C++, I now want to revisit these concepts with modern technologies, avoiding memory management issues.

### Long-term Goals

1. **High-performance 3D viewer** (browser + desktop)
   - Low-level control (custom shaders, WebGPU)
   - Modular and reusable architecture
   - Lightweight and responsive

2. **3D compression application** 
   - Mesh compression algorithms
   - Progressive decompression in the viewer
   - Real-time visualization

3. **Experimental projects**
   - 3D reconstruction via stereoscopic vision (rover with 2 cameras)
   - Other graphics experiments

### Tech Stack

- **Rust**: business logic, algorithms, 3D structures (compiles to WebAssembly)
- **WebGPU (wgpu)**: low-level 3D rendering, custom shaders (WGSL)
- **TypeScript**: UI, web glue, interactions
- **Tauri**: cross-platform desktop app (optional)

### Hosting

- **Azure Static Web Apps** for web app
- CI/CD deployment from GitHub

---

## 🗓️ Roadmap (4 weeks)

### Week 1: Rust Bootcamp 🦀
**Goal**: Learn Rust basics

- [ ] [The Rust Book](https://doc.rust-lang.org/book/) (chapters 1-10)
- [ ] [Rustlings](https://github.com/rust-lang/rustlings) (exercises)
- [ ] Understand ownership, borrowing, lifetimes
- [ ] **Mini-project**: Simple .obj file parser in Rust

### Week 2: PolyLab Core 📦
**Goal**: 3D data structures + .obj parser

- [ ] Define `Mesh`, `Vertex`, `Face` in `polylab-core`
- [ ] Implement complete .obj parser
- [ ] Unit tests
- [ ] First WebAssembly build

### Week 3: First WebGPU Render 🎨
**Goal**: Display a mesh on screen

- [ ] Setup `polylab-renderer` with wgpu
- [ ] Test triangle (WebGPU hello world)
- [ ] Display a simple .obj mesh
- [ ] Basic vertex/fragment shaders

### Week 4: Interactive Viewer 🎮
**Goal**: Functional 3D navigation

- [ ] Arcball camera (rotation, zoom, pan)
- [ ] TypeScript web UI (controls, file upload)
- [ ] Deployable web app
- [ ] (Optional) Tauri desktop app

---

## 📐 Target Architecture

**Three-layer architecture** for clean separation of concerns:

```
┌─────────────────────────────────────────┐
│         APP (Orchestration + UI)        │  ← TypeScript
│  - Project management                   │
│  - UI (menus, controls, toolbars)       │
│  - Glue between viewer and modules      │
└───────────────┬─────────────────────────┘
                │ uses
┌───────────────▼─────────────────────────┐
│      VIEWER (Rendering Engine)          │  ← Rust → WASM
│  - WebGPU wrapper                       │
│  - Camera system (orbit, FPS)           │
│  - Mesh & point cloud rendering         │
└───────────────┬─────────────────────────┘
                │ renders
┌───────────────▼─────────────────────────┐
│       MODULES (Business Logic)          │  ← Rust → WASM
│  - polylab-perlin    (terrain gen)      │
│  - polylab-rover     (stereo vision)    │
│  - polylab-compression (progressive)    │
└─────────────────────────────────────────┘
```

**File structure**:
```
PolyLab/
├── crates/
│   ├── polylab-core/         # 3D data structures, parsers
│   ├── polylab-viewer/       # Rendering engine (WebGPU)
│   ├── polylab-perlin/       # Procedural terrain generation
│   ├── polylab-rover/        # Stereoscopic vision
│   └── polylab-compression/  # Progressive mesh compression
├── app/
│   └── web/
│       ├── src/
│       │   ├── core/         # ProjectManager, types
│       │   ├── projects/     # PerlinProject, RoverProject, etc.
│       │   ├── ui/           # Menu, Toolbar, Canvas
│       │   └── main.ts
│       └── index.html
└── docs/                     # Technical documentation
```

---

## 🎓 Learning Resources

### Rust
- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)
- [Rustlings](https://github.com/rust-lang/rustlings)

### WebGPU
- [Learn wgpu](https://sotrh.github.io/learn-wgpu/)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [wgpu-rs docs](https://docs.rs/wgpu/latest/wgpu/)

### 3D Graphics
- [Learn OpenGL](https://learnopengl.com/) (concepts apply to WebGPU)
- [Real-Time Rendering](https://www.realtimerendering.com/)

---

**Start Date**: May 12, 2026  
**Current Status**: Setup phase and Rust learning
