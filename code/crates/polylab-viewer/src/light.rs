//! Lighting system for scene illumination
//!
//! Defines light sources and their properties for shading calculations.

use glam::Vec3;

/// A directional light source (like the sun)
/// 
/// Directional lights have no position - they illuminate from a direction
/// with infinite distance. Used for sunlight, moonlight, etc.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DirectionalLight {
    /// Direction the light is pointing (normalized vector)
    pub direction: Vec3,
    _padding1: f32, // Align to 16 bytes for GPU
    
    /// Light color (RGB, typically 0.0-1.0 range)
    pub color: Vec3,
    _padding2: f32, // Align to 16 bytes for GPU
    
    /// Light intensity (brightness multiplier)
    pub intensity: f32,
    
    /// Ambient light intensity (minimum lighting level)
    pub ambient: f32,
    
    _padding3: [f32; 2], // Align to 16 bytes for GPU
    
    /// Ambient light color (RGB, typically 0.0-1.0 range)
    pub ambient_color: Vec3,
    _padding4: f32, // Align to 16 bytes for GPU
}

// Safety: DirectionalLight only contains f32 and Vec3 (which are f32)
unsafe impl bytemuck::Pod for DirectionalLight {}
unsafe impl bytemuck::Zeroable for DirectionalLight {}

impl DirectionalLight {
    /// Create a new directional light
    ///
    /// # Arguments
    /// * `direction` - Direction the light points (will be normalized)
    /// * `color` - RGB color (0.0-1.0)
    /// * `intensity` - Brightness multiplier
    /// * `ambient` - Minimum ambient lighting level
    pub fn new(direction: Vec3, color: Vec3, intensity: f32, ambient: f32) -> Self {
        Self {
            direction: direction.normalize(),
            _padding1: 0.0,
            color,
            _padding2: 0.0,
            intensity,
            ambient,
            _padding3: [0.0, 0.0],
            ambient_color: Vec3::new(0.8, 0.85, 0.9), // Default soft blue-white
            _padding4: 0.0,
        }
    }
    
    /// Create a new directional light with custom ambient color
    ///
    /// # Arguments
    /// * `direction` - Direction the light points (will be normalized)
    /// * `color` - RGB color (0.0-1.0)
    /// * `intensity` - Brightness multiplier
    /// * `ambient` - Minimum ambient lighting level
    /// * `ambient_color` - Ambient light color (RGB 0.0-1.0)
    pub fn new_with_ambient(
        direction: Vec3,
        color: Vec3,
        intensity: f32,
        ambient: f32,
        ambient_color: Vec3,
    ) -> Self {
        Self {
            direction: direction.normalize(),
            _padding1: 0.0,
            color,
            _padding2: 0.0,
            intensity,
            ambient,
            _padding3: [0.0, 0.0],
            ambient_color,
            _padding4: 0.0,
        }
    }
    
    /// Create a default sunlight (slightly angled from above)
    pub fn default_sun() -> Self {
        Self::new_with_ambient(
            Vec3::new(-0.3, -1.0, -0.5), // Pointing down-left-forward
            Vec3::new(1.0, 0.98, 0.95),   // Warm white sunlight
            0.8,                           // 80% intensity (less harsh)
            0.3,                           // 30% ambient
            Vec3::new(0.8, 0.85, 0.9),    // Soft blue-white ambient
        )
    }
}

/// Ambient light source (uniform background illumination)
/// 
/// Ambient light has no direction or position - it illuminates everything equally
/// from all directions. Used for soft fill lighting and preventing completely black shadows.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct AmbientLight {
    /// Light color (RGB, typically 0.0-1.0 range)
    pub color: Vec3,
    _padding1: f32, // Align to 16 bytes for GPU
    
    /// Light intensity (brightness multiplier)
    pub intensity: f32,
    
    _padding2: [f32; 3], // Align to 16 bytes for GPU
}

// Safety: AmbientLight only contains f32 and Vec3 (which are f32)
unsafe impl bytemuck::Pod for AmbientLight {}
unsafe impl bytemuck::Zeroable for AmbientLight {}

impl AmbientLight {
    /// Create a new ambient light
    ///
    /// # Arguments
    /// * `color` - RGB color (0.0-1.0)
    /// * `intensity` - Brightness multiplier
    pub fn new(color: Vec3, intensity: f32) -> Self {
        Self {
            color,
            _padding1: 0.0,
            intensity,
            _padding2: [0.0, 0.0, 0.0],
        }
    }
    
    /// Create a default soft ambient light
    pub fn default() -> Self {
        Self::new(
            Vec3::new(0.8, 0.85, 0.9),  // Soft blue-white ambient
            0.3,                          // 30% intensity (subtle fill)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_directional_light_creation() {
        let light = DirectionalLight::new(
            Vec3::new(0.0, -1.0, 0.0),
            Vec3::new(1.0, 1.0, 1.0),
            1.0,
            0.2,
        );
        
        // Direction should be normalized
        assert!((light.direction.length() - 1.0).abs() < 0.001);
    }
    
    #[test]
    fn test_default_sun() {
        let sun = DirectionalLight::default_sun();
        assert!(sun.intensity > 0.0);
        assert!(sun.ambient >= 0.0 && sun.ambient <= 1.0);
    }
    
    #[test]
    fn test_alignment() {
        // DirectionalLight should be properly aligned for GPU (multiple of 16 bytes)
        assert_eq!(std::mem::size_of::<DirectionalLight>() % 16, 0);
    }
}
