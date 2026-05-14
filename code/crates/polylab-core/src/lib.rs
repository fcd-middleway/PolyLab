//! PolyLab Core
//! 
//! 3D data structures, format parsers, and compression algorithms.

pub mod mesh;
pub mod obj_parser;

// Re-export main types
pub use mesh::{Mesh, Vertex, Face};
pub use obj_parser::{parse_obj, ObjParseError};
