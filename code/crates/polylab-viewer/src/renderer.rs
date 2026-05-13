//! Rendering logic - frame rendering and draw calls
//!
//! Handles per-frame operations: acquiring textures, encoding commands, submitting to GPU.
//! WebGPU initialization is delegated to `webgpu_context`.

use wgpu;
use crate::constants;
use crate::webgpu_context::WebGpuContext;

/// High-level renderer - wraps WebGpuContext and executes render operations
///
/// Separates "what to render" (render logic) from "how to setup GPU" (context).
/// Holds a reference to the WebGPU context and manages per-frame rendering.
pub struct Renderer {
    context: WebGpuContext,
}

impl Renderer {
    /// Create renderer from a canvas element
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
        let context = WebGpuContext::new(canvas).await?;
        Ok(Self { context })
    }

    /// Get device reference (for creating pipelines, buffers, etc.)
    pub fn device(&self) -> &wgpu::Device {
        &self.context.device
    }

    /// Get surface format (needed for pipeline creation)
    pub fn surface_format(&self) -> wgpu::TextureFormat {
        self.context.config.format
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
            render_pass.draw(
                0..constants::TRIANGLE_VERTEX_COUNT,
                0..constants::INSTANCE_COUNT,
            );
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
    }
}
