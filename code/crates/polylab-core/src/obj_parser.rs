//! OBJ file format parser
//!
//! Parses Wavefront .obj files into Mesh structures.
//! Supports vertices (v), normals (vn), texture coords (vt), and faces (f).
//!
//! TODO: Complete OBJ spec implementation for non-manifold meshes
//! This parser is intentionally simplified for MVP. Full implementation needed for:
//! - Non-manifold geometry support (critical for progressive compression research)
//! - Complete material support (mtllib, usemtl)
//! - Groups and objects (g, o)
//! - Smoothing groups (s)
//! - Free-form surfaces (curves, surfaces)
//! - All texture coordinate formats
//! Reference: http://paulbourke.net/dataformats/obj/

use crate::mesh::{Mesh, Vertex, Face};
use glam::Vec3;

/// Error types for OBJ parsing
#[derive(Debug, Clone, PartialEq)]
pub enum ObjParseError {
    /// Invalid vertex line format
    InvalidVertex(String, usize),
    /// Invalid face line format
    InvalidFace(String, usize),
    /// Invalid normal line format
    InvalidNormal(String, usize),
    /// Face references non-existent vertex
    InvalidVertexIndex(usize, usize),
    /// Empty file or no geometry
    EmptyFile,
}

impl std::fmt::Display for ObjParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ObjParseError::InvalidVertex(line, line_num) => {
                write!(f, "Invalid vertex format at line {}: '{}'. Expected: v <x> <y> <z>", line_num, line)
            },
            ObjParseError::InvalidFace(line, line_num) => {
                write!(f, "Invalid face format at line {}: '{}'. Expected: f <v1> <v2> <v3> or f <v1>/<vt1>/<vn1> <v2>/<vt2>/<vn2> <v3>/<vt3>/<vn3>", line_num, line)
            },
            ObjParseError::InvalidNormal(line, line_num) => {
                write!(f, "Invalid normal format at line {}: '{}'. Expected: vn <x> <y> <z>", line_num, line)
            },
            ObjParseError::InvalidVertexIndex(idx, line_num) => {
                write!(f, "Face at line {} references non-existent vertex index: {}. Make sure vertex indices are valid and vertices are declared before faces.", line_num, idx)
            },
            ObjParseError::EmptyFile => {
                write!(f, "Empty OBJ file or no geometry found. File must contain at least one vertex (v) and one face (f).")
            },
        }
    }
}

impl std::error::Error for ObjParseError {}

/// Parse an OBJ file from a string
///
/// # Format support
/// - `v x y z` : Vertex positions
/// - `vn x y z` : Vertex normals
/// - `vt u v` : Texture coordinates (parsed but not stored yet)
/// - `f v1 v2 v3` : Triangle face (vertex indices, 1-based)
/// - `f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3` : Face with texture and normal indices
///
/// # Example
/// ```
/// # use polylab_core::obj_parser::parse_obj;
/// let obj_content = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3";
/// let mesh = parse_obj(obj_content).unwrap();
/// assert_eq!(mesh.vertices.len(), 3);
/// assert_eq!(mesh.faces.len(), 1);
/// ```
pub fn parse_obj(content: &str) -> Result<Mesh, ObjParseError> {
    let mut vertices = Vec::new();
    let mut normals = Vec::new();
    let mut faces = Vec::new();

    for (line_num, line) in content.lines().enumerate() {
        let line = line.trim();
        
        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0] {
            "v" => {
                // Vertex position: v x y z [w]
                if parts.len() < 4 {
                    return Err(ObjParseError::InvalidVertex(line.to_string(), line_num + 1));
                }
                
                let x = parts[1].parse::<f32>()
                    .map_err(|_| ObjParseError::InvalidVertex(line.to_string(), line_num + 1))?;
                let y = parts[2].parse::<f32>()
                    .map_err(|_| ObjParseError::InvalidVertex(line.to_string(), line_num + 1))?;
                let z = parts[3].parse::<f32>()
                    .map_err(|_| ObjParseError::InvalidVertex(line.to_string(), line_num + 1))?;
                
                vertices.push(Vec3::new(x, y, z));
            }
            
            "vn" => {
                // Vertex normal: vn x y z
                if parts.len() < 4 {
                    return Err(ObjParseError::InvalidNormal(line.to_string(), line_num + 1));
                }
                
                let x = parts[1].parse::<f32>()
                    .map_err(|_| ObjParseError::InvalidNormal(line.to_string(), line_num + 1))?;
                let y = parts[2].parse::<f32>()
                    .map_err(|_| ObjParseError::InvalidNormal(line.to_string(), line_num + 1))?;
                let z = parts[3].parse::<f32>()
                    .map_err(|_| ObjParseError::InvalidNormal(line.to_string(), line_num + 1))?;
                
                normals.push(Vec3::new(x, y, z));
            }
            
            "vt" => {
                // Texture coordinates: vt u v [w]
                // For now we parse but don't store them
                // TODO: Store texture coordinates when needed
            }
            
            "f" => {
                // Face: f v1[/vt1[/vn1]] v2[/vt2[/vn2]] v3[/vt3[/vn3]]
                if parts.len() < 4 {
                    return Err(ObjParseError::InvalidFace(line.to_string(), line_num + 1));
                }
                
                // Parse first 3 vertices (triangulate if more)
                let mut face_vertices = [0usize; 3];
                
                for i in 0..3 {
                    let vertex_str = parts[i + 1];
                    let vertex_idx = parse_face_vertex(vertex_str)
                        .map_err(|_| ObjParseError::InvalidFace(line.to_string(), line_num + 1))?;
                    
                    // OBJ uses 1-based indexing
                    if vertex_idx < 1 || vertex_idx > vertices.len() {
                        return Err(ObjParseError::InvalidVertexIndex(vertex_idx, line_num + 1));
                    }
                    
                    face_vertices[i] = vertex_idx - 1; // Convert to 0-based
                }
                
                faces.push(Face { vertices: face_vertices });
                
                // TODO: Handle quads and n-gons (triangulate them)
                if parts.len() > 4 {
                    // For now, skip additional vertices
                    // Future: triangulate polygon properly
                }
            }
            
            _ => {
                // Unknown directive, skip
            }
        }
    }

    // Validate we got some geometry
    if vertices.is_empty() || faces.is_empty() {
        return Err(ObjParseError::EmptyFile);
    }

    // Build final mesh
    let mesh_vertices: Vec<Vertex> = vertices.into_iter().map(|pos| Vertex {
        position: pos,
        normal: None,
        tex_coords: None,
        color: None,  // OBJ files don't typically include per-vertex colors
    }).collect();

    Ok(Mesh {
        vertices: mesh_vertices,
        faces,
    })
}

/// Parse a face vertex reference (format: v or v/vt or v/vt/vn or v//vn)
fn parse_face_vertex(s: &str) -> Result<usize, std::num::ParseIntError> {
    // Split by '/' and take first part (vertex index)
    let parts: Vec<&str> = s.split('/').collect();
    parts[0].parse::<usize>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_triangle() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3";
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.faces.len(), 1);
        assert_eq!(mesh.faces[0].vertices, [0, 1, 2]);
    }

    #[test]
    fn test_parse_with_comments() {
        let obj = "# This is a comment\nv 0.0 0.0 0.0\n# Another comment\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3";
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.faces.len(), 1);
    }

    #[test]
    fn test_parse_with_blank_lines() {
        let obj = "\nv 0.0 0.0 0.0\n\nv 1.0 0.0 0.0\n\nv 0.0 1.0 0.0\n\nf 1 2 3\n";
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.faces.len(), 1);
    }

    #[test]
    fn test_parse_cube() {
        let obj = r#"
# Cube
v -1.0 -1.0 -1.0
v -1.0 -1.0  1.0
v -1.0  1.0 -1.0
v -1.0  1.0  1.0
v  1.0 -1.0 -1.0
v  1.0 -1.0  1.0
v  1.0  1.0 -1.0
v  1.0  1.0  1.0
f 1 2 3
f 3 2 4
f 5 6 7
f 7 6 8
f 1 5 2
f 2 5 6
"#;
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices.len(), 8);
        assert_eq!(mesh.faces.len(), 6);
    }

    #[test]
    fn test_parse_face_with_texture_normal() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nvt 0.0 0.0\nvt 1.0 0.0\nvt 0.5 1.0\nvn 0.0 0.0 1.0\nf 1/1/1 2/2/1 3/3/1";
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.faces.len(), 1);
        assert_eq!(mesh.faces[0].vertices, [0, 1, 2]);
    }

    #[test]
    fn test_parse_face_without_texture() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nvn 0.0 0.0 1.0\nf 1//1 2//1 3//1";
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.faces.len(), 1);
    }

    #[test]
    fn test_empty_file() {
        let obj = "";
        let result = parse_obj(obj);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ObjParseError::EmptyFile);
    }

    #[test]
    fn test_no_faces() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0";
        let result = parse_obj(obj);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ObjParseError::EmptyFile);
    }

    #[test]
    fn test_invalid_vertex_format() {
        let obj = "v 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3";
        let result = parse_obj(obj);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ObjParseError::InvalidVertex(_, _)));
    }

    #[test]
    fn test_invalid_face_format() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2";
        let result = parse_obj(obj);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ObjParseError::InvalidFace(_, _)));
    }

    #[test]
    fn test_invalid_vertex_index() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nf 1 2 5";
        let result = parse_obj(obj);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ObjParseError::InvalidVertexIndex(_, _)));
    }

    #[test]
    fn test_face_references_invalid_vertex() {
        let obj = "v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 10";
        let result = parse_obj(obj);
        assert!(result.is_err());
        // Check it's an InvalidVertexIndex error with vertex index 10 and some line number
        match result.unwrap_err() {
            ObjParseError::InvalidVertexIndex(idx, _line_num) => assert_eq!(idx, 10),
            _ => panic!("Expected InvalidVertexIndex error"),
        }
    }

    #[test]
    fn test_negative_coordinates() {
        let obj = "v -1.0 -2.5 -3.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3";
        let mesh = parse_obj(obj).unwrap();
        
        assert_eq!(mesh.vertices[0].position.x, -1.0);
        assert_eq!(mesh.vertices[0].position.y, -2.5);
        assert_eq!(mesh.vertices[0].position.z, -3.0);
    }

    #[test]
    fn test_parse_face_vertex_simple() {
        assert_eq!(parse_face_vertex("42").unwrap(), 42);
    }

    #[test]
    fn test_parse_face_vertex_with_texture() {
        assert_eq!(parse_face_vertex("42/1").unwrap(), 42);
    }

    #[test]
    fn test_parse_face_vertex_with_normal() {
        assert_eq!(parse_face_vertex("42//1").unwrap(), 42);
    }

    #[test]
    fn test_parse_face_vertex_full() {
        assert_eq!(parse_face_vertex("42/10/5").unwrap(), 42);
    }
}
