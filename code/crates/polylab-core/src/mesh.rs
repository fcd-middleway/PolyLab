//! 3D mesh data structures

use glam::Vec3;

/// A 3D vertex with position, normal, texture coordinates and color
#[derive(Debug, Clone)]
pub struct Vertex {
    pub position: Vec3,
    pub normal: Option<Vec3>,
    pub tex_coords: Option<(f32, f32)>,
    pub color: Option<Vec3>,  // RGB color [0.0-1.0]
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
    
    /// Calculate smooth vertex normals from face geometry
    ///
    /// Computes normals by averaging the face normals of all triangles that share each vertex.
    /// This creates smooth shading across the mesh. Call this after loading meshes from formats
    /// that don't include normals (like simple OBJ files).
    ///
    /// # Notes
    /// - Overwrites any existing normals
    /// - Requires at least one face to compute normals
    pub fn calculate_smooth_normals(&mut self) {
        if self.faces.is_empty() {
            return;
        }
        
        // Initialize all normals to zero
        let mut normals = vec![Vec3::ZERO; self.vertices.len()];
        
        // For each face, calculate its normal and add to adjacent vertices
        for face in &self.faces {
            let v0 = self.vertices[face.vertices[0]].position;
            let v1 = self.vertices[face.vertices[1]].position;
            let v2 = self.vertices[face.vertices[2]].position;
            
            // Calculate face normal using cross product
            let edge1 = v1 - v0;
            let edge2 = v2 - v0;
            let face_normal = edge1.cross(edge2); // Don't normalize yet (weighted by area)
            
            // Add to vertex normals (weighted by face area via cross product length)
            normals[face.vertices[0]] += face_normal;
            normals[face.vertices[1]] += face_normal;
            normals[face.vertices[2]] += face_normal;
        }
        
        // Normalize all vertex normals and assign to vertices
        for (i, vertex) in self.vertices.iter_mut().enumerate() {
            let normal = normals[i].normalize_or_zero();
            vertex.normal = Some(normal);
        }
    }
    
    /// Translate the mesh by a given offset
    ///
    /// Moves all vertices by the specified vector.
    /// Useful for positioning meshes in the scene.
    ///
    /// # Arguments
    /// * `offset` - Translation vector (x, y, z)
    ///
    /// # Example
    /// ```
    /// use polylab_core::Mesh;
    /// use glam::Vec3;
    /// 
    /// let mut mesh = Mesh::new();
    /// // ... load mesh ...
    /// mesh.translate(Vec3::new(10.0, 0.0, 5.0)); // Move right and forward
    /// ```
    pub fn translate(&mut self, offset: Vec3) {
        for vertex in &mut self.vertices {
            vertex.position += offset;
        }
    }
    
    /// Rotate the mesh around the Y axis (vertical)
    ///
    /// Rotates all vertices and normals around the Y axis by the specified angle.
    /// Useful for orienting meshes in the scene.
    ///
    /// # Arguments
    /// * `angle_radians` - Rotation angle in radians (positive = counter-clockwise when viewed from above)
    ///
    /// # Example
    /// ```
    /// use polylab_core::Mesh;
    /// use std::f32::consts::PI;
    /// 
    /// let mut mesh = Mesh::new();
    /// // ... load mesh ...
    /// mesh.rotate_y(PI / 2.0); // Rotate 90 degrees right
    /// ```
    pub fn rotate_y(&mut self, angle_radians: f32) {
        let cos = angle_radians.cos();
        let sin = angle_radians.sin();
        
        // Rotate all vertex positions
        for vertex in &mut self.vertices {
            let x = vertex.position.x;
            let z = vertex.position.z;
            
            // Rotation matrix around Y axis:
            // [ cos  0  sin ]
            // [  0   1   0  ]
            // [-sin  0  cos ]
            vertex.position.x = cos * x + sin * z;
            vertex.position.z = -sin * x + cos * z;
            
            // Rotate normals if they exist
            if let Some(normal) = vertex.normal {
                let nx = normal.x;
                let nz = normal.z;
                vertex.normal = Some(Vec3::new(
                    cos * nx + sin * nz,
                    normal.y,
                    -sin * nx + cos * nz
                ));
            }
        }
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
            color: None,
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
            color: None,
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
                color: None,
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
                color: None,
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
            color: None,
        });
        mesh.vertices.push(Vertex {
            position: Vec3::new(2.0, 3.0, 1.5),
            normal: None,
            tex_coords: None,
            color: None,
        });

        let (width, height, depth) = mesh.dimensions().unwrap();
        assert_eq!(width, 2.0);
        assert_eq!(height, 3.0);
        assert_eq!(depth, 1.5);
    }
}

