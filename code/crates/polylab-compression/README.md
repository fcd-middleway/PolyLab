# polylab-compression

Progressive mesh compression/decompression for non-manifold polygonal meshes.

## 🎯 Current Status

**Phase 0: Skeleton** ✅

This crate contains the minimal infrastructure to begin development:

- ✅ Basic crate structure
- ✅ Type definitions (`CompressedMesh`, `CompressionStats`)
- ✅ Stub functions (`compress_mesh`, `decompress_mesh`)
- ✅ Integration with UI (`CompressionProject.ts`)

**No actual compression algorithm implemented yet** - all functions are placeholders.

## 📦 Structure

```
polylab-compression/
├── Cargo.toml          # Crate configuration
└── src/
    ├── lib.rs          # Main entry point with stub functions
    └── types.rs        # Core types (CompressedMesh, CompressionStats)
```

## 🚀 Next Steps

The compression algorithm will be built **incrementally, brick by brick**, with visual feedback at each step:

### Phase 1: Foundation
- [ ] Define mesh data structure for compression (vertices, faces, connectivity)
- [ ] Implement basic mesh traversal and topology analysis
- [ ] Handle non-manifold cases (non-closed meshes, boundary edges)

### Phase 2: Simplification
- [ ] Implement edge collapse operation
- [ ] Add geometric error calculation
- [ ] Create base mesh (simplified version)

### Phase 3: Progressive Encoding
- [ ] Store refinement operations (reverse of simplification)
- [ ] Implement progressive levels
- [ ] Add compression metrics (ratio, PSNR)

### Phase 4: File Format
- [ ] Design compressed mesh format
- [ ] Implement serialization/deserialization
- [ ] Add metadata (compression parameters)

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
