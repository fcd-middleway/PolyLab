//! Pipeline stages for terrain generation

mod noise_generation;
mod slope_calculation;
mod mesh_building;

pub use noise_generation::{NoiseGenerationStage, NoiseGenerationConfig};
pub use slope_calculation::SlopeCalculationStage;
pub use mesh_building::{MeshBuildingStage, MeshBuildingConfig};
