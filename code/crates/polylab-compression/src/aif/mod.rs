//! AIF (Adjacency and Incidence Framework) data structure.
//!
//! This module implements a topological data structure for representing
//! non-manifold polygonal meshes. It supports:
//!
//! - Non-manifold topology (complex edges, boundary edges)
//! - Polygonal faces (triangles, quads, n-gons)
//! - Efficient topological queries and modifications
//! - Progressive mesh operations (edge collapse, vertex expansion)
//!
//! ## Module Organization
//!
//! - `types`: Core data types (Vertex, Edge, Face, Corner)
//! - `storage`: AIF structure and memory management
//! - `queries`: Read-only topological queries (methods on AIF)
//! - `operations`: Mesh modification operations (methods on AIF)
//! - `conversion`: Import/export from/to polylab_core::Mesh

mod types;
mod storage;
mod queries;    // Adds query methods to AIF
mod operations; // Adds operation methods to AIF
mod conversion; // Adds from_mesh/to_mesh to AIF

#[cfg(test)]
mod tests;

// Re-export main types
pub use types::{VertexId, EdgeId, FaceId, CornerId};
pub use storage::AIF;
