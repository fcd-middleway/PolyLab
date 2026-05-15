//! Camera system for 3D navigation
//!
//! Implements a first-person camera with position and orientation.
//! Provides methods for movement and rotation without drift.

use glam::{Vec3, Mat4};

/// First-person camera
///
/// Stores absolute position and orientation (yaw/pitch).
/// Recalculates view matrix on each frame to avoid drift.
#[derive(Debug, Clone)]
pub struct Camera {
    /// Camera position in world space
    position: Vec3,
    
    /// Yaw angle (rotation around Y axis) in radians
    /// 0 = looking towards +Z, PI/2 = looking towards +X
    yaw: f32,
    
    /// Pitch angle (rotation around X axis) in radians
    /// 0 = looking horizontally, PI/2 = looking up
    pitch: f32,
    
    /// Target point for orbital rotation
    orbit_target: Vec3,
    
    /// Movement speed (units per second)
    pub move_speed: f32,
    
    /// Rotation sensitivity (radians per input unit)
    pub rotation_speed: f32,
    
    /// Field of view in degrees
    pub fov: f32,
    
    /// Near clipping plane
    pub near: f32,
    
    /// Far clipping plane
    pub far: f32,
}

impl Camera {
    /// Create a new camera with default settings
    pub fn new() -> Self {
        Self {
            position: Vec3::new(0.0, 0.0, 10.0), // Start above and back
            yaw: 0.0,
            pitch: 0.0,
            orbit_target: Vec3::ZERO, // Default orbit around origin
            move_speed: 5.0,
            rotation_speed: 1.0,
            fov: 45.0,
            near: 0.1,
            far: 200.0, // Extended for large terrains (100x100+)
        }
    }
    
    /// Get camera position
    pub fn position(&self) -> Vec3 {
        self.position
    }
    
    /// Set camera position
    pub fn set_position(&mut self, position: Vec3) {
        self.position = position;
    }
    
    /// Get forward direction vector
    pub fn forward(&self) -> Vec3 {
        Vec3::new(
            self.yaw.sin() * self.pitch.cos(),
            self.pitch.sin(),
            -self.yaw.cos() * self.pitch.cos(),
        ).normalize()
    }
    
    /// Get right direction vector
    pub fn right(&self) -> Vec3 {
        self.forward().cross(Vec3::Y).normalize()
    }
    
    /// Get up direction vector
    pub fn up(&self) -> Vec3 {
        self.right().cross(self.forward()).normalize()
    }
    
    /// Move forward/backward (positive = forward)
    pub fn move_forward(&mut self, delta: f32) {
        let forward = self.forward();
        self.position += forward * delta * self.move_speed;
    }
    
    /// Move right/left (positive = right)
    pub fn move_right(&mut self, delta: f32) {
        let right = self.right();
        self.position += right * delta * self.move_speed;
    }
    
    /// Move up/down (positive = up)
    pub fn move_up(&mut self, delta: f32) {
        self.position.y += delta * self.move_speed;
    }
    
    /// Rotate yaw (left/right) in radians
    pub fn rotate_yaw(&mut self, delta: f32) {
        self.yaw += delta * self.rotation_speed;
        // Keep yaw in [0, 2*PI]
        while self.yaw < 0.0 {
            self.yaw += std::f32::consts::TAU;
        }
        while self.yaw >= std::f32::consts::TAU {
            self.yaw -= std::f32::consts::TAU;
        }
    }
    
    /// Rotate pitch (up/down) in radians
    pub fn rotate_pitch(&mut self, delta: f32) {
        self.pitch += delta * self.rotation_speed;
        // Clamp pitch to avoid gimbal lock
        let max_pitch = std::f32::consts::FRAC_PI_2 - 0.01;
        self.pitch = self.pitch.clamp(-max_pitch, max_pitch);
    }
    
    /// Calculate view matrix
    pub fn view_matrix(&self) -> Mat4 {
        let forward = self.forward();
        let target = self.position + forward;
        Mat4::look_at_rh(self.position, target, Vec3::Y)
    }
    
    /// Calculate projection matrix
    pub fn projection_matrix(&self, aspect_ratio: f32) -> Mat4 {
        Mat4::perspective_rh(
            self.fov.to_radians(),
            aspect_ratio,
            self.near,
            self.far,
        )
    }
    
    /// Calculate combined view-projection matrix
    pub fn view_projection_matrix(&self, aspect_ratio: f32) -> Mat4 {
        self.projection_matrix(aspect_ratio) * self.view_matrix()
    }
    
    /// Set orbital rotation target
    pub fn set_orbit_target(&mut self, target: Vec3) {
        self.orbit_target = target;
    }
    
    /// Get orbital rotation target
    pub fn orbit_target(&self) -> Vec3 {
        self.orbit_target
    }
    
    /// Orbit around the target point (spherical rotation)
    ///
    /// Rotates the camera around orbit_target while maintaining distance.
    /// The camera always looks at the target after orbiting.
    pub fn orbit_around(&mut self, delta_yaw: f32, delta_pitch: f32) {
        // Calculate current offset from target
        let offset = self.position - self.orbit_target;
        let distance = offset.length();
        
        if distance < 0.01 {
            // Too close to target, can't orbit
            return;
        }
        
        // Convert to spherical coordinates
        // theta = horizontal angle (azimuth), phi = vertical angle from horizontal plane
        // theta = 0 points towards +Z, increases towards +X
        let theta = offset.x.atan2(offset.z); // Current yaw (angle from +Z)
        let horizontal_dist = (offset.x * offset.x + offset.z * offset.z).sqrt();
        let phi = offset.y.atan2(horizontal_dist); // Current pitch from horizontal
        
        // Apply rotation deltas
        let new_theta = theta + delta_yaw * self.rotation_speed;
        let new_phi = (phi + delta_pitch * self.rotation_speed)
            .clamp(-std::f32::consts::FRAC_PI_2 + 0.01, std::f32::consts::FRAC_PI_2 - 0.01);
        
        // Convert back to cartesian
        let new_offset = Vec3::new(
            distance * new_phi.cos() * new_theta.sin(),
            distance * new_phi.sin(),
            distance * new_phi.cos() * new_theta.cos(),
        );
        
        // Update position
        self.position = self.orbit_target + new_offset;
        
        // Update yaw/pitch to look at target (FPS convention: yaw=0 looks at -Z)
        let look_dir = (self.orbit_target - self.position).normalize();
        self.yaw = look_dir.x.atan2(-look_dir.z);
        self.pitch = look_dir.y.asin();
    }
}

impl Default for Camera {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_camera_forward() {
        let mut camera = Camera::new();
        camera.yaw = 0.0;
        camera.pitch = 0.0;
        let forward = camera.forward();
        
        // Looking towards -Z (FPS standard convention)
        assert!((forward.x).abs() < 0.01);
        assert!((forward.y).abs() < 0.01);
        assert!((forward.z + 1.0).abs() < 0.01); // -Z direction
    }
    
    #[test]
    fn test_camera_movement_no_drift() {
        let mut camera = Camera::new();
        let initial_pos = camera.position();
        
        // Move forward then backward
        camera.move_forward(1.0);
        camera.move_forward(-1.0);
        
        let final_pos = camera.position();
        
        // Should return to (approximately) the same position
        assert!((final_pos - initial_pos).length() < 0.001);
    }
    
    #[test]
    fn test_pitch_clamping() {
        let mut camera = Camera::new();
        
        // Try to rotate beyond vertical
        camera.rotate_pitch(10.0);
        
        // Should be clamped
        assert!(camera.pitch < std::f32::consts::FRAC_PI_2);
        assert!(camera.pitch > -std::f32::consts::FRAC_PI_2);
    }
}
