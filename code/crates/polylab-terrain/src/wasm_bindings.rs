//! WASM API for terrain generation
//!
//! This module provides a WebAssembly-compatible API for procedural terrain generation.

use wasm_bindgen::prelude::*;
use crate::TerrainData;
use serde::{Deserialize, Serialize};

// Import pipeline types
use crate::{TerrainConfig, Pipeline};
use crate::stages::{NoiseGenerationStage, NoiseGenerationConfig, SlopeCalculationStage, MeshBuildingStage};

/// Configuration for terrain generation (WASM-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen(getter_with_clone)]
pub struct WasmTerrainConfig {
    /// Width of terrain grid (number of cells)
    pub width: usize,
    /// Height of terrain grid (number of cells)
    pub height: usize,
    /// Resolution in world units (distance between grid points)
    pub resolution: f32,
    /// Random seed for deterministic generation
    pub seed: u64,
    /// Noise frequency (lower = larger features)
    pub frequency: f32,
    /// Number of noise octaves (more = more detail)
    pub octaves: u32,
    /// Amplitude decay per octave (lower = smoother)
    pub persistence: f32,
    /// Frequency multiplier per octave
    pub lacunarity: f32,
    /// Height scale multiplier
    pub height_scale: f32,
}

#[wasm_bindgen]
impl WasmTerrainConfig {
    /// Create default terrain configuration
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmTerrainConfig {
        WasmTerrainConfig {
            width: 128,
            height: 128,
            resolution: 1.0,
            seed: 0,
            frequency: 0.05,
            octaves: 6,
            persistence: 0.5,
            lacunarity: 2.0,
            height_scale: 50.0,
        }
    }
}

impl Default for WasmTerrainConfig {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of terrain generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerrainGenerationResult {
    /// Flattened vertex positions [x, y, z, x, y, z, ...]
    pub vertices: Vec<f32>,
    /// Flattened vertex colors [r, g, b, r, g, b, ...]
    pub colors: Vec<f32>,
    /// Face indices (triangles)
    pub faces: Vec<u32>,
    /// Heightmap data (flattened row-major)
    pub heightmap: Vec<f32>,
    /// Slope map data (if computed)
    pub slope_map: Option<Vec<f32>>,
    /// Terrain statistics
    pub stats: TerrainStats,
}

/// Statistics about generated terrain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerrainStats {
    /// Number of vertices
    pub num_vertices: usize,
    /// Number of faces
    pub num_faces: usize,
    /// Minimum height value
    pub min_height: f32,
    /// Maximum height value
    pub max_height: f32,
    /// Average height value
    pub avg_height: f32,
}

/// Handle for terrain generation
///
/// This struct provides methods for generating procedural terrain.
#[wasm_bindgen]
pub struct TerrainHandle {
    terrain: TerrainData,
}

#[wasm_bindgen]
impl TerrainHandle {
    /// Generate terrain with given configuration
    ///
    /// # Arguments
    /// * `config` - Terrain generation configuration
    ///
    /// # Returns
    /// A new terrain handle with generated data
    #[wasm_bindgen(constructor)]
    pub fn new(config: WasmTerrainConfig) -> Result<TerrainHandle, JsValue> {
        // Set up panic hook for better error messages
        console_error_panic_hook::set_once();

        // Convert WASM config to internal config
        let terrain_config = TerrainConfig {
            width: config.width,
            height: config.height,
            resolution: config.resolution,
            seed: config.seed,
        };

        // Create terrain data
        let mut terrain = TerrainData::new(terrain_config);

        // Build pipeline
        let mut pipeline = Pipeline::new();
        
        // Add noise generation stage
        let noise_stage = NoiseGenerationStage::new(
            NoiseGenerationConfig {
                frequency: config.frequency,
                octaves: config.octaves,
                persistence: config.persistence,
                lacunarity: config.lacunarity,
                height_scale: config.height_scale,
                height_offset: 0.0,
            }
        );
        pipeline.add_stage(Box::new(noise_stage));
        
        // Add slope calculation stage
        pipeline.add_stage(Box::new(SlopeCalculationStage));
        
        // Add mesh building stage
        pipeline.add_stage(Box::new(MeshBuildingStage::default()));

        // Execute pipeline
        pipeline.execute(&mut terrain)
            .map_err(|e| JsValue::from_str(&format!("Pipeline error: {}", e)))?;

        Ok(TerrainHandle { terrain })
    }

    /// Get the generated mesh data
    ///
    /// Returns serialized terrain data including vertices, colors, faces, and maps.
    #[wasm_bindgen(js_name = getMeshData)]
    pub fn get_mesh_data(&self) -> Result<JsValue, JsValue> {
        let result = self.create_generation_result();
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get heightmap as flattened array
    #[wasm_bindgen(js_name = getHeightmap)]
    pub fn get_heightmap(&self) -> Vec<f32> {
        self.terrain.heightmap().data.clone()
    }

    /// Get slope map as flattened array (if available)
    #[wasm_bindgen(js_name = getSlopeMap)]
    pub fn get_slope_map(&self) -> Option<Vec<f32>> {
        self.terrain.slope_map().map(|m| m.data.clone())
    }

    /// Get terrain statistics
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> Result<JsValue, JsValue> {
        let stats = TerrainStats {
            num_vertices: self.terrain.mesh().map(|m| m.vertices.len()).unwrap_or(0),
            num_faces: self.terrain.mesh().map(|m| m.faces.len()).unwrap_or(0),
            min_height: self.terrain.metadata.min_height,
            max_height: self.terrain.metadata.max_height,
            avg_height: self.terrain.metadata.avg_height,
        };
        
        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

// Non-WASM methods
impl TerrainHandle {
    /// Create generation result from terrain data
    fn create_generation_result(&self) -> TerrainGenerationResult {
        let mesh = self.terrain.mesh().expect("Mesh not built");
        
        // Flatten vertices
        let mut vertices = Vec::with_capacity(mesh.vertices.len() * 3);
        let mut colors = Vec::with_capacity(mesh.vertices.len() * 3);
        
        for vertex in &mesh.vertices {
            vertices.push(vertex.position.x);
            vertices.push(vertex.position.y);
            vertices.push(vertex.position.z);
            
            if let Some(color) = vertex.color {
                colors.push(color.x);
                colors.push(color.y);
                colors.push(color.z);
            } else {
                colors.push(0.5);
                colors.push(0.5);
                colors.push(0.5);
            }
        }
        
        // Flatten faces
        let mut faces = Vec::with_capacity(mesh.faces.len() * 3);
        for face in &mesh.faces {
            faces.push(face.vertices[0] as u32);
            faces.push(face.vertices[1] as u32);
            faces.push(face.vertices[2] as u32);
        }
        
        // Get heightmap
        let heightmap = self.terrain.heightmap().data.clone();
        
        // Get slope map if available
        let slope_map = self.terrain.slope_map().map(|m| m.data.clone());
        
        // Build stats
        let stats = TerrainStats {
            num_vertices: mesh.vertices.len(),
            num_faces: mesh.faces.len(),
            min_height: self.terrain.metadata.min_height,
            max_height: self.terrain.metadata.max_height,
            avg_height: self.terrain.metadata.avg_height,
        };
        
        TerrainGenerationResult {
            vertices,
            colors,
            faces,
            heightmap,
            slope_map,
            stats,
        }
    }
}
