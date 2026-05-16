# 📋 Next Steps & Future Improvements

## ✅ Recently Completed (May 2026)

### Camera System ✅
- ✅ First-person camera with position-based movement (no drift)
- ✅ Orbital rotation around target (mouse drag)
- ✅ Keyboard controls: Arrow keys for movement, Q/D/Z/S for rotation
- ✅ Mouse wheel for forward/backward movement (no keyboard conflicts)
- ✅ Sensitivity tuning (moveSpeed=0.01, rotationSpeed=0.0025, mouseSensitivity=0.00125)
- ✅ AZERTY keyboard support
- ✅ Far clipping plane extended to 200.0 (supports 100x100 terrains)

### Perlin Terrain Generation ✅
- ✅ Configurable parameters (seed, octaves, persistence, scale, dimensions, resolution)
- ✅ Altitude-based color gradients (5 zones: water → beach → plains → mountains → snow)
- ✅ UI control panel with sliders and inputs
- ✅ Real-time terrain generation from browser
- ✅ Mesh visibility toggle in MeshPanel
- ✅ Integration with project system

### Rendering Improvements ✅
- ✅ Face culling enabled (Back faces) for better performance
- ✅ Per-vertex color system with GPU interpolation
- ✅ Extended far clipping plane (100.0 → 200.0)

---

## 🎨 Rendering & Visuals (Next Priority)

### Lighting System
**Why this matters**: Currently using flat per-vertex colors. Without lighting:
- No depth perception on terrain features
- Difficult to see relief and slopes
- No shadows to understand geometry

**Proposed implementation**:
1. **Directional light** (sun): Single light direction, affects all surfaces
2. **Ambient light**: Base illumination (prevents pure black)
3. **Per-face normals**: Calculate normal for each triangle for proper shading
4. **Simple Lambertian shading**: `color = ambient + diffuse * max(dot(normal, lightDir), 0)`

**Benefits**:
- Much better depth perception on terrain
- Easier to see slopes, valleys, peaks
- More realistic appearance
- Foundation for future PBR/advanced lighting

**Estimated effort**: Medium (2-3 hours)
- Add light uniforms to shaders
- Calculate face normals in terrain generation
- Update fragment shader for lighting calculation

---

## 🎯 UI/UX Improvements

### Mesh Selection for Orbital Rotation
**Current**: Orbital rotation around fixed origin (0,0,0)

**Enhancement**:
- Click mesh in MeshPanel to select it
- Set orbital target to mesh bounding box center
- Multiple selection: orbit around combined center
- Visual feedback (highlight selected mesh)

**Benefits**: Better navigation around specific terrain areas

**Priority**: Medium

---

### Project Panel Evolution
**Current**: Separate MeshPanel and DetailsPanel/PerlinControlPanel

**Vision**: Unified ProjectPanel with tabs/sections:
- **Meshes**: List with visibility, selection, delete
- **Lights**: When lighting system is implemented
- **Camera**: Presets, saved positions
- **Export**: Save terrain as OBJ, heightmap

**Priority**: Low (after lighting)

---

## 🏔️ Advanced Terrain Features (Future)

### Erosion Simulation
- Hydraulic erosion (water flow)
- Thermal erosion (slope-based)
- More realistic terrain shapes

### Biome System
- Temperature/humidity maps
- Biome-specific colors (desert, forest, tundra, etc.)
- Vegetation placement

### Level of Detail (LOD)
- Multiple resolution levels
- Distance-based switching
- Better performance on large terrains

### Export/Import
- Save terrain as OBJ file
- Export heightmap as PNG
- Load saved terrains

**Priority**: Low (nice-to-have features)

---

## 🚀 Performance & Optimization (Future)

- Frustum culling (don't render off-screen geometry)
- Occlusion culling
- Instanced rendering for repeated objects
- GPU-accelerated terrain generation (compute shaders)
- Progressive mesh loading

---

## 📊 Current Status

**Last Completed**: Perlin Terrain UI Controls + Camera Improvements (May 2026) ✅  
**Recommended Next**: **Lighting System** for better terrain visualization  
**Alternative Next**: Mesh selection for targeted orbital rotation

---

## 💡 Proposed Next Steps

### Option A: Lighting (Recommended)
1. Add directional light to scene
2. Calculate per-face normals for terrain
3. Implement basic Lambertian shading in fragment shader
4. Add UI controls for light direction and intensity

**Why**: Dramatically improves terrain appearance, foundation for future work

### Option B: Mesh Selection
1. Make mesh items in MeshPanel selectable
2. Track selected mesh ID in PerlinProject
3. Update orbital target when selection changes
4. Add visual highlight for selected mesh

**Why**: Improves navigation, useful for large/multiple terrains

### Option C: Advanced Terrain
1. Implement erosion algorithm (hydraulic or thermal)
2. Add erosion parameters to control panel
3. Apply erosion post-processing after generation

**Why**: More realistic terrain generation, interesting visual results

