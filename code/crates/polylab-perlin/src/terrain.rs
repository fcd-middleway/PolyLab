/// Terrain mesh generation using Perlin noise
///
/// Generates 3D terrain meshes with configurable parameters.

use polylab_core::{Mesh, Vertex, Face};
use glam::Vec3;
use crate::perlin::PerlinNoise;

/// Calculate terrain color based on normalized height (0.0 to 1.0)
///
/// Creates a color gradient mimicking natural terrain:
/// - 0.00-0.30: Deep blue → Cyan (water)
/// - 0.30-0.45: Yellow-green (beach/lowlands)
/// - 0.45-0.65: Green (plains/forests)
/// - 0.65-0.80: Brown-gray (mountains)
/// - 0.80-1.00: White (snow peaks)
fn calculate_terrain_color(height: f32) -> Vec3 {
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

/// Parameters for terrain generation
#[derive(Debug, Clone)]
pub struct TerrainParams {
    /// Random seed for noise generation
    pub seed: u64,
    /// Number of noise octaves (1-8, more = more detail)
    pub octaves: u32,
    /// Amplitude decay per octave (0.1-1.0, lower = smoother)
    pub persistence: f32,
    /// Noise frequency scale (1-100, higher = zoomed out)
    pub scale: f32,
    /// Terrain width in world units
    pub width: f32,
    /// Terrain depth in world units
    pub depth: f32,
    /// Number of vertices along width (resolution)
    pub width_segments: u32,
    /// Number of vertices along depth (resolution)
    pub depth_segments: u32,
    /// Minimum terrain height (y coordinate)
    pub height_min: f32,
    /// Maximum terrain height (y coordinate)
    pub height_max: f32,
}

impl Default for TerrainParams {
    fn default() -> Self {
        TerrainParams {
            seed: 12345,
            octaves: 4,
            persistence: 0.5,
            scale: 20.0,
            width: 20.0,
            depth: 20.0,
            width_segments: 50,
            depth_segments: 50,
            height_min: 0.0,
            height_max: 10.0,
        }
    }
}

/// Generate terrain mesh from parameters
///
/// # Arguments
/// * `params` - Terrain generation parameters
///
/// # Returns
/// Generated mesh with vertices positioned according to Perlin noise
pub fn generate_terrain(params: &TerrainParams) -> Mesh {
    let perlin = PerlinNoise::new(params.seed);
    
    let width_segments = params.width_segments.max(2);
    let depth_segments = params.depth_segments.max(2);
    
    let mut mesh = Mesh::new();
    
    // Generate vertices with Perlin noise heights
    for z_seg in 0..=depth_segments {
        for x_seg in 0..=width_segments {
            // Position in world space (centered at origin)
            let x = (x_seg as f32 / width_segments as f32) * params.width - params.width / 2.0;
            let z = (z_seg as f32 / depth_segments as f32) * params.depth - params.depth / 2.0;
            
            // Sample Perlin noise
            let noise_x = x / params.scale;
            let noise_z = z / params.scale;
            let noise_value = perlin.fbm(noise_x, noise_z, params.octaves, params.persistence);
            
            // Map noise from [-1, 1] to [height_min, height_max]
            let height = params.height_min + (noise_value + 1.0) * 0.5 * (params.height_max - params.height_min);
            
            // Calculate color based on normalized height (0.0 = min, 1.0 = max)
            let height_normalized = (height - params.height_min) / (params.height_max - params.height_min);
            let color = calculate_terrain_color(height_normalized);
            
            mesh.vertices.push(Vertex {
                position: Vec3::new(x, height, z),
                normal: None,
                tex_coords: None,
                color: Some(color),
            });
        }
    }
    
    // Generate faces (two triangles per quad)
    let verts_per_row = width_segments + 1;
    for z_seg in 0..depth_segments {
        for x_seg in 0..width_segments {
            // Vertex indices for current quad
            let v0 = (z_seg * verts_per_row + x_seg) as usize;
            let v1 = v0 + 1;
            let v2 = v0 + verts_per_row as usize;
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
    
    mesh
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_terrain_basic() {
        let params = TerrainParams::default();
        let mesh = generate_terrain(&params);
        
        // Expected vertex count: (width_segments + 1) * (depth_segments + 1)
        let expected_vertices = (params.width_segments + 1) * (params.depth_segments + 1);
        assert_eq!(mesh.vertices.len(), expected_vertices as usize);
        
        // Expected face count: width_segments * depth_segments * 2
        let expected_faces = params.width_segments * params.depth_segments * 2;
        assert_eq!(mesh.faces.len(), expected_faces as usize);
    }

    #[test]
    fn test_terrain_vertices_in_bounds() {
        let params = TerrainParams {
            width: 10.0,
            depth: 10.0,
            width_segments: 10,
            depth_segments: 10,
            height_min: 0.0,
            height_max: 5.0,
            ..Default::default()
        };
        
        let mesh = generate_terrain(&params);
        
        for vertex in &mesh.vertices {
            let pos = vertex.position;
            
            // X should be in [-width/2, width/2]
            assert!(
                pos.x >= -params.width / 2.0 - 0.01 && pos.x <= params.width / 2.0 + 0.01,
                "X out of bounds: {}",
                pos.x
            );
            
            // Z should be in [-depth/2, depth/2]
            assert!(
                pos.z >= -params.depth / 2.0 - 0.01 && pos.z <= params.depth / 2.0 + 0.01,
                "Z out of bounds: {}",
                pos.z
            );
            
            // Y should be in [height_min, height_max]
            assert!(
                pos.y >= params.height_min && pos.y <= params.height_max,
                "Y out of bounds: {}",
                pos.y
            );
        }
    }

    #[test]
    fn test_terrain_faces_valid_indices() {
        let params = TerrainParams {
            width_segments: 5,
            depth_segments: 5,
            ..Default::default()
        };
        
        let mesh = generate_terrain(&params);
        let vertex_count = mesh.vertices.len();
        
        for face in &mesh.faces {
            assert!(face.vertices[0] < vertex_count, "Face index 0 out of bounds");
            assert!(face.vertices[1] < vertex_count, "Face index 1 out of bounds");
            assert!(face.vertices[2] < vertex_count, "Face index 2 out of bounds");
        }
    }

    #[test]
    fn test_terrain_deterministic() {
        let params = TerrainParams {
            seed: 42,
            ..Default::default()
        };
        
        let mesh1 = generate_terrain(&params);
        let mesh2 = generate_terrain(&params);
        
        assert_eq!(mesh1.vertices.len(), mesh2.vertices.len());
        assert_eq!(mesh1.faces.len(), mesh2.faces.len());
        
        // Check first few vertices are identical
        for i in 0..10.min(mesh1.vertices.len()) {
            let pos1 = mesh1.vertices[i].position;
            let pos2 = mesh2.vertices[i].position;
            assert_eq!(pos1.x, pos2.x);
            assert_eq!(pos1.y, pos2.y);
            assert_eq!(pos1.z, pos2.z);
        }
    }

    #[test]
    fn test_different_seeds_produce_different_terrain() {
        let params1 = TerrainParams {
            seed: 1,
            ..Default::default()
        };
        let params2 = TerrainParams {
            seed: 2,
            ..Default::default()
        };
        
        let mesh1 = generate_terrain(&params1);
        let mesh2 = generate_terrain(&params2);
        
        // Heights should differ
        let mut heights_differ = false;
        for i in 0..mesh1.vertices.len() {
            if (mesh1.vertices[i].position.y - mesh2.vertices[i].position.y).abs() > 0.01 {
                heights_differ = true;
                break;
            }
        }
        assert!(heights_differ, "Different seeds should produce different terrain");
    }
}
