# Project Organization

## 📦 What is a "Crate" in Rust?

In Rust, a **crate** is the fundamental unit of code organization. Think of it as:
- A **library** or **package** in other languages
- A compilation unit (Rust compiles one crate at a time)
- A distributable unit (you can publish crates to crates.io)

**Two types of crates:**
1. **Binary crate** (`main.rs`) - Produces an executable
2. **Library crate** (`lib.rs`) - Produces reusable code for other crates

## 🏗️ Our Project Structure

```
PolyLab/
├── Cargo.toml                    # Workspace configuration
├── crates/                       # All our custom Rust libraries
│   ├── polylab-core/             # Crate #1: Core data structures
│   │   ├── Cargo.toml            # Crate metadata & dependencies
│   │   └── src/
│   │       ├── lib.rs            # Library entry point
│   │       └── mesh.rs           # Mesh module
│   ├── polylab-viewer/           # Crate #2: Rendering engine
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── polylab-perlin/           # Crate #3: Terrain generation
│   │   └── ...
│   ├── polylab-rover/            # Crate #4: Stereo vision
│   │   └── ...
│   └── polylab-compression/      # Crate #5: Mesh compression
│       └── ...
├── app/web/                      # TypeScript application
│   ├── src/
│   │   ├── core/                 # ProjectManager, types
│   │   ├── projects/             # PerlinProject, RoverProject, etc.
│   │   ├── ui/                   # Menu, Toolbar, Canvas
│   │   └── main.ts
│   └── index.html
├── sandbox/                      # Your Rust learning experiments (git-ignored)
└── docs/                         # Documentation
```

## 🤔 Why "crates/" folder?

**Convention in the Rust ecosystem:**
- When a project contains **multiple related crates** (monorepo), they're often grouped in a `crates/` folder
- This is not mandatory, just a **widely adopted convention**
- Examples: [tokio](https://github.com/tokio-rs/tokio), [serde](https://github.com/serde-rs/serde), [bevy](https://github.com/bevyengine/bevy)

**Alternative names you might see:**
- `crates/` (most common)
- `libs/`
- Root-level crates (no subfolder)

## 🔗 Workspace Concept

Our `Cargo.toml` at the root defines a **workspace**:

```toml
[workspace]
members = [
    "crates/polylab-core",
    "crates/polylab-renderer",
]
```

**Benefits:**
- **Shared dependencies**: All crates use the same version of `glam`
- **Single build command**: `cargo build` compiles everything
- **Single `target/` folder**: Compiled artifacts in one place
- **Easier development**: Changes in one crate immediately available to others

## 📚 Our Crates Explained

### `polylab-core`
**Purpose**: Core 3D data structures and utilities

**Contains:**
- `Mesh`, `Vertex`, `Face` types
- .obj/.stl parser
- Math utilities (when needed)

**Why separate?**
- Shared foundation for all other crates
- Pure data structures, no logic
- Can be used standalone

### `polylab-viewer`
**Purpose**: 3D rendering engine (WebGPU wrapper)

**Contains:**
- WebGPU initialization and context
- Shader management (WGSL)
- Camera system (orbit, FPS)
- Mesh and point cloud rendering
- Pure rendering, no UI, no business logic

**Why separate?**
- Reusable rendering engine (library)
- Could be used in other projects
- Clean separation: rendering vs logic

### `polylab-perlin`
**Purpose**: Procedural terrain generation

**Contains:**
- Perlin noise algorithm
- Heightmap generation
- Mesh generation from heightmap
- Pure logic, no rendering

**Why separate?**
- Self-contained module
- Could generate terrain for other purposes
- Easy to test without UI/rendering

### `polylab-rover`
**Purpose**: Stereoscopic vision and 3D reconstruction

**Contains:**
- Stereo camera simulation
- Disparity calculation (stereo matching)
- Point cloud generation from disparities
- Pure logic, no rendering

**Why separate?**
- Independent vision processing module
- Could be used for real camera inputs
- Research-oriented component

### `polylab-compression`
**Purpose**: Progressive mesh compression (PhD work)

**Contains:**
- Mesh compression algorithms
- Progressive encoding/decoding
- Quality metrics (PSNR, geometric error)
- Pure logic, no rendering

**Why separate?**
- The crown jewel of the project
- Could be published as standalone lib
- Academic/research component

## 🔄 How Crates Work Together

**Three-layer architecture**:

```
┌─────────────────────────────────────────┐
│         APP (TypeScript)                │
│  - Orchestrates projects                │
│  - Manages UI (menus, controls)         │
│  - Glue code between layers             │
└───────┬─────────────────────────────────┘
        │ imports WASM
        ↓
┌───────────────────────────────────────────┐
│  polylab-viewer (Rust → WASM)            │
│  - Receives mesh/point cloud data       │
│  - Renders to canvas                    │
│  - Handles camera controls              │
└───────┬─────────────────────────────────┘
        │ uses
        ↓
┌───────────────────────────────────────────┐
│  polylab-core (Rust → WASM)              │
│  - Mesh data structures                  │
│  - Shared by all modules                 │
└─────────────────────────────────────────┘

        ┌─────────────────────────────────┐
        │  Modules (Rust → WASM)         │
        │  - polylab-perlin              │
        │  - polylab-rover               │
        │  - polylab-compression         │
        │  Each generates data for viewer│
        └─────────────────────────────────┘
```

**Example flow** (Perlin project):

1. **User action**: Clicks "New Perlin Project" in app
2. **App layer**: Creates `PerlinProject` instance
3. **Module layer**: Calls `polylab-perlin` (WASM) to generate terrain mesh
4. **Viewer layer**: Passes mesh to `polylab-viewer` (WASM) for rendering
5. **App layer**: Displays UI controls (sliders for octaves, scale, etc.)
6. **User tweaks params** → Loop back to step 3

**Dependencies**:
```
polylab-viewer  →  depends on  →  polylab-core
polylab-perlin  →  depends on  →  polylab-core
polylab-rover   →  depends on  →  polylab-core
polylab-compression → depends on → polylab-core

app (TypeScript) → imports all via WASM
```

In each module's `Cargo.toml`:
```toml
[dependencies]
polylab-core = { path = "../polylab-core" }
```

This creates **local dependencies** between crates, all managed by the workspace.

## 📝 Summary

- **Crate** = Rust's name for a library/package
- **`crates/` folder** = Convention for organizing multiple related crates
- **Workspace** = Umbrella configuration managing multiple crates
- **Our approach** = Modular architecture (core logic separate from rendering)

This structure will make it easy to:
- Share code between web and desktop
- Test each component independently
- Add new crates (e.g., `polylab-math`, `polylab-compression`)
