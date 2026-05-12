//! PolyLab Core
//! 
//! 3D data structures, format parsers, and compression algorithms.

pub mod mesh;

// Re-export main types
pub use mesh::{Mesh, Vertex, Face};
