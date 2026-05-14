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

    /// Calculate the axis-aligned bounding box of the mesh
    /// 
    /// Returns ((min_x, min_y, min_z), (max_x, max_y, max_z))
    /// Returns None if the mesh has no vertices.
    pub fn bounding_box(&self) -> Option<(Vec3, Vec3)> {
        if self.vertices.is_empty() {
            return None;
        }

        let first_pos = self.vertices[0].position;
        let mut min = first_pos;
        let mut max = first_pos;

        for vertex in &self.vertices {
            let pos = vertex.position;
            min = min.min(pos);
            max = max.max(pos);
        }

        Some((min, max))
    }

    /// Get the dimensions (size) of the mesh along each axis
    /// 
    /// Returns (width, height, depth) or None if mesh is empty.
    pub fn dimensions(&self) -> Option<(f32, f32, f32)> {
        self.bounding_box().map(|(min, max)| {
            let size = max - min;
            (size.x, size.y, size.z)
        })
    }
}

impl Default for Mesh {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_mesh_bounding_box() {
        let mesh = Mesh::new();
        assert_eq!(mesh.bounding_box(), None);
    }

    #[test]
    fn test_empty_mesh_dimensions() {
        let mesh = Mesh::new();
        assert_eq!(mesh.dimensions(), None);
    }

    #[test]
    fn test_single_vertex_bounding_box() {
        let mut mesh = Mesh::new();
        mesh.vertices.push(Vertex {
            position: Vec3::new(1.0, 2.0, 3.0),
            normal: None,
            tex_coords: None,
        });

        let (min, max) = mesh.bounding_box().unwrap();
        assert_eq!(min, Vec3::new(1.0, 2.0, 3.0));
        assert_eq!(max, Vec3::new(1.0, 2.0, 3.0));
    }

    #[test]
    fn test_single_vertex_dimensions() {
        let mut mesh = Mesh::new();
        mesh.vertices.push(Vertex {
            position: Vec3::new(1.0, 2.0, 3.0),
            normal: None,
            tex_coords: None,
        });

        let (width, height, depth) = mesh.dimensions().unwrap();
        assert_eq!(width, 0.0);
        assert_eq!(height, 0.0);
        assert_eq!(depth, 0.0);
    }

    #[test]
    fn test_cube_bounding_box() {
        let mut mesh = Mesh::new();
        
        // Add 8 vertices of a unit cube centered at origin
        let positions = [
            Vec3::new(-0.5, -0.5, -0.5),
            Vec3::new(0.5, -0.5, -0.5),
            Vec3::new(0.5, 0.5, -0.5),
            Vec3::new(-0.5, 0.5, -0.5),
            Vec3::new(-0.5, -0.5, 0.5),
            Vec3::new(0.5, -0.5, 0.5),
            Vec3::new(0.5, 0.5, 0.5),
            Vec3::new(-0.5, 0.5, 0.5),
        ];

        for pos in positions {
            mesh.vertices.push(Vertex {
                position: pos,
                normal: None,
                tex_coords: None,
            });
        }

        let (min, max) = mesh.bounding_box().unwrap();
        assert_eq!(min, Vec3::new(-0.5, -0.5, -0.5));
        assert_eq!(max, Vec3::new(0.5, 0.5, 0.5));
    }

    #[test]
    fn test_cube_dimensions() {
        let mut mesh = Mesh::new();
        
        // Add 8 vertices of a unit cube
        let positions = [
            Vec3::new(-0.5, -0.5, -0.5),
            Vec3::new(0.5, -0.5, -0.5),
            Vec3::new(0.5, 0.5, -0.5),
            Vec3::new(-0.5, 0.5, -0.5),
            Vec3::new(-0.5, -0.5, 0.5),
            Vec3::new(0.5, -0.5, 0.5),
            Vec3::new(0.5, 0.5, 0.5),
            Vec3::new(-0.5, 0.5, 0.5),
        ];

        for pos in positions {
            mesh.vertices.push(Vertex {
                position: pos,
                normal: None,
                tex_coords: None,
            });
        }

        let (width, height, depth) = mesh.dimensions().unwrap();
        assert_eq!(width, 1.0);
        assert_eq!(height, 1.0);
        assert_eq!(depth, 1.0);
    }

    #[test]
    fn test_asymmetric_mesh_dimensions() {
        let mut mesh = Mesh::new();
        
        mesh.vertices.push(Vertex {
            position: Vec3::new(0.0, 0.0, 0.0),
            normal: None,
            tex_coords: None,
        });
        mesh.vertices.push(Vertex {
            position: Vec3::new(2.0, 3.0, 1.5),
            normal: None,
            tex_coords: None,
        });

        let (width, height, depth) = mesh.dimensions().unwrap();
        assert_eq!(width, 2.0);
        assert_eq!(height, 3.0);
        assert_eq!(depth, 1.5);
    }
}

