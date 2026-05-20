# polylab-compression

Progressive mesh compression/decompression for **non-manifold polygonal textured meshes**.

This crate implements a **progressive codec** based on edge contraction/vertex expansion operations, preserving topology, geometry, and texture parameterization. It supports:

- ✅ Non-manifold meshes (complex edges, boundary edges, isolated edges)
- ✅ Polygonal faces (triangles, quads, n-gons)
- ✅ Textured meshes with UV seams/discontinuities
- ✅ Lossless reconstruction (after preprocessing)
- ✅ Progressive transmission (multiple levels of detail)

**Based on**: PhD thesis *"Compression progressive de maillages surfaciques texturés"*, Florian Caillaud, INSA Lyon, 2017.

---

## 🎯 Current Status

**Phase 0: Skeleton** ✅  
**Phase 1.1: Bitstream** ✅  
**Phase 1.2: Arithmetic Coder** ✅  
**Phase 2.1: AIF Data Structure** ✅  
**Phase 2.2: Mesh I/O** ✅  
**Next**: Phase 2.3 - Advanced mesh operations / Phase 3 - Decimation waves

**Tests**: 66 unit tests + 4 doctests passing  
**Example**: See `examples/mesh_simplification.rs`

---

## 🚀 Quick Start

```bash
# Run the mesh simplification example
cargo run -p polylab-compression --example mesh_simplification
```

This demonstrates the complete workflow:
1. Create a mesh (quad as 2 triangles)
2. Convert to AIF structure
3. Collapse an internal edge
4. Convert back to mesh

```rust
use polylab_compression::aif::{AIF, TopologicalOperations};
use polylab_core::mesh::Mesh;

let mut aif = AIF::from_mesh(&mesh);
println!("Edges: {}", aif.num_edges());

// Simplify
aif.collapse_edge(edge_id);

// Export
let simplified = aif.to_mesh();
```

---

## 🏗️ Architecture Overview

The codec is built on three **independent pillars**:

```
┌──────────────────────┐
│ Entropy Coding       │ ← Interchangeable compression module
│ (Phase 1)            │   (arithmetic coder, range coder, etc.)
└──────────────────────┘

┌──────────────────────┐
│ AIF Data Structure   │ ← Foundation for non-manifold polygonal meshes
│ (Phase 2)            │   (vertices, edges, faces, corners)
└──────────────────────┘

┌──────────────────────┐
│ Codec Logic          │ ← Core compression/decompression pipeline
│ (Phases 3-6)         │   (simplification ↔ refinement)
│ • Contraction        │
│ • Expansion          │
└──────────────────────┘
```

### Core Concepts

- **Contraction**: Merge two vertices `s0` and `s1` into one vertex `s` (placed at edge midpoint)
- **Expansion**: Split vertex `s` back into `s0` and `s1` (inverse operation)
- **Waves**: Group of independent contractions forming one level of detail
- **Reconstruction info**: Data needed to reverse a contraction (geometry, connectivity, orientation, UVs)
- **Progressive stream**: Sequence of waves enabling gradual mesh refinement

---

## 📋 Implementation Roadmap

### **Phase 1: Entropy Coding Module** 🔧

**Objective**: Generic binary compression/decompression, independent of mesh data.

#### **Phase 1.1: Bitstream Basics** ✅
- [x] `BitWriter` for bit-level writing (1 to 32 bits)
- [x] `BitReader` for bit-level reading
- [x] Unit tests on simple patterns
- [x] Integration tests (write → read → verify)

**Deliverables**:
```rust
// src/entropy/bitstream.rs
struct BitWriter { /* ... */ }
struct BitReader { /* ... */ }
```

#### **Phase 1.2: Arithmetic Coder** ✅
- [x] Basic arithmetic encoder/decoder using range coding
- [x] Adaptive probability model with frequency updates
- [x] Multiple contexts support (for different symbol types)
- [x] 17 unit tests covering roundtrip, compression, edge cases
- [x] Benchmarked: 100 repeated 'A' compresses to < 100 bytes

**Deliverables**:
```rust
// src/entropy/arithmetic.rs
struct ArithmeticEncoder { /* ... */ }
struct ArithmeticDecoder { /* ... */ }
struct Context { /* ... */ }  // Adaptive probability model
```

**Alternative**: Start with simpler encoding (Huffman, or debug JSON format) and upgrade later.

**Recommendation**: Validate logic with **uncompressed debug format** first, then optimize.

---

### **Phase 2: AIF Data Structure** 🏗️

**Objective**: Represent **all** surface meshes (triangular, polygonal, 2-manifold, non-manifold).

The **AIF (Adjacency and Incidence Framework)** is essential for handling:
- Complex edges (incident to 3+ faces)
- Boundary edges (1 face)
- Isolated edges/vertices
- Polygonal faces (variable degree)
- UV corners (multiple UVs per vertex)

#### **Phase 2.1: Core Entities** ✅
- [x] `Vertex` (position, incident edges)
- [x] `Edge` (2 vertices, incident faces, boundary detection)
- [x] `Face` (ordered edges, corners, valence)
- [x] `Corner` (vertex-face association, UV, normal)
- [x] `AIF` storage using SlotMap for O(1) operations
- [x] Topological queries (navigation, adjacency)
- [x] Topological operations (add/remove, edge collapse)
- [x] Memory compaction for large-scale simplification
- [x] 17 unit tests covering all operations

**Deliverables**:
```rust
// src/aif/types.rs
struct Vertex { position: Vec3, edges: Vec<EdgeId> }
struct Edge { vertex1, vertex2, faces: Vec<FaceId> }
struct Face { edges: Vec<EdgeId>, corners: Vec<CornerId> }
struct Corner { vertex, face, uv, normal }

// src/aif/storage.rs
struct AIF {
    vertices: SlotMap<VertexId, Vertex>,
    edges: SlotMap<EdgeId, Edge>,
    faces: SlotMap<FaceId, Face>,
    corners: SlotMap<CornerId, Corner>,
}

// src/aif/operations.rs
impl TopologicalOperations for AIF {
    fn add_vertex(&mut self, pos: Vec3) -> VertexId;
    fn add_edge(&mut self, v1, v2) -> Option<EdgeId>;
    fn add_face(&mut self, edges) -> Option<FaceId>;
    fn collapse_edge(&mut self, edge_id) -> Option<VertexId>;
    // ... remove operations, compaction
}
```

**Performance**:
- Insertion/deletion: O(1) with SlotMap
- Compaction: O(n) triggered every 10k operations or when fill rate < 50%
- Memory: Scales with actual mesh size, not initial capacity

**Critical constraints**:
- Bidirectional incidence relations
- Edge state detection (isolated, boundary, normal, complex)
- Variable valence support
- Stable IDs during modifications

#### **Phase 2.2: Mesh I/O** ✅
- [x] `AIF::from_mesh()` - Import from polylab_core::Mesh
- [x] `AIF::to_mesh()` - Export to polylab_core::Mesh with triangulation
- [x] UV and normal preservation through Corner structure
- [x] 6 unit tests covering roundtrip, attributes, edge cases

**Deliverables**:
```rust
// src/aif/conversion.rs
impl AIF {
    pub fn from_mesh(mesh: &core::Mesh) -> Self;
    pub fn to_mesh(&self) -> core::Mesh;
}
```

**Validation**: Triangle meshes, shared edges, attribute preservation (UVs, normals)

#### **Phase 2.3: Modification Operations** ⚠️ *Critical for decimation*
- [ ] `merge_vertices(v1, v2)` → new vertex
- [ ] `split_vertex(v)` → (v1, v2)
- [ ] `remove_edge()`, `remove_face()`
- [ ] `resolve_duplicate_edges()`, `resolve_duplicate_faces()`

**Intensive tests**:
- Merge vertices with different valences
- Face removal → edge updates
- Duplicate resolution after merging
- Topological consistency verification

#### **Phase 2.4: Import/Export**
- [ ] `from_obj()`, `from_ply()`
- [ ] `to_obj()`, `to_ply()`

**Validation**: Load → Save → Reload → Compare

**Deliverables**:
- `polylab-core/src/mesh/aif/` (complete module)
- 50+ unit tests
- Test fixtures in `tests/fixtures/`

---

### **Phase 3: Simplification via Edge Contraction** ⚡

**Objective**: Decimate mesh by contracting edges, **without yet encoding reconstruction info**.

#### **Phase 3.1: Basic Contraction Operation**
- [ ] `contract_edge(e)` → `ContractionInfo`
- [ ] Midpoint placement: `s = (s0 + s1) / 2`
- [ ] Identify invalid faces (incident triangles)
- [ ] Merge vertices, resolve duplicates
- [ ] Update UV corners

**Algorithm** (from thesis):
1. Compute midpoint position `s = (s0 + s1) / 2`
2. Identify faces becoming invalid
3. Merge `s0` and `s1` → `s`
4. Resolve duplicate edges/faces
5. Remove contracted edge
6. Update UV corners

**Tests**:
- Contract normal edge (2 adjacent faces)
- Contract boundary edge (1 face)
- Contract complex edge (3+ faces)
- Verify topology after contraction
- Verify geometry (midpoint position)

#### **Phase 3.2: Priority Queue + Simple Metric**
- [ ] `SimplificationQueue` with binary heap
- [ ] `edge_weight_simple()` (edge length criterion)
- [ ] Full mesh simplification to M0

**Tests**:
- Simplify complete mesh to M0
- Verify M0 validity (isolated vertices)
- Count contractions performed

#### **Phase 3.3: Non-Contractable Edge Detection**
- [ ] `is_contractable()` (topological checks)
- [ ] Detect conflicts with neighboring contractions
- [ ] Independence constraint (waves)

**Deliverables**:
```rust
// src/simplification/contraction.rs
struct ContractionInfo { edge, vertex_result, removed_faces }
impl Mesh {
    fn contract_edge(&mut self, e: EdgeId) -> Result<ContractionInfo>;
}
```

---

### **Phase 4: Refinement via Vertex Expansion** 🔄

**Objective**: **Reverse** contractions to progressively reconstruct mesh.

#### **Phase 4.1: Capture Reconstruction Information**
- [ ] `ReconstructionInfo` struct:
  - Geometry: `displacement_vector` (s → s0, where s1 = -displacement)
  - Connectivity: `edge_codes[]` (0 = to s0, 1 = to s1, special cases)
  - Orientation: `face_orientations[]`
  - UV: `corner_uvs[]` (region_id, coordinates)
- [ ] `contract_edge_with_info()` → (vertex, info)

**Tests**:
- Capture info before contraction
- Verify completeness of information

#### **Phase 4.2: Expansion Operation**
- [ ] `expand_vertex(v, info)` → reconstructed edge
- [ ] Create `s0` and `s1` from `s` and `displacement_vector`
- [ ] Redistribute incident edges using `edge_codes`
- [ ] Reconstruct faces using `face_codes`
- [ ] Restore orientations
- [ ] Reconstruct edge `s0s1`
- [ ] Restore UV corners

**Critical tests**:
- ✅ **Full reversibility test**: Simplify → Refine → Compare with original
- Test on triangular meshes
- Test on polygonal meshes
- Test on non-manifolds
- Test with textures/UVs

#### **Phase 4.3: Complete Encode → Decode Pipeline**
```rust
fn test_full_roundtrip() {
    let mesh_original = Mesh::from_obj("bunny.obj");
    
    // Simplification
    let (mesh_simplified, reconstruction_stack) = simplify_mesh(&mesh_original);
    
    // Reconstruction
    let mesh_reconstructed = refine_mesh(&mesh_simplified, &reconstruction_stack);
    
    // Lossless verification
    assert_eq!(mesh_original, mesh_reconstructed);
}
```

**Deliverables**:
```rust
// src/reconstruction/expansion.rs
impl Mesh {
    fn expand_vertex(&mut self, v: VertexId, info: &ReconstructionInfo) -> Result<EdgeId>;
}
```

**Major checkpoint**: ✅ **Perfect reversibility guaranteed**

---

### **Phase 5: Preprocessing** 🔧

**Objective**: Quantization, vertex merging, connected components.

#### **Phase 5.1: Geometry and UV Quantization**
- [ ] `QuantizationParams` (geometry_bits, uv_bits, bbox)
- [ ] `quantize_geometry()`, `dequantize_geometry()`

#### **Phase 5.2: Colocated Vertex Merging**
- [ ] `merge_colocated_vertices(epsilon)` → count

**Documentation**: Explain that this merging is not reversed (by design).

#### **Phase 5.3: Connected Component Merging** *(optional)*
- [ ] `merge_connected_components()` → isolated edges added

---

### **Phase 6: Progressive Stream Encoding/Decoding** 📦

**Objective**: Serialize contractions in waves, create binary format.

#### **Phase 6.1: Stream Structure**
```rust
struct ProgressiveStream {
    header: Header,
    waves: Vec<Wave>,
}

struct Header {
    quantization_params: QuantizationParams,
    m0_vertices: Vec<Vec3>,
    spanning_tree_roots: Vec<VertexId>,
}

struct Wave {
    tree_traversal: Vec<u8>,  // 0/1 codes for traversal
    contractions: Vec<ReconstructionInfo>,
}
```

#### **Phase 6.2: Spanning Tree + Deterministic Traversal**
- [ ] `build_spanning_tree(mesh, root)` → tree
- [ ] `traverse_tree(tree, visitor)`

#### **Phase 6.3: Wave Encoding**
- [ ] `encode_wave(mesh, contractions)` → Wave
- [ ] `decode_wave(mesh, wave)` → Result

**Tests**:
- Encode → Decode single wave
- Encode → Decode all waves
- Verify identical reconstruction

---

### **Phase 7+: Advanced Features** *(deferred)*

- [ ] Combined metric `pcomb = 0.5 * phaus + 0.5 * ptext`
- [ ] Frenet frame for geometry encoding
- [ ] Geometric prediction for connectivity
- [ ] Texture regions and UV prediction
- [ ] Progressive texture image compression
- [ ] Perceptual multiplexing (MS-SSIM)

---

## 🛠️ Technical Choices

### AIF Data Structure
**Why AIF?** Only structure capable of representing non-manifold polygonal meshes with full incidence/adjacence relations.

**Alternatives considered** (less generic):
- Half-edge: excellent for 2-manifolds, limited elsewhere
- Corner table: good for triangular, limited for polygonal
- Quad-edge: too oriented toward mathematical topology

**Implementation**: Custom Rust AIF using `slotmap` for stable IDs + efficient deletion.

```rust
struct Mesh {
    vertices: SlotMap<VertexId, Vertex>,
    edges: SlotMap<EdgeId, Edge>,
    faces: SlotMap<FaceId, Face>,
    corners: SlotMap<CornerId, Corner>,
}
```

### Entropy Coding
**Recommendation**: Start with **debug uncompressed format** (JSON or simple binary) to validate logic. Arithmetic coder comes in Phase 1.5 or 2.5.

### Testing Strategy
- **Fixtures**: `tests/fixtures/meshes/` with cube, bunny, quad mesh, non-manifold mesh
- **Unit tests**: Every critical function
- **Integration tests**: Complete roundtrip
- **Property-based testing**: Use `proptest` for topology

---

## 📊 Implementation Timeline (Estimated)

```
Phase 2.1-2.2: AIF base structure (read-only)      [2-3 weeks]
Phase 2.3:     Modification operations             [2 weeks]
Phase 2.4:     Import/Export formats               [1 week]
Phase 3.1-3.2: Edge contraction                    [1-2 weeks]
Phase 4.1-4.2: Expansion + reversibility           [2-3 weeks]
Phase 5:       Preprocessing                       [1 week]
Phase 1:       Entropy coding                      [1-2 weeks]
Phase 6:       Progressive format                  [2 weeks]
```

**Major checkpoint**: End of Phase 4.2 → ✅ **Perfect reversibility test**

---

## 🎬 Development Principles

1. **Incremental approach**: Build brick by brick, test each brick thoroughly
2. **Visual feedback**: Integrate with UI when useful (mesh loading, LoD visualization)
3. **Lossless first**: Guarantee perfect reconstruction before optimizing compression ratio
4. **Test-driven**: Unit tests for every critical operation
5. **Document edge cases**: Non-manifold configurations, UV seams, degenerate faces

---

## 📖 References

- PhD thesis: *Compression progressive de maillages surfaciques texturés*, F. Caillaud, INSA Lyon, 2017
- Operational summary: `resume_operationnel_these_compression_3d_copilot.md`

### Phase 5: Optimization
- [ ] Improve compression ratio
- [ ] Optimize decompression speed
- [ ] Add quality settings (aggressive vs conservative)

## 🎨 UI Integration

The `CompressionProject` provides:
- Load mesh from .obj file
- Compress button (placeholder)
- Decompress button (placeholder)
- Stats display (compression ratio, mesh info)

## 🔬 Development Philosophy

**Start simple, iterate often, test visually**

Each new feature should:
1. Compile and run
2. Have visual feedback in the UI
3. Be tested with real meshes
4. Work with non-manifold/polygonal meshes (not just triangular)

## 📚 References

Based on PhD research in progressive mesh compression for general polygonal meshes.
