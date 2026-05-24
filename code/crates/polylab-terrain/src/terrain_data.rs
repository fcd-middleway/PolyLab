//! Central terrain data structure
//!
//! TerrainData is the core structure that holds all terrain information.
//! It is designed to be used across all PolyLab projects (similar to AIF for compression).

use crate::maps::{HeightMap, ScalarMap, FlowDirectionMap, MaterialWeightMaps};
use polylab_core::Mesh;

/// Terrain generation configuration
#[derive(Clone, Debug)]
pub struct TerrainConfig {
    /// Width of the terrain grid (number of cells along X axis)
    pub width: usize,
    /// Height of the terrain grid (number of cells along Z axis)
    pub height: usize,
    /// Resolution in world units (distance between two adjacent grid points)
    pub resolution: f32,
    /// Random seed for deterministic generation
    pub seed: u64,
}

impl Default for TerrainConfig {
    fn default() -> Self {
        Self {
            width: 128,
            height: 128,
            resolution: 1.0,
            seed: 0,
        }
    }
}

/// Metadata about the terrain (generation parameters, statistics, etc.)
#[derive(Clone, Debug)]
pub struct TerrainMetadata {
    /// Original configuration used to create this terrain
    pub config: TerrainConfig,
    /// World-space bounds
    pub world_width: f32,
    pub world_height: f32,
    /// Height statistics (computed from heightmap)
    pub min_height: f32,
    pub max_height: f32,
    pub avg_height: f32,
}

impl TerrainMetadata {
    /// Create metadata from configuration (statistics will be updated later)
    pub fn from_config(config: TerrainConfig) -> Self {
        let world_width = (config.width as f32) * config.resolution;
        let world_height = (config.height as f32) * config.resolution;
        
        Self {
            config,
            world_width,
            world_height,
            min_height: 0.0,
            max_height: 0.0,
            avg_height: 0.0,
        }
    }

    /// Update height statistics from heightmap
    pub fn update_height_stats(&mut self, heightmap: &HeightMap) {
        self.min_height = heightmap.min();
        self.max_height = heightmap.max();
        self.avg_height = heightmap.data.iter().sum::<f32>() / heightmap.data.len() as f32;
    }
}

/// Central terrain data structure
///
/// This structure holds all terrain maps and derived data.
/// It is progressively populated by pipeline stages.
///
/// # Design
///
/// - **Core data**: heightmap (always present)
/// - **Derived maps**: Optional maps computed by pipeline stages
/// - **Output**: Generated mesh (optional, created by mesh building stage)
///
/// # Usage
///
/// ```rust,no_run
/// use polylab_terrain::{TerrainData, TerrainConfig};
///
/// let mut terrain = TerrainData::new(TerrainConfig {
///     width: 256,
///     height: 256,
///     resolution: 1.0,
///     seed: 42,
/// });
///
/// // Pipeline stages will populate the maps...
/// // terrain.heightmap gets filled by NoiseGenerationStage
/// // terrain.slope_map gets computed by SlopeCalculationStage
/// // etc.
/// ```
pub struct TerrainData {
    /// Terrain metadata and configuration
    pub metadata: TerrainMetadata,
    
    /// Core terrain data: height values (always present)
    heightmap: HeightMap,
    
    /// Derived maps (computed by pipeline stages)
    slope_map: Option<ScalarMap>,
    flow_direction: Option<FlowDirectionMap>,
    flow_accumulation: Option<ScalarMap>,
    moisture_map: Option<ScalarMap>,
    sediment_map: Option<ScalarMap>,
    material_weights: Option<MaterialWeightMaps>,
    
    /// Generated 3D mesh (output of mesh building stage)
    mesh: Option<Mesh>,
}

impl TerrainData {
    /// Create a new terrain with given configuration
    ///
    /// The heightmap is initialized to zeros. Pipeline stages will fill it.
    pub fn new(config: TerrainConfig) -> Self {
        let metadata = TerrainMetadata::from_config(config.clone());
        let heightmap = HeightMap::new(config.width, config.height);
        
        Self {
            metadata,
            heightmap,
            slope_map: None,
            flow_direction: None,
            flow_accumulation: None,
            moisture_map: None,
            sediment_map: None,
            material_weights: None,
            mesh: None,
        }
    }

    // ========================================================================
    // Heightmap access
    // ========================================================================

    /// Get immutable reference to heightmap
    pub fn heightmap(&self) -> &HeightMap {
        &self.heightmap
    }

    /// Get mutable reference to heightmap
    pub fn heightmap_mut(&mut self) -> &mut HeightMap {
        &mut self.heightmap
    }

    /// Update height statistics in metadata (should be called after heightmap changes)
    pub fn update_stats(&mut self) {
        self.metadata.update_height_stats(&self.heightmap);
    }

    // ========================================================================
    // Derived maps access
    // ========================================================================

    /// Get slope map (if computed)
    pub fn slope_map(&self) -> Option<&ScalarMap> {
        self.slope_map.as_ref()
    }

    /// Get mutable slope map, creating it if needed
    pub fn slope_map_mut(&mut self) -> &mut ScalarMap {
        let width = self.metadata.config.width;
        let height = self.metadata.config.height;
        self.slope_map.get_or_insert_with(|| ScalarMap::new(width, height))
    }

    /// Get flow direction map (if computed)
    pub fn flow_direction(&self) -> Option<&FlowDirectionMap> {
        self.flow_direction.as_ref()
    }

    /// Get mutable flow direction map, creating it if needed
    pub fn flow_direction_mut(&mut self) -> &mut FlowDirectionMap {
        let width = self.metadata.config.width;
        let height = self.metadata.config.height;
        self.flow_direction.get_or_insert_with(|| FlowDirectionMap::new(width, height))
    }

    /// Get flow accumulation map (if computed)
    pub fn flow_accumulation(&self) -> Option<&ScalarMap> {
        self.flow_accumulation.as_ref()
    }

    /// Get mutable flow accumulation map, creating it if needed
    pub fn flow_accumulation_mut(&mut self) -> &mut ScalarMap {
        let width = self.metadata.config.width;
        let height = self.metadata.config.height;
        self.flow_accumulation.get_or_insert_with(|| ScalarMap::new(width, height))
    }

    /// Get moisture map (if computed)
    pub fn moisture_map(&self) -> Option<&ScalarMap> {
        self.moisture_map.as_ref()
    }

    /// Get mutable moisture map, creating it if needed
    pub fn moisture_map_mut(&mut self) -> &mut ScalarMap {
        let width = self.metadata.config.width;
        let height = self.metadata.config.height;
        self.moisture_map.get_or_insert_with(|| ScalarMap::new(width, height))
    }

    /// Get sediment map (if computed)
    pub fn sediment_map(&self) -> Option<&ScalarMap> {
        self.sediment_map.as_ref()
    }

    /// Get mutable sediment map, creating it if needed
    pub fn sediment_map_mut(&mut self) -> &mut ScalarMap {
        let width = self.metadata.config.width;
        let height = self.metadata.config.height;
        self.sediment_map.get_or_insert_with(|| ScalarMap::new(width, height))
    }

    /// Get material weight maps (if computed)
    pub fn material_weights(&self) -> Option<&MaterialWeightMaps> {
        self.material_weights.as_ref()
    }

    /// Get mutable material weight maps, creating them if needed
    pub fn material_weights_mut(&mut self, num_materials: usize) -> &mut MaterialWeightMaps {
        let width = self.metadata.config.width;
        let height = self.metadata.config.height;
        self.material_weights.get_or_insert_with(|| {
            MaterialWeightMaps::new(width, height, num_materials)
        })
    }

    // ========================================================================
    // Mesh access
    // ========================================================================

    /// Get generated mesh (if built)
    pub fn mesh(&self) -> Option<&Mesh> {
        self.mesh.as_ref()
    }

    /// Get mutable mesh reference
    pub fn mesh_mut(&mut self) -> Option<&mut Mesh> {
        self.mesh.as_mut()
    }

    /// Set the generated mesh
    pub fn set_mesh(&mut self, mesh: Mesh) {
        self.mesh = Some(mesh);
    }

    /// Take ownership of the mesh, leaving None
    pub fn take_mesh(&mut self) -> Option<Mesh> {
        self.mesh.take()
    }
}
