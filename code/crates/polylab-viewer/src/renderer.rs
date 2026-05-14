//! Rendering logic - frame rendering and draw calls
//!
//! Handles per-frame operations: acquiring textures, encoding commands, submitting to GPU.
//! WebGPU initialization is delegated to `webgpu_context`.

use wgpu;
use crate::constants;
use crate::webgpu_context::WebGpuContext;
use crate::mesh_gpu::MeshGPU;

// Desktop-specific imports
#[cfg(not(target_arch = "wasm32"))]
use std::sync::Arc;

/// High-level renderer - wraps WebGpuContext and executes render operations
///
/// Separates "what to render" (render logic) from "how to setup GPU" (context).
/// Holds a reference to the WebGPU context and manages per-frame rendering.
pub struct Renderer {
    context: WebGpuContext,
    view_uniform_buffer: wgpu::Buffer,
    view_bind_group: wgpu::BindGroup,
    current_mesh: MeshGPU,
}

impl Renderer {
    /// Create renderer from a canvas element (WASM only)
    #[cfg(target_arch = "wasm32")]
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
        let context = WebGpuContext::new(canvas).await?;
        
        // Create uniform buffer for aspect ratio
        let aspect_ratio = context.size.0 as f32 / context.size.1 as f32;
        let view_uniform_buffer = Self::create_view_uniform_buffer(&context.device, aspect_ratio);
        
        // Create bind group layout
        let bind_group_layout = Self::create_bind_group_layout(&context.device);
        
        // Create bind group
        let view_bind_group = Self::create_bind_group(&context.device, &bind_group_layout, &view_uniform_buffer);
        
        // Create default triangle mesh
        let current_mesh = MeshGPU::default_triangle(&context.device);
        
        Ok(Self { 
            context,
            view_uniform_buffer,
            view_bind_group,
            current_mesh,
        })
    }

    /// Create renderer from a winit window (Desktop only)
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn new_native(window: Arc<winit::window::Window>) -> Result<Self, String> {
        let context = WebGpuContext::new_native(window).await?;
        
        // Create uniform buffer for aspect ratio
        let aspect_ratio = context.size.0 as f32 / context.size.1 as f32;
        let view_uniform_buffer = Self::create_view_uniform_buffer(&context.device, aspect_ratio);
        
        // Create bind group layout
        let bind_group_layout = Self::create_bind_group_layout(&context.device);
        
        // Create bind group
        let view_bind_group = Self::create_bind_group(&context.device, &bind_group_layout, &view_uniform_buffer);
        
        // Create default triangle mesh
        let current_mesh = MeshGPU::default_triangle(&context.device);
        
        Ok(Self { 
            context,
            view_uniform_buffer,
            view_bind_group,
            current_mesh,
        })
    }

    /// Create bind group layout for view uniforms
    fn create_bind_group_layout(device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("View Bind Group Layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        })
    }

    /// Create uniform buffer with initial aspect ratio
    fn create_view_uniform_buffer(device: &wgpu::Device, aspect_ratio: f32) -> wgpu::Buffer {
        use wgpu::util::DeviceExt;
        
        device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("View Uniform Buffer"),
            contents: bytemuck::cast_slice(&[aspect_ratio]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        })
    }

    /// Create bind group
    fn create_bind_group(
        device: &wgpu::Device,
        layout: &wgpu::BindGroupLayout,
        buffer: &wgpu::Buffer,
    ) -> wgpu::BindGroup {
        device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("View Bind Group"),
            layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: buffer.as_entire_binding(),
            }],
        })
    }

    /// Get bind group layout (needed for pipeline creation)
    pub fn bind_group_layout(&self) -> wgpu::BindGroupLayout {
        Self::create_bind_group_layout(&self.context.device)
    }

    /// Get device reference (for creating pipelines, buffers, etc.)
    pub fn device(&self) -> &wgpu::Device {
        &self.context.device
    }

    /// Get surface format (needed for pipeline creation)
    pub fn surface_format(&self) -> wgpu::TextureFormat {
        self.context.config.format
    }

    /// Replace the current mesh with a new one
    ///
    /// Creates GPU buffers from the provided mesh and replaces the current mesh.
    /// Call this after parsing an OBJ file to display the loaded mesh.
    pub fn set_mesh(&mut self, mesh: polylab_core::Mesh) {
        self.current_mesh = MeshGPU::from_mesh(&self.context.device, &mesh);
    }

    /// Get the current mesh vertex and triangle counts
    ///
    /// Returns (vertex_count, triangle_count) for display in UI.
    pub fn mesh_info(&self) -> (u32, u32) {
        let vertex_count = (self.current_mesh.vertex_buffer.size() / 12) as u32; // 12 bytes per vertex (3 f32)
        let triangle_count = self.current_mesh.index_count / 3;
        (vertex_count, triangle_count)
    }

    /// Render a frame using the given pipeline
    ///
    /// Acquires surface texture → creates command encoder → records render pass → submits to GPU.
    /// Returns error if surface is lost/outdated (needs resize) or validation fails.
    pub fn render(&self, pipeline: &wgpu::RenderPipeline) -> Result<(), String> {
        // Acquire next frame from swapchain
        let output = match self.context.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(frame) => frame,
            wgpu::CurrentSurfaceTexture::Suboptimal(frame) => frame,
            wgpu::CurrentSurfaceTexture::Timeout | wgpu::CurrentSurfaceTexture::Occluded => {
                return Ok(()); // Skip frame if surface unavailable
            }
            wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                return Err("Surface lost - call resize()".to_string());
            }
            wgpu::CurrentSurfaceTexture::Validation => {
                return Err("Surface validation error".to_string());
            }
        };

        // Create texture view for rendering
        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        // Create command encoder - records GPU commands
        let mut encoder = self
            .context
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        // Record render pass (clear + draw)
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Main Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(constants::CLEAR_COLOR),
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });

            render_pass.set_pipeline(pipeline);
            render_pass.set_bind_group(0, &self.view_bind_group, &[]);
            render_pass.set_vertex_buffer(0, self.current_mesh.vertex_buffer.slice(..));
            render_pass.set_index_buffer(self.current_mesh.index_buffer.slice(..), wgpu::IndexFormat::Uint32);
            render_pass.draw_indexed(0..self.current_mesh.index_count, 0, 0..1);
        }

        // Submit commands to GPU
        self.context.queue.submit(std::iter::once(encoder.finish()));
        
        // Present frame to screen
        output.present();

        Ok(())
    }

    /// Resize the surface (e.g., when browser window changes)
    pub fn resize(&mut self, new_width: u32, new_height: u32) {
        self.context.resize(new_width, new_height);
        
        // Update aspect ratio uniform
        let aspect_ratio = new_width as f32 / new_height as f32;
        self.context.queue.write_buffer(
            &self.view_uniform_buffer,
            0,
            bytemuck::cast_slice(&[aspect_ratio]),
        );
    }
}
