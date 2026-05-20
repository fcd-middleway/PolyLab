//! Rendering constants and configuration values

use wgpu;

/// Background clear color (white for better contrast)
pub const CLEAR_COLOR: wgpu::Color = wgpu::Color {
    r: 1.0,
    g: 1.0,
    b: 1.0,
    a: 1.0,
};

/// Desired frame latency (frames in flight)
pub const FRAME_LATENCY: u32 = 2;
