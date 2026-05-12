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
│   └── polylab-renderer/         # Crate #2: Rendering logic
│       ├── Cargo.toml
│       └── src/lib.rs
├── app/web/                      # TypeScript web application
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
**Purpose**: Core 3D data structures and algorithms

**Contains:**
- `Mesh`, `Vertex`, `Face` types
- .obj parser (Week 2)
- Compression algorithms (later)
- Math utilities

**Why separate?**
- Reusable in both web and desktop apps
- Can be compiled to WebAssembly
- Pure logic, no rendering code

### `polylab-renderer`
**Purpose**: WebGPU rendering wrapper

**Contains:**
- WebGPU initialization
- Shader management
- Camera logic
- Rendering pipeline

**Why separate?**
- Clean separation of concerns (data vs rendering)
- Could swap renderer without changing core
- Easier to test in isolation

## 🔄 How Crates Work Together

```
polylab-renderer  →  depends on  →  polylab-core
       ↓                                  ↓
  Rendering logic              Data structures & parsing
```

In `crates/polylab-renderer/Cargo.toml`:
```toml
[dependencies]
polylab-core = { path = "../polylab-core" }
```

This creates a **local dependency** between crates.

## 📝 Summary

- **Crate** = Rust's name for a library/package
- **`crates/` folder** = Convention for organizing multiple related crates
- **Workspace** = Umbrella configuration managing multiple crates
- **Our approach** = Modular architecture (core logic separate from rendering)

This structure will make it easy to:
- Share code between web and desktop
- Test each component independently
- Add new crates (e.g., `polylab-math`, `polylab-compression`)
