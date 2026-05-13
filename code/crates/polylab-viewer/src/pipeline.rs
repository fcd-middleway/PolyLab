//! Render pipeline creation
//!
//! Configures shaders, vertex layout, rasterization, and blending.
//! Pipeline is compiled once at startup and reused for all frames.

use wgpu;

/// Create the render pipeline for drawing the triangle
///
/// Pipeline defines: shaders, vertex format, primitive type, blending.
/// Immutable after creation - changing requires rebuilding.
pub fn create_render_pipeline(
    device: &wgpu::Device,
    format: wgpu::TextureFormat,
) -> wgpu::RenderPipeline {
    // Shader module - compiled WGSL code
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("Triangle Shader"),
        source: wgpu::ShaderSource::Wgsl(include_str!("shaders.wgsl").into()),
    });

    // Pipeline layout - defines bind groups (uniforms, textures)
    // Empty for now - triangle positions hardcoded in shader
    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some("Render Pipeline Layout"),
        bind_group_layouts: &[],
        immediate_size: 0,
    });

    // Create render pipeline
    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some("Render Pipeline"),
        layout: Some(&pipeline_layout),
        
        // Vertex stage - transforms vertices
        vertex: wgpu::VertexState {
            module: &shader,
            entry_point: Some("vs_main"),
            buffers: &[], // No vertex buffers - positions in shader
            compilation_options: wgpu::PipelineCompilationOptions::default(),
        },
        
        // Fragment stage - colors pixels
        fragment: Some(wgpu::FragmentState {
            module: &shader,
            entry_point: Some("fs_main"),
            targets: &[Some(wgpu::ColorTargetState {
                format,
                blend: Some(wgpu::BlendState::REPLACE),
                write_mask: wgpu::ColorWrites::ALL,
            })],
            compilation_options: wgpu::PipelineCompilationOptions::default(),
        }),
        
        // Primitive assembly - how to interpret vertices
        primitive: wgpu::PrimitiveState {
            topology: wgpu::PrimitiveTopology::TriangleList,
            strip_index_format: None,
            front_face: wgpu::FrontFace::Ccw, // Counter-clockwise
            cull_mode: None, // Disabled for debug - see both sides
            polygon_mode: wgpu::PolygonMode::Fill,
            unclipped_depth: false,
            conservative: false,
        },
        depth_stencil: None,
        multisample: wgpu::MultisampleState {
            count: 1,
            mask: !0,
            alpha_to_coverage_enabled: false,
        },
        multiview_mask: None,
        cache: None,
    })
}
