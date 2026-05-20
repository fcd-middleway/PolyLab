//! Conversion between AIF and polylab_core::Mesh

use super::{
    storage::AIF,
    types::{Corner, VertexId},
};
use polylab_core::mesh as core;
use std::collections::HashMap;

impl AIF {
    /// Create an AIF structure from a polylab_core::Mesh
    ///
    /// Converts a simple triangular mesh to the AIF representation.
    /// Stores vertex normals and UVs in the corner structure.
    ///
    /// # Arguments
    /// * `mesh` - Source mesh (must be triangular)
    ///
    /// # Returns
    /// New AIF structure with topology and attributes
    pub fn from_mesh(mesh: &core::Mesh) -> Self {
        let mut aif = AIF::with_capacity(
            mesh.vertices.len(),
            mesh.faces.len() * 3,
            mesh.faces.len(),
        );

        // 1. Create all vertices
        let mut vertex_map = Vec::with_capacity(mesh.vertices.len());
        for v in &mesh.vertices {
            let id = aif.add_vertex(v.position);
            vertex_map.push(id);
        }

        // 2. Create faces with edges and corners
        for face in &mesh.faces {
            let [i0, i1, i2] = face.vertices;
            let v0 = vertex_map[i0];
            let v1 = vertex_map[i1];
            let v2 = vertex_map[i2];

            // Create edges (reuses existing edges automatically)
            let e0 = aif.add_edge(v0, v1);
            let e1 = aif.add_edge(v1, v2);
            let e2 = aif.add_edge(v2, v0);

            // Create face if all edges exist
            if let (Some(e0), Some(e1), Some(e2)) = (e0, e1, e2) {
                if let Some(face_id) = aif.add_face(vec![e0, e1, e2]) {
                    // Create corners with UVs and normals
                    for (local_idx, &vertex_idx) in face.vertices.iter().enumerate() {
                        let vertex_id = vertex_map[vertex_idx];
                        let source_vertex = &mesh.vertices[vertex_idx];

                        let uv = source_vertex.tex_coords.map(|(u, v)| [u, v]);
                        let normal = source_vertex.normal;

                        let corner = Corner {
                            vertex: vertex_id,
                            face: face_id,
                            uv,
                            normal,
                        };

                        let corner_id = aif.corners.insert(corner);
                        // Add corner to face
                        if let Some(face) = aif.faces.get_mut(face_id) {
                            // Make sure corner order matches edge order
                            if face.corners.len() <= local_idx {
                                face.corners.push(corner_id);
                            } else {
                                face.corners[local_idx] = corner_id;
                            }
                        }
                    }
                }
            }
        }

        aif
    }

    /// Convert AIF structure back to polylab_core::Mesh
    ///
    /// Exports the mesh as triangles. Polygonal faces are triangulated using
    /// a simple fan triangulation from the first vertex.
    ///
    /// # Returns
    /// A triangular mesh with vertex positions, normals, and UVs
    pub fn to_mesh(&self) -> core::Mesh {
        let mut mesh = core::Mesh::new();

        // Build vertex ID to index mapping
        let vertex_ids: Vec<VertexId> = self.vertices.keys().collect();
        let mut id_to_index: HashMap<VertexId, usize> = HashMap::new();

        // 1. Export all vertices
        for (idx, &vertex_id) in vertex_ids.iter().enumerate() {
            if let Some(vertex) = self.vertices.get(vertex_id) {
                id_to_index.insert(vertex_id, idx);

                // Start with position only
                let core_vertex = core::Vertex {
                    position: vertex.position,
                    normal: None,
                    tex_coords: None,
                    color: None,
                };
                mesh.vertices.push(core_vertex);
            }
        }

        // 2. Export faces (triangulate if necessary)
        for (face_id, face) in &self.faces {
            let vertices = self.face_vertices(face_id);
            if vertices.is_empty() {
                continue;
            }

            let valence = vertices.len();

            if valence < 3 {
                // Degenerate face, skip
                continue;
            }

            // Get corners for attribute lookup
            let corners: Vec<_> = face.corners.iter().filter_map(|&c| self.corners.get(c)).collect();

            // Fan triangulation from first vertex
            let v0_id = vertices[0];
            let v0_idx = *id_to_index.get(&v0_id).unwrap();

            for i in 1..valence - 1 {
                let v1_id = vertices[i];
                let v2_id = vertices[i + 1];

                let v1_idx = *id_to_index.get(&v1_id).unwrap();
                let v2_idx = *id_to_index.get(&v2_id).unwrap();

                // Create triangle face
                let triangle = core::Face {
                    vertices: [v0_idx, v1_idx, v2_idx],
                };
                mesh.faces.push(triangle);

                // Copy corner attributes if available
                // For first triangle, use corners [0, i, i+1]
                // (This is a simplification; proper UV/normal handling needs more care)
                if i == 1 && corners.len() >= 3 {
                    if let Some(corner0) = corners.get(0) {
                        mesh.vertices[v0_idx].normal = corner0.normal;
                        mesh.vertices[v0_idx].tex_coords = corner0.uv.map(|[u, v]| (u, v));
                    }
                    if let Some(corner1) = corners.get(i) {
                        mesh.vertices[v1_idx].normal = corner1.normal;
                        mesh.vertices[v1_idx].tex_coords = corner1.uv.map(|[u, v]| (u, v));
                    }
                    if let Some(corner2) = corners.get(i + 1) {
                        mesh.vertices[v2_idx].normal = corner2.normal;
                        mesh.vertices[v2_idx].tex_coords = corner2.uv.map(|[u, v]| (u, v));
                    }
                }
            }
        }

        mesh
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Vec3;

    #[test]
    fn test_from_mesh_single_triangle() {
        let mut mesh = core::Mesh::new();

        // Create a simple triangle
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 0.0, 0.0),
            normal: Some(Vec3::new(0.0, 0.0, 1.0)),
            tex_coords: Some((0.0, 0.0)),
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(1.0, 0.0, 0.0),
            normal: Some(Vec3::new(0.0, 0.0, 1.0)),
            tex_coords: Some((1.0, 0.0)),
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 1.0, 0.0),
            normal: Some(Vec3::new(0.0, 0.0, 1.0)),
            tex_coords: Some((0.0, 1.0)),
            color: None,
        });

        mesh.faces.push(core::Face {
            vertices: [0, 1, 2],
        });

        // Convert to AIF
        let aif = AIF::from_mesh(&mesh);

        assert_eq!(aif.num_vertices(), 3);
        assert_eq!(aif.num_edges(), 3);
        assert_eq!(aif.num_faces(), 1);
        assert_eq!(aif.num_corners(), 3);
    }

    #[test]
    fn test_from_mesh_two_triangles() {
        let mut mesh = core::Mesh::new();

        // Create a quad as 2 triangles (sharing an edge)
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 0.0, 0.0),
            normal: None,
            tex_coords: None,
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(1.0, 0.0, 0.0),
            normal: None,
            tex_coords: None,
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(1.0, 1.0, 0.0),
            normal: None,
            tex_coords: None,
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 1.0, 0.0),
            normal: None,
            tex_coords: None,
            color: None,
        });

        mesh.faces.push(core::Face {
            vertices: [0, 1, 2],
        });
        mesh.faces.push(core::Face {
            vertices: [0, 2, 3],
        });

        let aif = AIF::from_mesh(&mesh);

        assert_eq!(aif.num_vertices(), 4);
        assert_eq!(aif.num_edges(), 5); // 4 boundary + 1 shared
        assert_eq!(aif.num_faces(), 2);

        // The shared edge should have 2 incident faces
        for (_, edge) in &aif.edges {
            if edge.faces.len() == 2 {
                // Found the shared edge
                assert!(!edge.is_boundary());
                return;
            }
        }
        panic!("No shared edge found");
    }

    #[test]
    fn test_to_mesh_roundtrip() {
        let mut original = core::Mesh::new();

        // Simple triangle
        original.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 0.0, 0.0),
            normal: Some(Vec3::new(0.0, 1.0, 0.0)),
            tex_coords: Some((0.0, 0.0)),
            color: None,
        });
        original.vertices.push(core::Vertex {
            position: Vec3::new(1.0, 0.0, 0.0),
            normal: Some(Vec3::new(0.0, 1.0, 0.0)),
            tex_coords: Some((1.0, 0.0)),
            color: None,
        });
        original.vertices.push(core::Vertex {
            position: Vec3::new(0.5, 0.0, 1.0),
            normal: Some(Vec3::new(0.0, 1.0, 0.0)),
            tex_coords: Some((0.5, 1.0)),
            color: None,
        });

        original.faces.push(core::Face {
            vertices: [0, 1, 2],
        });

        // Convert to AIF and back
        let aif = AIF::from_mesh(&original);
        let result = aif.to_mesh();

        // Check structure
        assert_eq!(result.vertices.len(), 3);
        assert_eq!(result.faces.len(), 1);

        // Check positions
        for i in 0..3 {
            assert_eq!(
                result.vertices[i].position,
                original.vertices[i].position
            );
        }
    }

    #[test]
    fn test_to_mesh_empty() {
        let aif = AIF::new();
        let mesh = aif.to_mesh();

        assert_eq!(mesh.vertices.len(), 0);
        assert_eq!(mesh.faces.len(), 0);
    }

    #[test]
    fn test_from_mesh_preserves_uvs() {
        let mut mesh = core::Mesh::new();

        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 0.0, 0.0),
            normal: None,
            tex_coords: Some((0.25, 0.75)),
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(1.0, 0.0, 0.0),
            normal: None,
            tex_coords: Some((0.5, 0.5)),
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 1.0, 0.0),
            normal: None,
            tex_coords: Some((0.9, 0.1)),
            color: None,
        });

        mesh.faces.push(core::Face {
            vertices: [0, 1, 2],
        });

        let aif = AIF::from_mesh(&mesh);

        // Check that corners have UVs
        let mut found_uvs = 0;
        for (_, corner) in &aif.corners {
            if corner.uv.is_some() {
                found_uvs += 1;
            }
        }
        assert_eq!(found_uvs, 3);
    }

    #[test]
    fn test_from_mesh_preserves_normals() {
        let mut mesh = core::Mesh::new();

        let n = Vec3::new(0.0, 1.0, 0.0);
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 0.0, 0.0),
            normal: Some(n),
            tex_coords: None,
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(1.0, 0.0, 0.0),
            normal: Some(n),
            tex_coords: None,
            color: None,
        });
        mesh.vertices.push(core::Vertex {
            position: Vec3::new(0.0, 1.0, 0.0),
            normal: Some(n),
            tex_coords: None,
            color: None,
        });

        mesh.faces.push(core::Face {
            vertices: [0, 1, 2],
        });

        let aif = AIF::from_mesh(&mesh);

        // Check that corners have normals
        let mut found_normals = 0;
        for (_, corner) in &aif.corners {
            if corner.normal.is_some() {
                found_normals += 1;
            }
        }
        assert_eq!(found_normals, 3);
    }
}
