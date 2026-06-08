//! PolyLab Rover
//!
//! Rover simulation with stereo camera system for 3D reconstruction.
//! Provides rover positioning, orientation, and stereo camera matrix calculation.

use glam::{Vec3, Mat4};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// Rover with stereo camera system
///
/// Represents a rover with position, orientation, and stereo cameras
/// for capturing depth information and 3D reconstruction.
#[derive(Debug, Clone)]
pub struct Rover {
    /// Position in world space (meters)
    pub position: Vec3,
    /// Yaw rotation (Y-axis, radians). 0 = facing -Z, π/2 = facing +X
    /// Uses same convention as Camera: rotation positive = counterclockwise (left turn)
    pub yaw: f32,
    /// Pitch rotation (X-axis, radians). Positive = looking up
    pub pitch: f32,
    /// Height of stereo cameras above rover center (meters)
    pub eye_height: f32,
    /// Distance between left and right stereo cameras (meters)
    pub stereo_baseline: f32,
    /// Forward offset of stereo cameras from rover center (meters)
    pub forward_offset: f32,
}

impl Rover {
    /// Create a new rover at the origin
    pub fn new() -> Self {
        Self {
            position: Vec3::ZERO,
            yaw: 0.0,
            pitch: 0.0,
            eye_height: 0.8, // 80cm for Wall-E's eyes
            stereo_baseline: 0.3, // 30cm between cameras
            forward_offset: 0.25, // 25cm forward to clear Wall-E's arms
        }
    }
    
    /// Create a new rover at a specific position
    pub fn at_position(x: f32, y: f32, z: f32) -> Self {
        Self {
            position: Vec3::new(x, y, z),
            yaw: 0.0,
            pitch: 0.0,
            eye_height: 0.8,
            stereo_baseline: 0.3,
            forward_offset: 0.25,
        }
    }
    
    /// Set rover position
    pub fn set_position(&mut self, position: Vec3) {
        self.position = position;
    }
    
    /// Set rover orientation
    pub fn set_orientation(&mut self, yaw: f32, pitch: f32) {
        self.yaw = yaw;
        self.pitch = pitch;
    }
    
    /// Move rover forward by a distance
    /// Forward is determined by the yaw rotation
    /// Convention: yaw=0 → -Z, yaw increases → turns left (+X direction)
    pub fn move_forward(&mut self, distance: f32) {
        let forward = Vec3::new(
            self.yaw.sin(),
            0.0,
            -self.yaw.cos(),
        );
        self.position += forward * distance;
    }
    
    /// Move rover sideways (strafe)
    /// Right is perpendicular to forward
    pub fn move_right(&mut self, distance: f32) {
        let right = Vec3::new(
            self.yaw.cos(),
            0.0,
            self.yaw.sin(),
        );
        self.position += right * distance;
    }
    
    /// Rotate rover (change yaw)
    pub fn rotate(&mut self, delta_yaw: f32) {
        self.yaw += delta_yaw;
        
        // Normalize to [-PI, PI]
        while self.yaw > std::f32::consts::PI {
            self.yaw -= 2.0 * std::f32::consts::PI;
        }
        while self.yaw < -std::f32::consts::PI {
            self.yaw += 2.0 * std::f32::consts::PI;
        }
    }
    
    /// Tilt stereo cameras up/down (change pitch)
    pub fn tilt(&mut self, delta_pitch: f32) {
        self.pitch += delta_pitch;
        
        // Clamp pitch to avoid gimbal lock
        let max_pitch = std::f32::consts::PI / 2.0 - 0.01;
        self.pitch = self.pitch.clamp(-max_pitch, max_pitch);
    }
    
    /// Get position of left stereo camera
    pub fn get_left_camera_position(&self) -> Vec3 {
        let forward = Vec3::new(self.yaw.sin(), 0.0, -self.yaw.cos());
        let right = Vec3::new(self.yaw.cos(), 0.0, self.yaw.sin());
        let eye_pos = self.position 
            + Vec3::new(0.0, self.eye_height, 0.0)  // vertical offset
            + forward * self.forward_offset;         // forward offset
        eye_pos - right * (self.stereo_baseline / 2.0)
    }
    
    /// Get position of right stereo camera
    pub fn get_right_camera_position(&self) -> Vec3 {
        let forward = Vec3::new(self.yaw.sin(), 0.0, -self.yaw.cos());
        let right = Vec3::new(self.yaw.cos(), 0.0, self.yaw.sin());
        let eye_pos = self.position 
            + Vec3::new(0.0, self.eye_height, 0.0)  // vertical offset
            + forward * self.forward_offset;         // forward offset
        eye_pos + right * (self.stereo_baseline / 2.0)
    }
    
    /// Get view-projection matrix for left stereo camera
    pub fn get_left_view_projection_matrix(&self, aspect_ratio: f32) -> Mat4 {
        let left_pos = self.get_left_camera_position();
        polylab_viewer::create_view_projection_matrix(left_pos, self.yaw, self.pitch, aspect_ratio)
    }
    
    /// Get view-projection matrix for right stereo camera
    pub fn get_right_view_projection_matrix(&self, aspect_ratio: f32) -> Mat4 {
        let right_pos = self.get_right_camera_position();
        polylab_viewer::create_view_projection_matrix(right_pos, self.yaw, self.pitch, aspect_ratio)
    }
}

impl Default for Rover {
    fn default() -> Self {
        Self::new()
    }
}

// ========================
// WASM Bindings
// ========================

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct RoverHandle {
    rover: Rover,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl RoverHandle {
    /// Create a new rover at the origin
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            rover: Rover::new(),
        }
    }
    
    /// Create a rover at a specific position
    #[wasm_bindgen]
    pub fn at_position(x: f32, y: f32, z: f32) -> Self {
        Self {
            rover: Rover::at_position(x, y, z),
        }
    }
    
    /// Set rover position
    #[wasm_bindgen]
    pub fn set_position(&mut self, x: f32, y: f32, z: f32) {
        self.rover.set_position(Vec3::new(x, y, z));
    }
    
    /// Get rover position as [x, y, z]
    #[wasm_bindgen]
    pub fn get_position(&self) -> Vec<f32> {
        vec![self.rover.position.x, self.rover.position.y, self.rover.position.z]
    }
    
    /// Set rover orientation
    #[wasm_bindgen]
    pub fn set_orientation(&mut self, yaw: f32, pitch: f32) {
        self.rover.set_orientation(yaw, pitch);
    }
    
    /// Get rover yaw (radians)
    #[wasm_bindgen]
    pub fn get_yaw(&self) -> f32 {
        self.rover.yaw
    }
    
    /// Get rover pitch (radians)
    #[wasm_bindgen]
    pub fn get_pitch(&self) -> f32 {
        self.rover.pitch
    }
    
    /// Move rover forward by distance (meters)
    #[wasm_bindgen]
    pub fn move_forward(&mut self, distance: f32) {
        self.rover.move_forward(distance);
    }
    
    /// Move rover sideways (strafe right) by distance (meters)
    #[wasm_bindgen]
    pub fn move_right(&mut self, distance: f32) {
        self.rover.move_right(distance);
    }
    
    /// Rotate rover by delta_yaw (radians)
    #[wasm_bindgen]
    pub fn rotate(&mut self, delta_yaw: f32) {
        self.rover.rotate(delta_yaw);
    }
    
    /// Tilt stereo cameras by delta_pitch (radians)
    #[wasm_bindgen]
    pub fn tilt(&mut self, delta_pitch: f32) {
        self.rover.tilt(delta_pitch);
    }
    
    /// Set stereo baseline distance (meters)
    #[wasm_bindgen]
    pub fn set_stereo_baseline(&mut self, baseline: f32) {
        self.rover.stereo_baseline = baseline.abs();
    }
    
    /// Get stereo baseline (meters)
    #[wasm_bindgen]
    pub fn get_stereo_baseline(&self) -> f32 {
        self.rover.stereo_baseline
    }
    
    /// Set camera eye height above rover center (meters)
    #[wasm_bindgen]
    pub fn set_eye_height(&mut self, height: f32) {
        self.rover.eye_height = height;
    }
    
    /// Get camera eye height (meters)
    #[wasm_bindgen]
    pub fn get_eye_height(&self) -> f32 {
        self.rover.eye_height
    }
    
    /// Set camera forward offset from rover center (meters)
    #[wasm_bindgen]
    pub fn set_forward_offset(&mut self, offset: f32) {
        self.rover.forward_offset = offset;
    }
    
    /// Get camera forward offset (meters)
    #[wasm_bindgen]
    pub fn get_forward_offset(&self) -> f32 {
        self.rover.forward_offset
    }
    
    /// Get left stereo camera position as [x, y, z]
    #[wasm_bindgen]
    pub fn get_left_camera_position(&self) -> Vec<f32> {
        let pos = self.rover.get_left_camera_position();
        vec![pos.x, pos.y, pos.z]
    }
    
    /// Get right stereo camera position as [x, y, z]
    #[wasm_bindgen]
    pub fn get_right_camera_position(&self) -> Vec<f32> {
        let pos = self.rover.get_right_camera_position();
        vec![pos.x, pos.y, pos.z]
    }
    
    /// Get view-projection matrix for left stereo camera
    /// 
    /// Returns 16 floats representing a 4x4 matrix in column-major order
    #[wasm_bindgen]
    pub fn get_left_view_projection_matrix(&self, aspect_ratio: f32) -> Vec<f32> {
        let matrix = self.rover.get_left_view_projection_matrix(aspect_ratio);
        let data: &[f32; 16] = matrix.as_ref();
        data.to_vec()
    }
    
    /// Get view-projection matrix for right stereo camera
    /// 
    /// Returns 16 floats representing a 4x4 matrix in column-major order
    #[wasm_bindgen]
    pub fn get_right_view_projection_matrix(&self, aspect_ratio: f32) -> Vec<f32> {
        let matrix = self.rover.get_right_view_projection_matrix(aspect_ratio);
        let data: &[f32; 16] = matrix.as_ref();
        data.to_vec()
    }
}

#[cfg(target_arch = "wasm32")]
impl Default for RoverHandle {
    fn default() -> Self {
        Self::new()
    }
}
