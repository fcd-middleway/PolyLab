# 📋 Next Steps & Future Improvements

## 🎨 Rendering & Visuals

### Lighting System (High Priority)
**Context**: Currently using per-vertex color interpolation (normalized position * 0.5 + 0.5) which creates colorful gradients. This works as a placeholder but lacks depth perception.

**Problem**: 
- Faces are slightly transparent (can see triangle through cube)
- No shadows or highlights to show edges/relief
- Without lighting, a solid color would make objects flat and hard to interpret

**Solution needed**:
- Implement basic lighting (directional light, ambient, diffuse)
- Add proper face normals for shading
- Consider Phong or PBR shading model
- Fix transparency/depth testing issues

**When**: After completing Perlin noise work, when returning to core viewer improvements

---

## 🎯 UI/UX Improvements

### Project Panel Evolution
**Current**: MeshPanel only shows mesh list with visibility checkboxes

**Vision**: Transform MeshPanel into a comprehensive ProjectPanel with:
- **Meshes section**: List of loaded meshes with visibility toggles
- **Lights section**: List of scene lights (directional, point, spot)
  - Enable/disable lights
  - Adjust intensity, color, position
- **Textures section**: List of loaded textures
  - Preview thumbnails
  - Memory usage info
- **Materials section** (future): Assign materials to meshes
- **Scene hierarchy** (future): Parent/child relationships

**Benefits**:
- Centralized scene management (standard for 3D viewers)
- Better organization for complex scenes
- Easier debugging and inspection

**Priority**: Medium (after lighting system)

---

## 🔧 Camera System

### Initial Camera Positioning
**Current behavior**: Camera starts at `(0, 2, 10)` with yaw=0, pitch=0
- Slightly elevated (y=2) for better default view
- Looking toward origin from back (+Z direction)

**Alternative approaches**:
1. **Centered + slight rotation**: Camera at `(X, Y, Z)` with yaw=angle to see object from 3/4 view
2. **Auto-framing**: Calculate bounding box, position camera to frame entire scene
3. **User preference**: Save/load last camera position

**Configuration location**: `code/crates/polylab-viewer/src/camera.rs`, method `Camera::new()`
```rust
pub fn new() -> Self {
    Self {
        position: Vec3::new(0.0, 2.0, 10.0), // ← Change here
        yaw: 0.0,                             // ← Initial yaw angle
        pitch: 0.0,                           // ← Initial pitch angle
        // ...
    }
}
```

---

## 🎲 Perlin Noise & Terrain (Active Work)

### Completed (Iteration 2.2)
- ✅ Perlin noise terrain generation with configurable parameters
- ✅ Seed-based generation for reproducibility
- ✅ Multi-octave noise (configurable detail)
- ✅ Integration with viewer (generate from UI)

### Next terrain features
- Color gradients based on height (blue → green → brown → white)
- Erosion simulation
- Biome-based generation
- Mesh LOD (level of detail)

---

## 🚀 Performance & Optimization

### Future considerations
- Frustum culling (don't render off-screen meshes)
- Occlusion culling
- Instanced rendering for repeated geometry
- Progressive mesh loading for large models
- GPU-accelerated computations (compute shaders)

---

## 📊 Status

**Current Phase**: Iteration 2.2 (Perlin Terrain Generation) ✅  
**Next Phase**: Continue Perlin noise exploration before returning to viewer enhancements  
**Camera controls**: Fully functional (FPS + orbital rotation) ✅
