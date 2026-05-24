//! # PolyLab Terrain
//!
//! Core terrain generation system for PolyLab.
//!
//! This crate provides a central data structure (`TerrainData`) and a pipeline-based
//! architecture for procedural terrain generation. It is designed to be used across
//! all PolyLab projects, similar to how AIF is used for mesh compression.
//!
//! ## Architecture
//!
//! - **TerrainData**: Central structure holding all terrain maps (heightmap, slope, flow, etc.)
//! - **Pipeline**: Configurable chain of processing stages
//! - **Stages**: Individual transformations (noise generation, erosion, materials, etc.)
//!
//! ## Example
//!
//! ```rust,no_run
//! use polylab_terrain::{TerrainData, TerrainConfig, Pipeline};
//! use polylab_terrain::stages::*;
//!
//! // Create terrain with default configuration
//! let mut terrain = TerrainData::new(TerrainConfig {
//!     width: 256,
//!     height: 256,
//!     resolution: 1.0,
//!     seed: 12345,
//! });
//!
//! // Build pipeline
//! let mut pipeline = Pipeline::new();
//! pipeline.add_stage(Box::new(NoiseGenerationStage::default()));
//! pipeline.add_stage(Box::new(SlopeCalculationStage));
//! pipeline.add_stage(Box::new(MeshBuildingStage));
//!
//! // Execute pipeline
//! pipeline.execute(&mut terrain)?;
//!
//! // Access generated data
//! let heightmap = terrain.heightmap();
//! let slope_map = terrain.slope_map().unwrap();
//! let mesh = terrain.mesh().unwrap();
//! ```

mod terrain_data;
mod maps;
mod pipeline;
pub mod stages;

#[cfg(target_arch = "wasm32")]
mod wasm_bindings;

// Re-export main types
pub use terrain_data::{TerrainData, TerrainConfig, TerrainMetadata};
pub use maps::{HeightMap, ScalarMap, FlowDirectionMap};
pub use pipeline::{Pipeline, PipelineStage, TerrainError};

#[cfg(target_arch = "wasm32")]
pub use wasm_bindings::*;
