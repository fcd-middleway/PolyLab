//! Slope calculation stage - computes slope map from heightmap

use crate::{TerrainData, PipelineStage, TerrainError};

/// Stage that computes slope map from heightmap
///
/// For each cell, computes the maximum slope to any of its 8 neighbors.
/// Slope is stored as tangent of angle (rise/run).
pub struct SlopeCalculationStage;

impl SlopeCalculationStage {
    /// Calculate slope at (x, y) using 8-neighbor algorithm
    fn calculate_slope_at(
        &self,
        terrain: &TerrainData,
        x: usize,
        y: usize,
    ) -> f32 {
        let heightmap = terrain.heightmap();
        let resolution = terrain.metadata.config.resolution;
        let center_height = heightmap.get(x, y).unwrap_or(0.0);

        let mut max_slope = 0.0_f32;

        // Check all 8 neighbors
        let neighbors = [
            (-1, -1), (0, -1), (1, -1),
            (-1,  0),          (1,  0),
            (-1,  1), (0,  1), (1,  1),
        ];

        for (dx, dy) in neighbors.iter() {
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;

            if nx >= 0 && ny >= 0 {
                let nx = nx as usize;
                let ny = ny as usize;

                if let Some(neighbor_height) = heightmap.get(nx, ny) {
                    let height_diff = (neighbor_height - center_height).abs();
                    
                    // Distance depends on diagonal vs cardinal
                    let distance = if dx.abs() + dy.abs() == 2 {
                        // Diagonal neighbor
                        resolution * std::f32::consts::SQRT_2
                    } else {
                        // Cardinal neighbor
                        resolution
                    };

                    let slope = height_diff / distance;
                    max_slope = max_slope.max(slope);
                }
            }
        }

        max_slope
    }
}

impl PipelineStage for SlopeCalculationStage {
    fn name(&self) -> &str {
        "Slope Calculation"
    }

    fn can_execute(&self, terrain: &TerrainData) -> Result<(), TerrainError> {
        // Check that heightmap has been filled
        let heightmap = terrain.heightmap();
        if heightmap.max() == 0.0 && heightmap.min() == 0.0 {
            return Err(TerrainError::MissingData(
                "Heightmap is empty. Run noise generation first.".to_string()
            ));
        }
        Ok(())
    }

    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let width = terrain.metadata.config.width;
        let height = terrain.metadata.config.height;

        // Pre-compute all slopes (read-only pass)
        let mut slopes = Vec::with_capacity(width * height);
        for y in 0..height {
            for x in 0..width {
                let slope = self.calculate_slope_at(terrain, x, y);
                slopes.push(slope);
            }
        }

        // Write slopes to map (write-only pass)
        let slope_map = terrain.slope_map_mut();
        for y in 0..height {
            for x in 0..width {
                let index = y * width + x;
                slope_map.set(x, y, slopes[index]);
            }
        }

        Ok(())
    }
}
