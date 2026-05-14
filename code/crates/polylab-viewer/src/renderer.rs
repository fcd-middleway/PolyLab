//! Rendering logic - frame rendering and draw calls
//!
//! Handles per-frame operations: acquiring textures, encoding commands, submitting to GPU.
//! WebGPU initialization is delegated to `webgpu_context`.

use wgpu;
use crate::constants;
use crate::webgpu_context::WebGpuContext;
use crate::mesh_gpu::MeshGPU;
use std::collections::HashMap;

// Desktop-specific imports
#[cfg(not(target_arch = "wasm32"))]
use std::sync::Arc;

/// A single mesh entry in the scene
struct MeshEntry {
    gpu_mesh: MeshGPU,
    cpu_mesh: polylab_core::Mesh,
    visible: bool,
}

/// High-level renderer - wraps WebGpuContext and executes render operations
///
/// Separates "what to render" (render logic) from "how to setup GPU" (context).
/// Holds a reference to the WebGPU context and manages per-frame rendering.
pub struct Renderer {
    context: WebGpuContext,
    view_uniform_buffer: wgpu::Buffer,
    view_bind_group: wgpu::BindGroup,
    meshes: HashMap<String, MeshEntry>,
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
        
        // Create empty mesh collection
        let mut meshes = HashMap::new();
        
        // Add default triangle mesh
        let default_mesh = Self::create_default_triangle_mesh();
        let default_gpu = MeshGPU::from_mesh(&context.device, &default_mesh);
        meshes.insert("__default__".to_string(), MeshEntry {
            gpu_mesh: default_gpu,
            cpu_mesh: default_mesh,
            visible: true,
        });
        
        Ok(Self { 
            context,
            view_uniform_buffer,
            view_bind_group,
            meshes,
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
        
        // Create empty mesh collection
        let mut meshes = HashMap::new();
        
        // Add default triangle mesh
        let default_mesh = Self::create_default_triangle_mesh();
        let default_gpu = MeshGPU::from_mesh(&context.device, &default_mesh);
        meshes.insert("__default__".to_string(), MeshEntry {
            gpu_mesh: default_gpu,
            cpu_mesh: default_mesh,
            visible: true,
        });
        
        Ok(Self { 
            context,
            view_uniform_buffer,
            view_bind_group,
            meshes,
        })
    }

    /// Create a default triangle mesh (CPU representation)
    fn create_default_triangle_mesh() -> polylab_core::Mesh {
        use polylab_core::{Mesh, Vertex};
        use glam::Vec3;
        
        let mut mesh = Mesh::new();
        
        // Triangle vertices
        mesh.vertices.push(Vertex {
            position: Vec3::new(0.0, 0.5, 0.0),
            normal: None,
            tex_coords: None,
        });
        mesh.vertices.push(Vertex {
            position: Vec3::new(-0.5, -0.5, 0.0),
            normal: None,
            tex_coords: None,
        });
        mesh.vertices.push(Vertex {
            position: Vec3::new(0.5, -0.5, 0.0),
            normal: None,
            tex_coords: None,
        });
        
        // Single face
        mesh.faces.push(polylab_core::Face {
            vertices: [0, 1, 2],
        });
        
        mesh
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

    /// Add or replace a mesh in the scene
    ///
    /// Creates GPU buffers from the provided mesh and adds it to the scene.
    /// If a mesh with the same ID already exists, it will be replaced.
    /// Call this after parsing an OBJ file to display the loaded mesh.
    pub fn add_mesh(&mut self, id: String, mesh: polylab_core::Mesh) {
        let gpu_mesh = MeshGPU::from_mesh(&self.context.device, &mesh);
        self.meshes.insert(id, MeshEntry {
            gpu_mesh,
            cpu_mesh: mesh,
            visible: true,
        });
    }

    /// Set the visibility of a mesh
    pub fn set_mesh_visibility(&mut self, id: &str, visible: bool) {
        if let Some(entry) = self.meshes.get_mut(id) {
            entry.visible = visible;
        }
    }

    /// Remove a mesh from the scene
    pub fn remove_mesh(&mut self, id: &str) {
        self.meshes.remove(id);
    }

    /// Get the total vertex and triangle count across all visible meshes
    ///
    /// Returns (vertex_count, triangle_count) for display in UI.
    pub fn mesh_info(&self) -> (u32, u32) {
        self.meshes.values()
            .filter(|entry| entry.visible)
            .fold((0, 0), |(v, t), entry| {
                let vc = (entry.gpu_mesh.vertex_buffer.size() / 12) as u32;
                let tc = entry.gpu_mesh.index_count / 3;
                (v + vc, t + tc)
            })
    }

    /// Get detailed mesh information for a specific mesh or the first visible mesh
    ///
    /// Returns (vertices, triangles, size_x, size_y, size_z)
    /// Size values are 0.0 if no mesh is loaded or dimensions cannot be calculated.
    pub fn mesh_details(&self, id: Option<&str>) -> (u32, u32, f32, f32, f32) {
        let entry = if let Some(id) = id {
            self.meshes.get(id)
        } else {
            // Get first visible mesh or default mesh
            self.meshes.values()
                .find(|e| e.visible)
        };

        if let Some(entry) = entry {
            let vertices = (entry.gpu_mesh.vertex_buffer.size() / 12) as u32;
            let triangles = entry.gpu_mesh.index_count / 3;
            let (size_x, size_y, size_z) = entry.cpu_mesh.dimensions().unwrap_or((0.0, 0.0, 0.0));
            (vertices, triangles, size_x, size_y, size_z)
        } else {
            (0, 0, 0.0, 0.0, 0.0)
        }
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
            
            // Draw all visible meshes
            for entry in self.meshes.values().filter(|e| e.visible) {
                render_pass.set_vertex_buffer(0, entry.gpu_mesh.vertex_buffer.slice(..));
                render_pass.set_index_buffer(entry.gpu_mesh.index_buffer.slice(..), wgpu::IndexFormat::Uint32);
                render_pass.draw_indexed(0..entry.gpu_mesh.index_count, 0, 0..1);
            }
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
