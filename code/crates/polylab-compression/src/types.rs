//! Core types for mesh compression
//! 
//! Defines data structures for compressed mesh representation.

/// Compressed mesh data structure
/// 
/// This will eventually contain:
/// - Base mesh (low resolution)
/// - Refinement levels (progressive detail)
/// - Metadata (compression parameters, statistics)
#[derive(Debug, Clone)]
pub struct CompressedMesh {
    /// Placeholder data - will be replaced with actual compressed format
    pub data: Vec<u8>,
}

impl CompressedMesh {
    /// Create a placeholder compressed mesh (empty)
    pub fn placeholder() -> Self {
        Self {
            data: Vec::new(),
        }
    }

    /// Estimate size in bytes
    pub fn estimate_size(&self) -> usize {
        self.data.len()
    }
}

/// Statistics about mesh compression
#[derive(Debug, Clone)]
pub struct CompressionStats {
    /// Number of vertices in original mesh
    pub original_vertices: usize,
    
    /// Number of faces in original mesh
    pub original_faces: usize,
    
    /// Size of compressed data in bytes
    pub compressed_size_bytes: usize,
    
    /// Compression ratio (original_size / compressed_size)
    pub compression_ratio: f32,
}

impl CompressionStats {
    /// Calculate estimated original size (rough approximation)
    /// Assumes: 3 floats (position) + 3 floats (normal) + 3 floats (color) per vertex
    /// Plus 3 u32 indices per face
    pub fn estimate_original_size(&self) -> usize {
        (self.original_vertices * 9 * 4) + (self.original_faces * 3 * 4)
    }
}
