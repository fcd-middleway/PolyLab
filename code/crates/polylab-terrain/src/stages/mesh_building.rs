//! Mesh building stage - creates 3D mesh from heightmap

use crate::{TerrainData, PipelineStage, TerrainError};
use polylab_core::{Mesh, Vertex, Face};
use glam::Vec3;

/// Configuration for mesh building
#[derive(Clone, Debug)]
pub struct MeshBuildingConfig {
    /// Apply color based on height
    pub apply_color: bool,
    /// Calculate smooth vertex normals
    pub calculate_normals: bool,
}

impl Default for MeshBuildingConfig {
    fn default() -> Self {
        Self {
            apply_color: true,
            calculate_normals: true,
        }
    }
}

/// Stage that builds a 3D mesh from the heightmap
///
/// This stage creates a triangulated mesh where:
/// - Each heightmap cell becomes a quad (2 triangles)
/// - Vertex positions are determined by heightmap values
/// - Colors are optionally assigned based on height
/// - Normals are optionally calculated for smooth lighting
pub struct MeshBuildingStage {
    config: MeshBuildingConfig,
}

impl MeshBuildingStage {
    /// Create mesh building stage with custom configuration
    pub fn new(config: MeshBuildingConfig) -> Self {
        Self { config }
    }

    /// Calculate terrain color based on normalized height (0.0 to 1.0)
    ///
    /// Creates a color gradient mimicking natural terrain:
    /// - 0.00-0.30: Deep blue → Cyan (water)
    /// - 0.30-0.45: Yellow-green (beach/lowlands)
    /// - 0.45-0.65: Green (plains/forests)
    /// - 0.65-0.80: Brown-gray (mountains)
    /// - 0.80-1.00: White (snow peaks)
    fn calculate_terrain_color(&self, height: f32) -> Vec3 {
        let height = height.clamp(0.0, 1.0);
        
        if height < 0.30 {
            // Water: deep blue → cyan
            let t = height / 0.30;
            Vec3::new(
                0.0 + t * 0.2,      // R: 0.0 → 0.2
                0.2 + t * 0.5,      // G: 0.2 → 0.7
                0.6 + t * 0.3,      // B: 0.6 → 0.9
            )
        } else if height < 0.45 {
            // Beach/lowlands: cyan → yellow-green
            let t = (height - 0.30) / 0.15;
            Vec3::new(
                0.2 + t * 0.6,      // R: 0.2 → 0.8
                0.7 + t * 0.2,      // G: 0.7 → 0.9
                0.9 - t * 0.5,      // B: 0.9 → 0.4
            )
        } else if height < 0.65 {
            // Plains/forests: yellow-green → dark green
            let t = (height - 0.45) / 0.20;
            Vec3::new(
                0.8 - t * 0.6,      // R: 0.8 → 0.2
                0.9 - t * 0.3,      // G: 0.9 → 0.6
                0.4 - t * 0.2,      // B: 0.4 → 0.2
            )
        } else if height < 0.80 {
            // Mountains: dark green → brown-gray
            let t = (height - 0.65) / 0.15;
            Vec3::new(
                0.2 + t * 0.3,      // R: 0.2 → 0.5
                0.6 - t * 0.2,      // G: 0.6 → 0.4
                0.2 + t * 0.1,      // B: 0.2 → 0.3
            )
        } else {
            // Snow peaks: brown-gray → white
            let t = (height - 0.80) / 0.20;
            Vec3::new(
                0.5 + t * 0.5,      // R: 0.5 → 1.0
                0.4 + t * 0.6,      // G: 0.4 → 1.0
                0.3 + t * 0.7,      // B: 0.3 → 1.0
            )
        }
    }
}

impl Default for MeshBuildingStage {
    fn default() -> Self {
        Self::new(MeshBuildingConfig::default())
    }
}

impl PipelineStage for MeshBuildingStage {
    fn name(&self) -> &str {
        "Mesh Building"
    }

    fn can_execute(&self, terrain: &TerrainData) -> Result<(), TerrainError> {
        // Check that heightmap has valid dimensions
        let heightmap = terrain.heightmap();
        if heightmap.width == 0 || heightmap.height == 0 {
            return Err(TerrainError::MissingData(
                "Heightmap has invalid dimensions (0x0)".to_string()
            ));
        }
        // Note: A flat heightmap (all zeros) is valid and should be allowed
        Ok(())
    }

    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let heightmap = terrain.heightmap();
        let width = heightmap.width;
        let height = heightmap.height;
        let resolution = terrain.metadata.config.resolution;

        let min_height = terrain.metadata.min_height;
        let max_height = terrain.metadata.max_height;
        let height_range = max_height - min_height;

        let mut mesh = Mesh::new();

        // Calculate world-space center offset
        let world_width = (width as f32) * resolution;
        let world_height = (height as f32) * resolution;
        let offset_x = -world_width / 2.0;
        let offset_z = -world_height / 2.0;

        // Generate vertices
        for z in 0..height {
            for x in 0..width {
                let h = heightmap.get(x, z).unwrap_or(0.0);

                // World-space position (centered at origin)
                let world_x = (x as f32) * resolution + offset_x;
                let world_z = (z as f32) * resolution + offset_z;
                let world_y = h;

                // Calculate color if enabled
                let color = if self.config.apply_color {
                    let normalized_height = if height_range > 0.0 {
                        (h - min_height) / height_range
                    } else {
                        0.5
                    };
                    Some(self.calculate_terrain_color(normalized_height))
                } else {
                    None
                };

                mesh.vertices.push(Vertex {
                    position: Vec3::new(world_x, world_y, world_z),
                    normal: None,
                    tex_coords: None,
                    color,
                });
            }
        }

        // Generate faces (two triangles per quad)
        let verts_per_row = width;
        for z in 0..(height - 1) {
            for x in 0..(width - 1) {
                // Vertex indices for current quad
                let v0 = (z * verts_per_row + x) as usize;
                let v1 = v0 + 1;
                let v2 = v0 + verts_per_row;
                let v3 = v2 + 1;

                // First triangle (top-left)
                mesh.faces.push(Face {
                    vertices: [v0, v2, v1],
                });

                // Second triangle (bottom-right)
                mesh.faces.push(Face {
                    vertices: [v1, v2, v3],
                });
            }
        }

        // Calculate smooth vertex normals if enabled
        if self.config.calculate_normals {
            mesh.calculate_smooth_normals();
        }

        // Store mesh in terrain
        terrain.set_mesh(mesh);

        Ok(())
    }
}
