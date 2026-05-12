//! 3D mesh data structures

use glam::Vec3;

/// A 3D vertex with position, normal and texture coordinates
#[derive(Debug, Clone)]
pub struct Vertex {
    pub position: Vec3,
    pub normal: Option<Vec3>,
    pub tex_coords: Option<(f32, f32)>,
}

/// A triangular face (3 vertex indices)
#[derive(Debug, Clone)]
pub struct Face {
    pub vertices: [usize; 3],
}

/// A complete 3D mesh
#[derive(Debug, Clone)]
pub struct Mesh {
    pub vertices: Vec<Vertex>,
    pub faces: Vec<Face>,
}

impl Mesh {
    /// Creates an empty mesh
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            faces: Vec::new(),
        }
    }
}

impl Default for Mesh {
    fn default() -> Self {
        Self::new()
    }
}
