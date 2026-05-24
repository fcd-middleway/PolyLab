//! Noise generation stage - fills heightmap with Perlin noise

use crate::{TerrainData, PipelineStage, TerrainError};
use polylab_perlin::PerlinNoise;

/// Noise generation parameters
#[derive(Clone, Debug)]
pub struct NoiseGenerationConfig {
    /// Base frequency of noise
    pub frequency: f32,
    /// Number of octaves (layers of detail)
    pub octaves: u32,
    /// Amplitude multiplier between octaves
    pub persistence: f32,
    /// Frequency multiplier between octaves
    pub lacunarity: f32,
    /// Height scale (multiplier applied to final noise values)
    pub height_scale: f32,
    /// Height offset (added to final noise values)
    pub height_offset: f32,
}

impl Default for NoiseGenerationConfig {
    fn default() -> Self {
        Self {
            frequency: 0.05,
            octaves: 6,
            persistence: 0.5,
            lacunarity: 2.0,
            height_scale: 50.0,
            height_offset: 0.0,
        }
    }
}

/// Stage that generates heightmap using Perlin noise
///
/// This is typically the first stage in a terrain pipeline.
/// It fills the heightmap with multi-octave Perlin noise (fBm).
pub struct NoiseGenerationStage {
    config: NoiseGenerationConfig,
}

impl NoiseGenerationStage {
    /// Create noise generation stage with custom configuration
    pub fn new(config: NoiseGenerationConfig) -> Self {
        Self { config }
    }

    /// Helper: compute fBm (fractal Brownian motion) at position (x, y)
    fn compute_fbm(&self, perlin: &PerlinNoise, x: f32, y: f32) -> f32 {
        let mut value = 0.0;
        let mut amplitude = 1.0;
        let mut frequency = self.config.frequency;
        let mut max_value = 0.0;

        for _ in 0..self.config.octaves {
            value += perlin.noise2d(x * frequency, y * frequency) * amplitude;
            max_value += amplitude;
            
            amplitude *= self.config.persistence;
            frequency *= self.config.lacunarity;
        }

        // Normalize to [-1, 1] range
        value / max_value
    }
}

impl Default for NoiseGenerationStage {
    fn default() -> Self {
        Self::new(NoiseGenerationConfig::default())
    }
}

impl PipelineStage for NoiseGenerationStage {
    fn name(&self) -> &str {
        "Noise Generation"
    }

    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let seed = terrain.metadata.config.seed;
        let perlin = PerlinNoise::new(seed);
        
        let heightmap = terrain.heightmap_mut();
        let width = heightmap.width;
        let height = heightmap.height;

        // Generate noise for each cell
        for y in 0..height {
            for x in 0..width {
                let noise_value = self.compute_fbm(&perlin, x as f32, y as f32);
                
                // Map from [-1, 1] to final height
                let height_value = (noise_value * 0.5 + 0.5) * self.config.height_scale 
                                   + self.config.height_offset;
                
                heightmap.set(x, y, height_value);
            }
        }

        // Update statistics
        terrain.update_stats();

        Ok(())
    }
}
