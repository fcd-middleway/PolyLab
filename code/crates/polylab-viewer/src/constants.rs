//! Rendering constants and configuration values

use wgpu;

/// Background clear color (dark gray)
pub const CLEAR_COLOR: wgpu::Color = wgpu::Color {
    r: 0.1,
    g: 0.1,
    b: 0.1,
    a: 1.0,
};

/// Number of vertices in the demo triangle
pub const TRIANGLE_VERTEX_COUNT: u32 = 3;

/// Number of instances to draw
pub const INSTANCE_COUNT: u32 = 1;

/// Desired frame latency (frames in flight)
pub const FRAME_LATENCY: u32 = 2;
