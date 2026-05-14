//! Rendering constants and configuration values

use wgpu;

/// Background clear color (dark gray)
pub const CLEAR_COLOR: wgpu::Color = wgpu::Color {
    r: 0.1,
    g: 0.1,
    b: 0.1,
    a: 1.0,
};

/// Desired frame latency (frames in flight)
pub const FRAME_LATENCY: u32 = 2;
