//! Pipeline system for terrain generation
//!
//! A pipeline is a sequence of stages that transform terrain data.
//! Each stage implements the `PipelineStage` trait.

use crate::TerrainData;
use std::fmt;

/// Error type for terrain generation pipeline
#[derive(Debug)]
pub enum TerrainError {
    /// Stage execution failed
    StageError { stage: String, message: String },
    /// Invalid configuration
    ConfigError(String),
    /// Missing required data
    MissingData(String),
}

impl fmt::Display for TerrainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TerrainError::StageError { stage, message } => {
                write!(f, "Stage '{}' failed: {}", stage, message)
            }
            TerrainError::ConfigError(msg) => write!(f, "Configuration error: {}", msg),
            TerrainError::MissingData(msg) => write!(f, "Missing data: {}", msg),
        }
    }
}

impl std::error::Error for TerrainError {}

/// Trait for a single pipeline stage
///
/// Each stage transforms the terrain data in some way:
/// - Noise generation fills the heightmap
/// - Slope calculation computes slope_map from heightmap
/// - Erosion modifies heightmap based on simulation
/// - Mesh building creates the 3D mesh from heightmap
///
/// # Example
///
/// ```rust,no_run
/// use polylab_terrain::{TerrainData, PipelineStage, TerrainError};
///
/// struct MyCustomStage;
///
/// impl PipelineStage for MyCustomStage {
///     fn name(&self) -> &str {
///         "My Custom Stage"
///     }
///
///     fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
///         // Transform terrain data here...
///         Ok(())
///     }
/// }
/// ```
pub trait PipelineStage {
    /// Human-readable stage name (for logging/debugging)
    fn name(&self) -> &str;

    /// Execute this stage, transforming the terrain data
    ///
    /// Stages can read and write any part of TerrainData.
    /// They should handle errors gracefully and return TerrainError on failure.
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError>;

    /// Optional: check if this stage can run given current terrain state
    ///
    /// For example, SlopeCalculation requires heightmap to be filled.
    /// Default implementation always returns Ok.
    fn can_execute(&self, _terrain: &TerrainData) -> Result<(), TerrainError> {
        Ok(())
    }
}

/// Pipeline orchestrator
///
/// Manages a sequence of pipeline stages and executes them in order.
///
/// # Example
///
/// ```rust,no_run
/// use polylab_terrain::{Pipeline, TerrainData, TerrainConfig};
/// use polylab_terrain::stages::*;
///
/// let mut pipeline = Pipeline::new();
/// pipeline.add_stage(Box::new(NoiseGenerationStage::default()));
/// pipeline.add_stage(Box::new(SlopeCalculationStage));
/// pipeline.add_stage(Box::new(MeshBuildingStage));
///
/// let mut terrain = TerrainData::new(TerrainConfig::default());
/// pipeline.execute(&mut terrain)?;
/// ```
pub struct Pipeline {
    stages: Vec<Box<dyn PipelineStage>>,
}

impl Pipeline {
    /// Create a new empty pipeline
    pub fn new() -> Self {
        Self {
            stages: Vec::new(),
        }
    }

    /// Add a stage to the pipeline
    pub fn add_stage(&mut self, stage: Box<dyn PipelineStage>) {
        self.stages.push(stage);
    }

    /// Get number of stages in pipeline
    pub fn len(&self) -> usize {
        self.stages.len()
    }

    /// Check if pipeline is empty
    pub fn is_empty(&self) -> bool {
        self.stages.is_empty()
    }

    /// Execute all stages in sequence
    ///
    /// Stops at first error and returns it.
    pub fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        for stage in &self.stages {
            // Check if stage can run
            stage.can_execute(terrain)?;
            
            // Execute stage
            stage.execute(terrain)?;
        }
        
        Ok(())
    }

    /// Execute pipeline with progress callback
    ///
    /// The callback receives (stage_index, stage_name) before each stage executes.
    pub fn execute_with_progress<F>(
        &self,
        terrain: &mut TerrainData,
        mut progress_callback: F,
    ) -> Result<(), TerrainError>
    where
        F: FnMut(usize, &str),
    {
        for (i, stage) in self.stages.iter().enumerate() {
            progress_callback(i, stage.name());
            
            stage.can_execute(terrain)?;
            stage.execute(terrain)?;
        }
        
        Ok(())
    }

    /// Get stage names (for debugging/logging)
    pub fn stage_names(&self) -> Vec<&str> {
        self.stages.iter().map(|s| s.name()).collect()
    }

    /// Get total number of stages in the pipeline
    pub fn stage_count(&self) -> usize {
        self.stages.len()
    }

    /// Get the name of a specific stage by index
    ///
    /// # Arguments
    /// * `index` - Stage index (0-based)
    ///
    /// # Returns
    /// Some(stage_name) if index is valid, None otherwise
    pub fn get_stage_name(&self, index: usize) -> Option<&str> {
        self.stages.get(index).map(|s| s.name())
    }

    /// Execute a specific stage by index
    ///
    /// # Arguments
    /// * `index` - Stage index (0-based)
    /// * `terrain` - Terrain data to transform
    ///
    /// # Returns
    /// Ok(()) if stage executed successfully, Err otherwise
    pub fn execute_stage(&self, index: usize, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let stage = self.stages.get(index)
            .ok_or_else(|| TerrainError::ConfigError(format!("Invalid stage index: {}", index)))?;

        // Check if stage can run
        stage.can_execute(terrain)?;

        // Execute stage
        stage.execute(terrain)?;

        Ok(())
    }
}

impl Default for Pipeline {
    fn default() -> Self {
        Self::new()
    }
}
