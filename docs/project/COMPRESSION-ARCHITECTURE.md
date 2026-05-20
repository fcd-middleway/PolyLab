# Architecture Mode Compression

## 🏗️ Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                      TypeScript (UI Layer)                       │
│                                                                  │
│  ┌────────────────────┐        ┌──────────────────────┐        │
│  │ CompressionProject │────────│   UI Components      │        │
│  │                    │        │  - MeshPanel         │        │
│  │ - compressMesh()   │        │  - PropertiesPanel   │        │
│  │ - generateLODs()   │        │  - StatusBar         │        │
│  │ - updateSlider()   │        │  - LOD Slider 🆕     │        │
│  └────────┬───────────┘        └──────────────────────┘        │
│           │                                                      │
│           │ JS calls                                             │
│           ▼                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ WASM Boundary
            │
┌───────────▼──────────────────────────────────────────────────────┐
│                  Rust (WASM Layer - polylab-viewer)              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              ViewerHandle (lib.rs)                      │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn create_compression_handle(...)                  │    │
│  │      → CompressionHandle                                │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn update_mesh_from_handle(...)                    │    │
│  │                                                         │    │
│  │  Other mesh management:                                 │    │
│  │  - add_mesh(id, vertices, indices)                      │    │
│  │  - remove_mesh(id)                                      │    │
│  │  - render()                                             │    │
│  └────────────────────────────────────────────────────────┘    │
│           │                                                      │
│           │ depends on                                           │
│           ▼                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │
┌───────────▼──────────────────────────────────────────────────────┐
│           Rust (Logic Layer - polylab-compression)               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │          CompressionHandle (wasm_api.rs) 🆕            │    │
│  │                                                         │    │
│  │  Fields:                                                │    │
│  │  - mesh_id: String                                      │    │
│  │  - original_mesh: Mesh                                  │    │
│  │  - current_aif: AIF                                     │    │
│  │  - lods: Vec<LODSnapshot>                               │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn new(mesh_id, vertices, faces) → Self            │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn simplify_step(ratio) → JsValue                  │    │
│  │      → collapse edges, update AIF, return stats         │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn generate_lods(num_lods) → JsValue               │    │
│  │      → progressive simplification, store snapshots      │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn get_lod_mesh(index) → JsValue                   │    │
│  │      → convert LOD snapshot to (vertices, faces)        │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn reset() → JsValue                               │    │
│  │      → restore original mesh, rebuild AIF               │    │
│  │                                                         │    │
│  │  #[wasm_bindgen]                                        │    │
│  │  pub fn get_stats() → JsValue                           │    │
│  │      → { vertices, faces, edges, compression_ratio }    │    │
│  └────────────┬───────────────────────────────────────────┘    │
│               │                                                  │
│               │ uses                                             │
│               ▼                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                 AIF Module (aif/)                       │    │
│  │                                                         │    │
│  │  - types.rs      (Vertex, Edge, Face, Corner)          │    │
│  │  - storage.rs    (AIF struct, SlotMaps)                │    │
│  │  - queries.rs    (navigation, boundary detection)      │    │
│  │  - operations.rs (add/remove, collapse_edge)           │    │
│  │  - conversion.rs (from_mesh, to_mesh)                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de données - Chargement d'un mesh

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Load Mesh" in UI                                │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CompressionProject.openFilePicker()                          │
│    → reads .obj file → extracts vertices, faces                 │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. viewer.create_compression_handle(mesh_id, vertices, faces)   │
│    [TypeScript → WASM call]                                     │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. CompressionHandle::new(mesh_id, vertices, faces)             │
│    - Create polylab_core::Mesh from raw data                    │
│    - Convert Mesh → AIF (using AIF::from_mesh)                  │
│    - Store original_mesh and current_aif                        │
│    - Return handle                                              │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. viewer.add_mesh(mesh_id, vertices, faces)                    │
│    [Separate call to render the mesh]                           │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. compressionHandle.get_stats() → JsValue                      │
│    Returns: { vertices: 5000, faces: 9996, edges: 14994 }      │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. UI Update                                                     │
│    - MeshPanel: add mesh to list                                │
│    - PropertiesPanel: show stats                                │
│    - StatusBar: "Mesh loaded successfully"                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de données - Simplification (1 step)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "⚡ Simplify Step"                               │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CompressionProject.compressMesh()                            │
│    → compressionHandle.simplify_step(0.9)  // keep 90%          │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CompressionHandle::simplify_step(ratio)                      │
│    a. Collect all edge IDs from current_aif                     │
│    b. Calculate num_to_collapse = edges.len() * (1 - ratio)     │
│    c. Loop: collapse num_to_collapse edges randomly             │
│       - current_aif.collapse_edge(edge_id)                      │
│       - Record each collapse                                    │
│    d. Convert current_aif → Mesh (using AIF::to_mesh)           │
│    e. Extract vertices, faces as flat arrays                    │
│    f. Return JsValue:                                           │
│       {                                                         │
│         vertices: Vec<f32>,                                     │
│         faces: Vec<u32>,                                        │
│         stats: { vertices: 4500, faces: 8996, collapsed: 500 } │
│       }                                                         │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. viewer.update_mesh(mesh_id, new_vertices, new_faces)         │
│    [Update GPU buffers]                                         │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. UI Update                                                     │
│    - PropertiesPanel: update "Current" stats                    │
│    - StatusBar: "Simplified: -500 vertices"                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de données - Génération de LODs

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Generate LODs"                                  │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. compressionHandle.generate_lods(8)                           │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CompressionHandle::generate_lods(num_lods)                   │
│    a. Reset to original mesh                                    │
│    b. Calculate target ratios: [100%, 90%, 75%, 60%, ...]       │
│    c. For each ratio:                                           │
│       - Simplify to target ratio                                │
│       - Store snapshot: LODSnapshot {                           │
│           ratio: 0.9,                                           │
│           mesh: current_aif.to_mesh(),                          │
│           vertices: 4500,                                       │
│           faces: 8996                                           │
│         }                                                       │
│    d. Return JsValue: array of LOD metadata                     │
│       [                                                         │
│         { index: 0, ratio: 1.0, vertices: 5000 },              │
│         { index: 1, ratio: 0.9, vertices: 4500 },              │
│         ...                                                     │
│       ]                                                         │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. UI Update                                                     │
│    - Add LOD slider (0 → 7)                                     │
│    - PropertiesPanel: list LODs                                 │
│    - StatusBar: "Generated 8 LODs in 0.3s"                      │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. User moves slider → change LOD                               │
│    compressionHandle.get_lod_mesh(index)                        │
│    → returns { vertices, faces }                                │
│    viewer.update_mesh(mesh_id, vertices, faces)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Structure des données

### LODSnapshot (Rust)

```rust
pub struct LODSnapshot {
    pub ratio: f32,           // 1.0, 0.9, 0.75, ...
    pub mesh: Mesh,           // Snapshot du mesh à ce niveau
    pub vertices: usize,
    pub faces: usize,
}
```

### CompressionStats (JsValue)

```typescript
interface CompressionStats {
    vertices: number;
    faces: number;
    edges: number;
    corners: number;
    compression_ratio: number;  // 0.0 → 1.0
    max_error?: number;         // Phase 3
    avg_error?: number;         // Phase 3
}
```

### LODMetadata (JsValue)

```typescript
interface LODMetadata {
    index: number;
    ratio: number;      // 1.0, 0.9, 0.75, ...
    vertices: number;
    faces: number;
}
```

---

## 🛠️ Modifications des crates

### polylab-compression/Cargo.toml

```toml
[package]
name = "polylab-compression"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
polylab-core = { path = "../polylab-core" }
glam = "0.29"
slotmap = "1.0"

# WASM dependencies
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
js-sys = "0.3"

[target.'cfg(target_arch = "wasm32")'.dependencies]
console_error_panic_hook = "0.1"
console_log = "1.0"
log = "0.4"
```

### polylab-viewer/Cargo.toml

```toml
[dependencies]
# ... existing deps
polylab-compression = { path = "../polylab-compression" }
```

---

## 🔒 API Publique

### TypeScript (CompressionProject.ts)

```typescript
private compressionHandle: any = null;  // CompressionHandle from WASM

async loadMesh(meshId: string, vertices: Float32Array, faces: Uint32Array) {
    // Create compression handle
    this.compressionHandle = await viewer.create_compression_handle(
        meshId,
        Array.from(vertices),
        Array.from(faces)
    );
    
    // Add mesh to viewer
    viewer.add_mesh(meshId, vertices, faces);
    
    // Get stats
    const stats = this.compressionHandle.get_stats();
    this.updateUI(stats);
}

async compressMesh() {
    const result = this.compressionHandle.simplify_step(0.9);
    
    // Update viewer
    viewer.update_mesh(
        this.currentMeshId,
        new Float32Array(result.vertices),
        new Uint32Array(result.faces)
    );
    
    // Update UI
    this.updateUI(result.stats);
}

async generateLODs(numLods: number) {
    const lods = this.compressionHandle.generate_lods(numLods);
    
    // Create slider
    this.createLODSlider(lods);
}

async changeLOD(index: number) {
    const lodMesh = this.compressionHandle.get_lod_mesh(index);
    
    viewer.update_mesh(
        this.currentMeshId,
        new Float32Array(lodMesh.vertices),
        new Uint32Array(lodMesh.faces)
    );
}
```

---

## ✅ Checklist d'implémentation (Sprint 1)

### Rust (polylab-compression)
- [ ] Créer `src/wasm_api.rs`
- [ ] Implémenter `CompressionHandle` struct
- [ ] Implémenter `CompressionHandle::new()`
- [ ] Implémenter `CompressionHandle::simplify_step()`
- [ ] Implémenter `CompressionHandle::reset()`
- [ ] Implémenter `CompressionHandle::get_stats()`
- [ ] Tests unitaires

### Rust (polylab-viewer)
- [ ] Ajouter dépendance `polylab-compression`
- [ ] Ajouter méthode `create_compression_handle()`
- [ ] Ajouter méthode `update_mesh()` (si pas déjà présente)

### TypeScript (CompressionProject.ts)
- [ ] Modifier `compressMesh()` pour appeler WASM
- [ ] Ajouter `resetMesh()` method
- [ ] Mettre à jour `onMeshLoaded()`
- [ ] Ajouter affichage des stats dans PropertiesPanel

### Tests
- [ ] Test manuel : charger un cube
- [ ] Test manuel : simplifier 10 fois
- [ ] Test manuel : reset
- [ ] Vérifier stats cohérentes

---

## 🎯 Critères de succès (Sprint 1)

✅ Je peux charger un fichier OBJ  
✅ Je vois les stats initiales (vertices, faces, edges)  
✅ Je clique sur "Simplify" → le mesh perd 10% de vertices  
✅ Je clique plusieurs fois → le mesh devient progressivement plus simple  
✅ Je clique sur "Reset" → le mesh revient à l'état initial  
✅ Les stats sont cohérentes à chaque étape  

**Temps estimé** : 2-3 jours de développement
