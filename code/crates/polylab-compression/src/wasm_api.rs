//! WASM API for mesh compression
//!
//! This module provides a WebAssembly-compatible API for progressive mesh
//! compression and simplification.

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use crate::aif::AIF;
use crate::decimation::{DecimationQueue, MetricType};
use polylab_core::Mesh;
use serde::{Deserialize, Serialize};
use glam::Vec3;

/// Statistics about the current mesh state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshStats {
    /// Number of vertices
    pub vertices: usize,
    /// Number of faces
    pub faces: usize,
    /// Number of edges
    pub edges: usize,
    /// Number of corners
    pub corners: usize,
    /// Compression ratio (current / original)
    pub compression_ratio: f32,
    /// Original number of vertices
    pub original_vertices: usize,
    /// Original number of faces
    pub original_faces: usize,
    /// Number of collapsed edges
    pub collapsed_edges: usize,
    /// Name of the metric used
    pub metric_name: String,
}

/// Result of a simplification operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimplifyResult {
    /// Flattened vertex positions [x, y, z, x, y, z, ...]
    pub vertices: Vec<f32>,
    /// Face indices (triangulated)
    pub faces: Vec<u32>,
    /// Statistics
    pub stats: MeshStats,
}

/// Handle for mesh compression operations
///
/// This struct maintains the state of a mesh being compressed and provides
/// methods for progressive simplification.
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct CompressionHandle {
    mesh_id: String,
    original_mesh: Mesh,
    current_aif: AIF,
    total_collapsed: usize,
    current_metric: MetricType,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl CompressionHandle {
    /// Create a new compression handle from raw mesh data
    ///
    /// # Arguments
    /// * `mesh_id` - Unique identifier for the mesh
    /// * `vertices` - Flattened vertex positions [x, y, z, x, y, z, ...]
    /// * `faces` - Face indices (must be triangles for now)
    ///
    /// # Returns
    /// A new compression handle ready for simplification
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen(constructor)]
    pub fn new(mesh_id: String, vertices: Vec<f32>, faces: Vec<u32>) -> Result<CompressionHandle, JsValue> {
        // Set up panic hook for better error messages
        console_error_panic_hook::set_once();

        // Convert raw data to Mesh
        let mesh = Self::create_mesh_from_raw(&vertices, &faces)
            .map_err(|e| JsValue::from_str(&format!("Failed to create mesh: {}", e)))?;

        // Convert Mesh to AIF
        let aif = AIF::from_mesh(&mesh);

        Ok(CompressionHandle {
            mesh_id,
            original_mesh: mesh,
            current_aif: aif,
            total_collapsed: 0,
            current_metric: MetricType::EdgeLength, // Default metric
        })
    }

    /// Create a compression handle (non-WASM version)
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(mesh_id: String, vertices: Vec<f32>, faces: Vec<u32>) -> Result<CompressionHandle, String> {
        let mesh = Self::create_mesh_from_raw(&vertices, &faces)?;
        let aif = AIF::from_mesh(&mesh);

        Ok(CompressionHandle {
            mesh_id,
            original_mesh: mesh,
            current_aif: aif,
            total_collapsed: 0,
            current_metric: MetricType::EdgeLength,
        })
    }

    /// Simplify the mesh by a target ratio
    ///
    /// # Arguments
    /// * `target_ratio` - Target ratio of vertices to keep (0.0 to 1.0)
    ///   - 1.0 = keep all vertices
    ///   - 0.9 = keep 90% of vertices
    ///   - 0.5 = keep 50% of vertices
    /// * `metric_name` - Name of the metric to use ("random" or "edge_length")
    ///
    /// # Returns
    /// A SimplifyResult containing the new mesh geometry and statistics
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen]
    pub fn simplify_step(&mut self, target_ratio: f32, metric_name: String) -> Result<JsValue, JsValue> {
        let result = self.simplify_step_internal(target_ratio, &metric_name)
            .map_err(|e| JsValue::from_str(&e))?;
        
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Simplify the mesh (non-WASM version)
    #[cfg(not(target_arch = "wasm32"))]
    pub fn simplify_step(&mut self, target_ratio: f32, metric_name: String) -> Result<SimplifyResult, String> {
        self.simplify_step_internal(target_ratio, &metric_name)
    }

    /// Reset the mesh to its original state
    ///
    /// # Returns
    /// A SimplifyResult with the original mesh
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen]
    pub fn reset(&mut self) -> Result<JsValue, JsValue> {
        let result = self.reset_internal()
            .map_err(|e| JsValue::from_str(&e))?;
        
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Reset the mesh (non-WASM version)
    #[cfg(not(target_arch = "wasm32"))]
    pub fn reset(&mut self) -> Result<SimplifyResult, String> {
        self.reset_internal()
    }

    /// Get current mesh statistics
    ///
    /// # Returns
    /// MeshStats containing vertex/face counts and compression ratio
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen]
    pub fn get_stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.get_stats_internal();
        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get statistics (non-WASM version)
    #[cfg(not(target_arch = "wasm32"))]
    pub fn get_stats(&self) -> MeshStats {
        self.get_stats_internal()
    }

    /// Get the mesh ID
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen]
    pub fn mesh_id(&self) -> String {
        self.mesh_id.clone()
    }
}

// Internal implementation (shared between WASM and non-WASM)
impl CompressionHandle {
    /// Create a Mesh from raw vertex and face data
    fn create_mesh_from_raw(vertices: &[f32], faces: &[u32]) -> Result<Mesh, String> {
        if vertices.len() % 3 != 0 {
            return Err("Vertex count must be a multiple of 3".to_string());
        }

        if faces.len() % 3 != 0 {
            return Err("Face indices must be triangles (multiple of 3)".to_string());
        }

        let mut mesh = Mesh::new();
        let num_vertices = vertices.len() / 3;

        // Create vertices
        for i in 0..num_vertices {
            let position = Vec3::new(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
            mesh.vertices.push(polylab_core::mesh::Vertex {
                position,
                normal: None,
                tex_coords: None,
                color: None,
            });
        }

        // Create faces
        for i in 0..faces.len() / 3 {
            mesh.faces.push(polylab_core::mesh::Face {
                vertices: [
                    faces[i * 3] as usize,
                    faces[i * 3 + 1] as usize,
                    faces[i * 3 + 2] as usize,
                ],
            });
        }

        Ok(mesh)
    }

    /// Internal simplification logic
    fn simplify_step_internal(&mut self, target_ratio: f32, metric_name: &str) -> Result<SimplifyResult, String> {
        // Validate ratio
        if target_ratio < 0.0 || target_ratio > 1.0 {
            return Err("Target ratio must be between 0.0 and 1.0".to_string());
        }

        // Parse metric
        let metric = MetricType::from_str(metric_name)
            .ok_or_else(|| format!("Unknown metric: {}", metric_name))?;

        self.current_metric = metric;

        // Calculate number of edges to collapse
        let current_vertices = self.current_aif.num_vertices();
        let target_vertices = (current_vertices as f32 * target_ratio).round() as usize;
        let vertices_to_remove = current_vertices.saturating_sub(target_vertices);

        // Build priority queue
        let mut queue = DecimationQueue::build(&self.current_aif, &metric);

        // Collapse edges
        let mut collapsed_count = 0;
        while collapsed_count < vertices_to_remove && !queue.is_empty() {
            if let Some(edge_id) = queue.pop() {
                // Try to collapse the edge
                if self.current_aif.collapse_edge(edge_id).is_some() {
                    collapsed_count += 1;
                    self.total_collapsed += 1;
                }
            }
        }

        // Convert to mesh and extract data
        let current_mesh = self.current_aif.to_mesh();
        let (vertices, faces) = Self::mesh_to_raw(&current_mesh);
        let stats = self.get_stats_internal();

        Ok(SimplifyResult {
            vertices,
            faces,
            stats,
        })
    }

    /// Internal reset logic
    fn reset_internal(&mut self) -> Result<SimplifyResult, String> {
        // Rebuild AIF from original mesh
        self.current_aif = AIF::from_mesh(&self.original_mesh);
        self.total_collapsed = 0;

        let (vertices, faces) = Self::mesh_to_raw(&self.original_mesh);
        let stats = self.get_stats_internal();

        Ok(SimplifyResult {
            vertices,
            faces,
            stats,
        })
    }

    /// Internal statistics computation
    fn get_stats_internal(&self) -> MeshStats {
        let current_vertices = self.current_aif.num_vertices();
        let original_vertices = self.original_mesh.vertices.len();
        let compression_ratio = if original_vertices > 0 {
            current_vertices as f32 / original_vertices as f32
        } else {
            1.0
        };

        MeshStats {
            vertices: current_vertices,
            faces: self.current_aif.num_faces(),
            edges: self.current_aif.num_edges(),
            corners: self.current_aif.num_corners(),
            compression_ratio,
            original_vertices,
            original_faces: self.original_mesh.faces.len(),
            collapsed_edges: self.total_collapsed,
            metric_name: self.current_metric.name().to_string(),
        }
    }

    /// Convert Mesh to raw arrays
    fn mesh_to_raw(mesh: &Mesh) -> (Vec<f32>, Vec<u32>) {
        // Flatten vertices
        let vertices: Vec<f32> = mesh
            .vertices
            .iter()
            .flat_map(|v| [v.position.x, v.position.y, v.position.z])
            .collect();

        // Flatten faces
        let faces: Vec<u32> = mesh
            .faces
            .iter()
            .flat_map(|f| [f.vertices[0] as u32, f.vertices[1] as u32, f.vertices[2] as u32])
            .collect();

        (vertices, faces)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_mesh_from_raw() {
        let vertices = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
        ];
        let faces = vec![0, 1, 2]; // Single triangle

        let mesh = CompressionHandle::create_mesh_from_raw(&vertices, &faces).unwrap();
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.faces.len(), 1);
    }

    #[test]
    fn test_compression_handle_new() {
        let vertices = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
        ];
        let faces = vec![0, 1, 2];

        let handle = CompressionHandle::new("test_mesh".to_string(), vertices, faces).unwrap();
        assert_eq!(handle.mesh_id, "test_mesh");
        assert_eq!(handle.current_aif.num_vertices(), 3);
        assert_eq!(handle.current_aif.num_faces(), 1);
    }

    #[test]
    fn test_get_stats() {
        let vertices = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
            1.0, 1.0, 0.0, // v3
        ];
        let faces = vec![
            0, 1, 2, // tri0
            1, 3, 2, // tri1
        ];

        let handle = CompressionHandle::new("test".to_string(), vertices, faces).unwrap();
        let stats = handle.get_stats();

        assert_eq!(stats.vertices, 4);
        assert_eq!(stats.faces, 2);
        assert_eq!(stats.original_vertices, 4);
        assert!((stats.compression_ratio - 1.0).abs() < 1e-5);
    }

    #[test]
    fn test_simplify_step() {
        let vertices = vec![
            0.0, 0.0, 0.0, // v0
            1.0, 0.0, 0.0, // v1
            0.0, 1.0, 0.0, // v2
            1.0, 1.0, 0.0, // v3
        ];
        let faces = vec![
            0, 1, 2, // tri0
            1, 3, 2, // tri1
        ];

        let mut handle = CompressionHandle::new("test".to_string(), vertices, faces).unwrap();

        // Simplify to 75% (remove 1 vertex)
        let result = handle.simplify_step(0.75, "edge_length".to_string()).unwrap();

        assert_eq!(result.stats.vertices, 3);
        assert!(result.stats.compression_ratio < 1.0);
        assert_eq!(result.stats.collapsed_edges, 1);
    }

    #[test]
    fn test_reset() {
        let vertices = vec![
            0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0,
        ];
        let faces = vec![0, 1, 2, 1, 3, 2];

        let mut handle = CompressionHandle::new("test".to_string(), vertices, faces).unwrap();

        // Simplify
        handle.simplify_step(0.5, "edge_length".to_string()).unwrap();
        assert!(handle.current_aif.num_vertices() < 4);

        // Reset
        let result = handle.reset().unwrap();
        assert_eq!(result.stats.vertices, 4);
        assert_eq!(result.stats.collapsed_edges, 0);
        assert!((result.stats.compression_ratio - 1.0).abs() < 1e-5);
    }
}
