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
/// Supports both one-shot generation and step-by-step pipeline execution.
#[wasm_bindgen]
pub struct TerrainHandle {
    terrain: TerrainData,
    pipeline: Pipeline,
    current_step: usize,
}

#[wasm_bindgen]
impl TerrainHandle {
    /// Generate terrain with given configuration (legacy one-shot mode)
    ///
    /// # Arguments
    /// * `config` - Terrain generation configuration
    ///
    /// # Returns
    /// A new terrain handle with generated data
    ///
    /// # Note
    /// This constructor builds and executes the entire pipeline at once.
    /// For step-by-step control, use `create_base()` and add stages manually.
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

        Ok(TerrainHandle { 
            terrain,
            pipeline,
            current_step: 3, // All 3 stages completed
        })
    }

    /// Create a base terrain with flat heightmap (step-by-step mode)
    ///
    /// # Arguments
    /// * `width` - Width of terrain grid (number of vertices)
    /// * `height` - Height of terrain grid (number of vertices)
    /// * `resolution` - Resolution in world units (distance between grid points)
    /// * `seed` - Random seed for deterministic generation
    ///
    /// # Returns
    /// A new terrain handle with flat heightmap initialized to 0.0
    #[wasm_bindgen(js_name = createBase)]
    pub fn create_base(width: usize, height: usize, resolution: f32, seed: u64) -> Result<TerrainHandle, JsValue> {
        console_error_panic_hook::set_once();

        let terrain_config = TerrainConfig {
            width,
            height,
            resolution,
            seed,
        };

        let terrain = TerrainData::new(terrain_config);
        let pipeline = Pipeline::new();

        Ok(TerrainHandle {
            terrain,
            pipeline,
            current_step: 0,
        })
    }

    /// Add Perlin noise generation stage to the pipeline
    ///
    /// # Arguments
    /// * `frequency` - Noise frequency (lower = larger features)
    /// * `octaves` - Number of noise octaves (more = more detail)
    /// * `persistence` - Amplitude decay per octave (lower = smoother)
    /// * `lacunarity` - Frequency multiplier per octave
    /// * `height_scale` - Height scale multiplier
    #[wasm_bindgen(js_name = addNoiseStage)]
    pub fn add_noise_stage(
        &mut self,
        frequency: f32,
        octaves: u32,
        persistence: f32,
        lacunarity: f32,
        height_scale: f32,
    ) {
        let noise_stage = NoiseGenerationStage::new(NoiseGenerationConfig {
            frequency,
            octaves,
            persistence,
            lacunarity,
            height_scale,
            height_offset: 0.0,
        });
        self.pipeline.add_stage(Box::new(noise_stage));
    }

    /// Add slope calculation stage to the pipeline
    #[wasm_bindgen(js_name = addSlopeStage)]
    pub fn add_slope_stage(&mut self) {
        self.pipeline.add_stage(Box::new(SlopeCalculationStage));
    }

    /// Add mesh building stage to the pipeline
    ///
    /// # Arguments
    /// * `apply_color` - Whether to apply height-based coloring
    /// * `calculate_normals` - Whether to calculate smooth vertex normals
    #[wasm_bindgen(js_name = addMeshStage)]
    pub fn add_mesh_stage(&mut self, apply_color: bool, calculate_normals: bool) {
        use crate::stages::MeshBuildingConfig;
        
        let config = MeshBuildingConfig {
            apply_color,
            calculate_normals,
        };
        self.pipeline.add_stage(Box::new(MeshBuildingStage::new(config)));
    }

    /// Execute the next stage in the pipeline
    ///
    /// # Returns
    /// Ok with stage name if successful, Err if pipeline is complete or stage fails
    #[wasm_bindgen(js_name = executeNextStep)]
    pub fn execute_next_step(&mut self) -> Result<String, JsValue> {
        if self.current_step >= self.pipeline.stage_count() {
            return Err(JsValue::from_str("Pipeline complete: no more stages to execute"));
        }

        let stage_name = self.pipeline.get_stage_name(self.current_step)
            .ok_or_else(|| JsValue::from_str("Invalid stage index"))?;

        self.pipeline.execute_stage(self.current_step, &mut self.terrain)
            .map_err(|e| JsValue::from_str(&format!("Stage '{}' failed: {}", stage_name, e)))?;

        self.current_step += 1;
        Ok(stage_name.to_string())
    }

    /// Execute all remaining stages in the pipeline
    ///
    /// # Returns
    /// Number of stages executed
    #[wasm_bindgen(js_name = executeAllSteps)]
    pub fn execute_all_steps(&mut self) -> Result<usize, JsValue> {
        let initial_step = self.current_step;
        let total_stages = self.pipeline.stage_count();

        while self.current_step < total_stages {
            self.execute_next_step()?;
        }

        Ok(total_stages - initial_step)
    }

    /// Get pipeline execution status
    ///
    /// # Returns
    /// JSON object with: { current: number, total: number, completed: boolean[] }
    #[wasm_bindgen(js_name = getPipelineStatus)]
    pub fn get_pipeline_status(&self) -> Result<JsValue, JsValue> {
        #[derive(Serialize)]
        struct PipelineStatus {
            current: usize,
            total: usize,
            completed: Vec<bool>,
            stage_names: Vec<String>,
        }

        let total = self.pipeline.stage_count();
        let completed: Vec<bool> = (0..total)
            .map(|i| i < self.current_step)
            .collect();
        
        let stage_names: Vec<String> = (0..total)
            .filter_map(|i| self.pipeline.get_stage_name(i).map(|s| s.to_string()))
            .collect();

        let status = PipelineStatus {
            current: self.current_step,
            total,
            completed,
            stage_names,
        };

        serde_wasm_bindgen::to_value(&status)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
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

    /// Get heightmap width (number of columns)
    #[wasm_bindgen(js_name = getWidth)]
    pub fn get_width(&self) -> usize {
        self.terrain.metadata.config.width
    }

    /// Get heightmap height (number of rows)
    #[wasm_bindgen(js_name = getHeight)]
    pub fn get_height(&self) -> usize {
        self.terrain.metadata.config.height
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
