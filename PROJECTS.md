# 🚀 Projects & Ideas

List of experimental sub-projects to develop around the PolyLab 3D viewer.

---

## 📦 Planned Projects

### 1. Progressive 3D Mesh Compression
**Status**: 🎯 Main long-term project

**Description**:
- 3D mesh compression algorithm
- Progressive decompression in the viewer
- Real-time visualization of increasing mesh quality
- Based on PhD research work

**Technologies**:
- Rust for compression/decompression algorithms
- WebGPU for progressive rendering
- Format support: .obj, .stl, .ply

**Applications**:
- 3D streaming for web (progressive loading)
- Efficient transmission of complex 3D models
- Adaptive visualization based on bandwidth

---

### 2. Stereoscopic Vision Rover
**Status**: 💡 Idea

**Description**:
- Rover simulation equipped with 2 2D cameras
- 3D world reconstruction via stereovision
- Autonomous navigation in an environment

**Technologies**:
- Stereovision (disparity calculation between 2 images)
- Real-time 3D reconstruction
- Potentially: pathfinding, obstacle detection

**Technical Challenges**:
- Camera calibration
- Pixel correspondence (stereo matching)
- 3D map construction (point cloud → mesh)

---

### 3. Procedural World Generation
**Status**: 💡 Idea

**Description**:
- Terrain, landscape, 3D structure generation
- Procedural algorithms (Perlin noise, fractals, etc.)
- Explorable infinite world

**Technologies**:
- Terrain generation (heightmaps)
- LOD (Level of Detail) for performance
- Shaders for effects (water, vegetation, etc.)

**Applications**:
- Exploration of randomly generated worlds
- Test viewer capabilities on large scenes
- Foundation for simulation or game projects

---

### 4. Mesh Editor
**Status**: 💡 Idea

**Description**:
- Interface to create/modify 3D meshes
- Basic operations: vertex displacement, extrusion, subdivision
- Export to standard formats

**Technologies**:
- Interactive UI (vertex/face picking)
- Real-time geometric manipulation
- Edit history (undo/redo)

**Applications**:
- Rapid prototyping tool
- Mesh preparation for compression
- Simple model creation without external software

---

## 🗓️ Priorities

1. **Short term (W1-W4)**: Functional 3D viewer
2. **Medium term**: Progressive compression (main project)
3. **Long term**: Other projects as inspiration strikes

---

## 💭 Other Ideas

_(To be completed over time)_

- Advanced visual effects (custom shaders)
- Mesh animation (skeleton, skinning)
- Physics (collision, gravity)
- Scientific data visualization in 3D
- ...
