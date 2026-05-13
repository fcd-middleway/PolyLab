# 🗺️ PolyLab Roadmap

**Iterative development approach** - Each phase builds on the previous one organically.

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────┐
│         APP (Orchestration + UI)        │  ← TypeScript web app
│  - Project management                   │
│  - UI (menus, toolbars, controls)       │
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
│  - polylab-perlin    (terrain gen)      │
│  - polylab-rover     (stereo vision)    │
│  - polylab-compression (progressive)    │
│  - Pure logic, no rendering, no UI      │
└─────────────────────────────────────────┘
```

**Key principle**: Clean separation of concerns. Each layer is independent and reusable.

---

## 📅 Development Phases

### **Phase 1: Viewer Engine Foundation** 🎬
**Goal**: Create a reusable 3D rendering engine (Rust crate)

**Scope**: `polylab-viewer` crate - WebGPU-based renderer with camera system

#### Iteration 1.1: WebGPU Hello World ✅
**Tasks**:
- Setup `polylab-viewer` crate with wgpu dependency
- Initialize WebGPU context
- Render a simple colored triangle
- Basic render loop

**Deliverable**: Triangle visible on screen (proof WebGPU works)

**Status**: ✅ **COMPLETED** (13 mai 2026)
- Triangle RGB avec dégradé de couleurs s'affiche correctement
- Migration wgpu 22.1 → 29.0 pour Chrome 135+ compatibility
- WASM compilation fonctionnelle avec wasm-pack

**Resources**:
- [Learn wgpu](https://sotrh.github.io/learn-wgpu/)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)

---

#### Iteration 1.1.5: Code Refactoring 🔧
**Tasks**:
- Clarify code structure in `renderer.rs` (separate WebGPU setup from render logic)
- Add detailed comments explaining WebGPU concepts
- Improve error handling and logging
- Extract configuration into dedicated modules if needed
- Clean up imports and dependencies

**Deliverable**: Cleaner, more maintainable codebase

**Rationale**: Establish good practices before adding complexity

---

#### Iteration 1.1.8: Desktop Native Support 🖥️
**Tasks**:
- Create native desktop entry point (winit-based window)
- Adapt code with `#[cfg(target_arch = "wasm32")]` vs native
- Surface creation: HTML canvas (WASM) vs winit window (native)
- Test both compilation targets: `cargo build` and `wasm-pack build`
- Ensure same rendering code works for both targets

**Deliverable**: App runs natively on desktop AND as WASM in browser

**Rationale**: Avoid accumulating platform-specific issues by supporting both targets early

**Technical notes**:
- Use `winit` crate for cross-platform windowing
- wgpu already supports both WASM (WebGPU) and native (Vulkan/Metal/DX12)
- Conditional compilation for surface creation only

---

#### Iteration 1.2: Mesh Rendering
**Tasks**:
- Load mesh from `polylab-core` (already has Mesh struct)
- Create vertex/index buffers from mesh data
- Write basic vertex + fragment shaders
- Render a static .obj mesh (cube, teapot)

**Deliverable**: Static 3D mesh visible on screen

**Technical notes**:
- Vertex shader: transform positions with MVP matrix
- Fragment shader: solid color for now (lighting later)

---

#### Iteration 1.3: Orbit Camera
**Tasks**:
- Implement arcball camera (orbit around mesh center)
- Mouse input: drag to rotate, scroll to zoom
- Camera struct with view + projection matrices
- Update shader uniforms each frame

**Deliverable**: Interactive viewer - rotate around mesh with mouse

**Technical notes**:
- Camera position: spherical coordinates (azimuth, elevation, distance)
- View matrix: lookAt from camera to mesh center
- Projection: perspective with configurable FOV

---

**Phase 1 Completion**: `polylab-viewer` is a working rendering engine (library crate)

---

### **Phase 2: App Foundation + Perlin Terrain** 🏔️
**Goal**: Build the app structure and first project (procedural terrain)

**Scope**: TypeScript app + `polylab-perlin` module + integration

#### Iteration 2.1: App Structure
**Tasks**:
- Create app architecture (ProjectManager, UI components)
- Main menu (File, Projects, View, Help)
- Project selector dropdown
- Canvas component wrapping viewer
- Toolbar (load, export, settings)

**Files to create**:
```
app/web/src/
├── main.ts                    # Entry point
├── core/
│   ├── ProjectManager.ts      # Manages active project
│   ├── BaseProject.ts         # Abstract project class
│   └── types.ts
├── ui/
│   ├── Menu.ts
│   ├── Toolbar.ts
│   ├── ProjectPanel.ts
│   └── Canvas.ts
└── styles/
    └── main.css
```

**Deliverable**: App shell with menu + canvas (no project yet)

---

#### Iteration 2.2: Perlin Noise Module
**Tasks**:
- Create `polylab-perlin` crate
- Implement 2D Perlin noise algorithm
- Generate heightmap from noise
- Convert heightmap to mesh (grid of vertices + triangular faces)
- Expose WASM API

**API**:
```rust
pub struct PerlinParams {
    pub size: u32,        // Grid size (e.g., 128x128)
    pub scale: f32,       // Noise scale
    pub octaves: u32,     // Number of octaves
    pub persistence: f32, // Amplitude multiplier per octave
}

pub fn generate_terrain(params: PerlinParams) -> Mesh
```

**Deliverable**: `polylab-perlin` crate that generates terrain meshes

**Resources**:
- [Understanding Perlin Noise](https://adrianb.io/2014/08/09/perlinnoise.html)

---

#### Iteration 2.3: Perlin Project Integration
**Tasks**:
- Create `PerlinProject.ts` class
- Integrate perlin module (WASM) with viewer
- Generate terrain on project creation
- Display in viewer

**File**:
```typescript
// app/web/src/projects/PerlinProject.ts
export class PerlinProject extends BaseProject {
  private params: PerlinParams;
  
  async init() {
    await initPerlin(); // Init WASM
    this.generate();
  }
  
  generate() {
    const mesh = generate_terrain(this.params);
    this.viewer.renderMesh(mesh);
  }
}
```

**Deliverable**: Menu → "New Perlin Project" → Terrain appears

---

#### Iteration 2.4: Perlin Controls UI
**Tasks**:
- Add project panel (right sidebar)
- Controls: sliders for octaves, scale, persistence
- "Regenerate" button
- Real-time parameter updates

**Deliverable**: Tweak perlin params → see terrain change instantly

---

**Phase 2 Completion**: Working app with first project (Perlin terrain generation)

---

### **Phase 3: FPS Camera + Enhanced Terrain** 🎮
**Goal**: Navigate inside the procedural world

**Scope**: Viewer FPS camera + Perlin improvements

#### Iteration 3.1: FPS Camera
**Tasks**:
- Add FPS camera mode to `polylab-viewer`
- WASD movement + mouse look
- Toggle between Orbit / FPS modes
- Collision with terrain (optional)

**Deliverable**: Walk around in the generated terrain

---

#### Iteration 3.2: Enhanced Perlin
**Tasks**:
- Multi-octave Perlin (fractal detail)
- Larger terrains (optimize mesh generation)
- Colorization by altitude (grass, rock, snow)
- Optional: infinite terrain (chunk generation)

**Deliverable**: Richer, more interesting terrains

---

**Phase 3 Completion**: Explorable procedural world

---

### **Phase 4: Rover Stereoscopic Vision** 🤖
**Goal**: 3D reconstruction from stereo cameras

**Scope**: `polylab-rover` module + RoverProject

#### Iteration 4.1: Rover Module
**Tasks**:
- Create `polylab-rover` crate
- Simulate 2 virtual cameras in 3D scene
- Render from both viewpoints (stereo pair)
- Disparity calculation (stereo matching algorithm)
- Generate point cloud from disparities

**API**:
```rust
pub struct StereoCamera {
    pub baseline: f32,  // Distance between cameras
    pub fov: f32,
}

pub fn reconstruct_3d(
    left_image: &Image, 
    right_image: &Image, 
    camera: &StereoCamera
) -> PointCloud
```

**Deliverable**: `polylab-rover` crate for stereo reconstruction

**Resources**:
- [Stereo Vision Tutorial](https://docs.opencv.org/master/dd/d53/tutorial_py_depthmap.html)

---

#### Iteration 4.2: Rover Project Integration
**Tasks**:
- Create `RoverProject.ts`
- Place rover in Perlin terrain (or custom scene)
- Display stereo camera views (side-by-side)
- Reconstruct 3D + display point cloud
- Basic rover movement (arrow keys)

**Deliverable**: Menu → "New Rover Project" → Stereo reconstruction

---

#### Iteration 4.3: Viewer - Point Cloud Rendering
**Tasks**:
- Add point cloud rendering to `polylab-viewer`
- Render points with colors
- Point size control

**Deliverable**: Viewer supports both meshes and point clouds

---

**Phase 4 Completion**: Functional rover with 3D reconstruction

---

### **Phase 5: Viewer for Compression** 📦
**Goal**: Prepare viewer for progressive decompression

**Scope**: LOD system + streaming infrastructure

#### Iteration 5.1: Level of Detail (LOD)
**Tasks**:
- Mesh simplification algorithm (decimation)
- Generate multiple LOD levels from mesh
- Display different LODs based on camera distance
- Viewer: switch LOD dynamically

**Deliverable**: Viewer displays simplified meshes when far away

---

#### Iteration 5.2: Progressive Loading
**Tasks**:
- Load mesh in chunks (base mesh → refinements)
- Display base mesh immediately
- Add details progressively
- Simulate streaming behavior

**Deliverable**: Infrastructure ready for compression

---

**Phase 5 Completion**: Viewer supports progressive mesh loading

---

### **Phase 6: Progressive Mesh Compression** 🎓
**Goal**: THE FINAL PROJECT - PhD revisited

**Scope**: `polylab-compression` module + CompressionProject

#### Iteration 6.1: Basic Compressor
**Tasks**:
- Create `polylab-compression` crate
- Implement mesh compression algorithm (based on PhD work)
- Encoder: Mesh → CompressedData
- Decoder: CompressedData → Mesh
- Test with simple meshes

**Deliverable**: Working compression/decompression

---

#### Iteration 6.2: Progressive Decompression
**Tasks**:
- Base mesh + refinement levels
- Progressive decoder (decode by steps)
- Integrate with viewer (display increasing quality)
- Real-time visualization of decompression

**Deliverable**: See mesh quality improve progressively

---

#### Iteration 6.3: Compression Project + UI
**Tasks**:
- Create `CompressionProject.ts`
- UI: load mesh, compress, decompress, visualize
- Metrics: compression ratio, PSNR, visual error
- Parameter tweaking (quality vs size)
- Export compressed format

**Deliverable**: Full compression application in the browser

---

**Phase 6 Completion**: Working progressive mesh compression system 🎉

---

### **Phase 7+: Future Projects** 🚀
**Ideas for later** (as inspiration strikes):

- **Mesh Editor**: Vertex manipulation, extrusion, subdivision
- **Advanced Shaders**: Water, PBR materials, post-processing
- **Physics**: Collision detection, gravity, rigid bodies
- **Animation**: Skeletal animation, morphing, keyframes
- **Scientific Viz**: Volume rendering, vector fields
- **Multiplayer**: Collaborative 3D editing (ambitious!)

---

## 📊 Estimated Timeline (2-4h/week)

| Phase | Duration | Cumulative Months |
|-------|----------|-------------------|
| Phase 1 (Viewer engine) | 4-6 weeks | **Month 1-2** |
| Phase 2 (App + Perlin) | 4-5 weeks | **Month 3-4** |
| Phase 3 (FPS + terrain) | 3-4 weeks | **Month 4-5** |
| Phase 4 (Rover stereo) | 5-6 weeks | **Month 6-7** |
| Phase 5 (Viewer LOD) | 3-4 weeks | **Month 8-9** |
| Phase 6 (Compression) | 8-10 weeks | **Month 10-12** |

**~12 months to full compression app** (at relaxed pace)

---

## 🎯 Current Status

**Active Phase**: Phase 0 - Rust Learning (Week 1)  
**Next Milestone**: Phase 1.1 - WebGPU Hello World  
**Project Started**: May 12, 2026

---

## 🔑 Key Principles

1. **Step-by-step progression** - User decides when to move forward
2. **Iterative development** - Each feature evolves over time
3. **Clean architecture** - Viewer, modules, and app are independent
4. **Visual feedback early** - Every iteration produces something visible
5. **Organic evolution** - Each phase naturally prepares the next

---

## 📝 Notes

- Phases are flexible - can adjust based on learnings
- Each iteration is ~3-4 weeks at current pace (2-4h/week)
- Focus on shipping working features, not perfection
- Compression is the final goal, but we build foundations first
- The viewer capabilities will emerge from project needs, not speculation
