//! Rendering logic - frame rendering and draw calls
//!
//! Handles per-frame operations: acquiring textures, encoding commands, submitting to GPU.
//! WebGPU initialization is delegated to `webgpu_context`.

use wgpu;
use wgpu::util::DeviceExt;
use crate::constants;
use crate::webgpu_context::WebGpuContext;
use crate::mesh_gpu::MeshGPU;
use crate::camera::Camera;
use crate::light::DirectionalLight;
use std::collections::HashMap;
use glam::{Vec3, Mat4};

// Desktop-specific imports
#[cfg(not(target_arch = "wasm32"))]
use std::sync::Arc;

/// Render mode flags (can be combined)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RenderModeFlags {
    pub solid: bool,
    pub wireframe: bool,
    pub vertices: bool,
}

impl RenderModeFlags {
    /// Default mode: solid only
    pub fn solid_only() -> Self {
        Self {
            solid: true,
            wireframe: false,
            vertices: false,
        }
    }
    
    /// All modes enabled
    pub fn all() -> Self {
        Self {
            solid: true,
            wireframe: true,
            vertices: true,
        }
    }
}

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
    light_uniform_buffer: wgpu::Buffer,
    view_bind_group: wgpu::BindGroup,
    meshes: HashMap<String, MeshEntry>,
    camera: Camera,
    light: DirectionalLight,
    aspect_ratio: f32,
}

impl Renderer {
    /// Create renderer from a canvas element (WASM only)
    #[cfg(target_arch = "wasm32")]
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
        let context = WebGpuContext::new(canvas).await?;
        
        // Create camera
        let camera = Camera::new();
        let aspect_ratio = context.size.0 as f32 / context.size.1 as f32;
        
        // Create default lighting (sun slightly angled from above-left-front)
        let light = DirectionalLight::default_sun();
        
        // Create uniform buffer for view-projection matrix
        let view_proj_matrix = camera.view_projection_matrix(aspect_ratio);
        let view_uniform_buffer = Self::create_view_uniform_buffer(&context.device, &view_proj_matrix);
        
        // Create uniform buffer for light
        let light_uniform_buffer = Self::create_light_uniform_buffer(&context.device, &light);
        
        // Create bind group layout
        let bind_group_layout = Self::create_bind_group_layout(&context.device);
        
        // Create bind group
        let view_bind_group = Self::create_bind_group(&context.device, &bind_group_layout, &view_uniform_buffer, &light_uniform_buffer);
        
        // Create empty mesh collection
        let meshes = HashMap::new();
        
        Ok(Self { 
            context,
            view_uniform_buffer,
            light_uniform_buffer,
            view_bind_group,
            meshes,
            camera,
            light,
            aspect_ratio,
        })
    }

    /// Create renderer from a winit window (Desktop only)
    #[cfg(not(target_arch = "wasm32"))]
    pub async fn new_native(window: Arc<winit::window::Window>) -> Result<Self, String> {
        let context = WebGpuContext::new_native(window).await?;
        
        // Create camera
        let camera = Camera::new();
        let aspect_ratio = context.size.0 as f32 / context.size.1 as f32;
        
        // Create default lighting (sun slightly angled from above-left-front)
        let light = DirectionalLight::default_sun();
        
        // Create uniform buffer for view-projection matrix
        let view_proj_matrix = camera.view_projection_matrix(aspect_ratio);
        let view_uniform_buffer = Self::create_view_uniform_buffer(&context.device, &view_proj_matrix);
        
        // Create uniform buffer for light
        let light_uniform_buffer = Self::create_light_uniform_buffer(&context.device, &light);
        
        // Create bind group layout
        let bind_group_layout = Self::create_bind_group_layout(&context.device);
        
        // Create bind group
        let view_bind_group = Self::create_bind_group(&context.device, &bind_group_layout, &view_uniform_buffer, &light_uniform_buffer);
        
        // Create empty mesh collection
        let meshes = HashMap::new();
        
        Ok(Self { 
            context,
            view_uniform_buffer,
            light_uniform_buffer,
            view_bind_group,
            meshes,
            camera,
            light,
            aspect_ratio,
        })
    }

    /// Create bind group layout for view uniforms and lighting
    fn create_bind_group_layout(device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("View & Light Bind Group Layout"),
            entries: &[
                // Binding 0: View-Projection matrix (vertex shader)
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Binding 1: Directional light (fragment shader)
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        })
    }

    /// Create uniform buffer with initial view-projection matrix
    fn create_view_uniform_buffer(device: &wgpu::Device, view_proj_matrix: &glam::Mat4) -> wgpu::Buffer {
        use wgpu::util::DeviceExt;
        
        // Convert Mat4 to array of 16 f32 values
        let matrix_data: &[f32; 16] = view_proj_matrix.as_ref();
        
        device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("View Uniform Buffer"),
            contents: bytemuck::cast_slice(matrix_data),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        })
    }
    
    /// Create uniform buffer for directional light
    fn create_light_uniform_buffer(device: &wgpu::Device, light: &DirectionalLight) -> wgpu::Buffer {
        use wgpu::util::DeviceExt;
        
        device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Light Uniform Buffer"),
            contents: bytemuck::cast_slice(&[*light]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        })
    }

    /// Create bind group
    fn create_bind_group(
        device: &wgpu::Device,
        layout: &wgpu::BindGroupLayout,
        view_buffer: &wgpu::Buffer,
        light_buffer: &wgpu::Buffer,
    ) -> wgpu::BindGroup {
        device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("View & Light Bind Group"),
            layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: view_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: light_buffer.as_entire_binding(),
                },
            ],
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
    pub fn render(&mut self, pipeline: &wgpu::RenderPipeline) -> Result<(), String> {
        // Update view-projection matrix uniform
        let view_proj_matrix = self.camera.view_projection_matrix(self.aspect_ratio);
        let matrix_data: &[f32; 16] = view_proj_matrix.as_ref();
        self.context.queue.write_buffer(
            &self.view_uniform_buffer,
            0,
            bytemuck::cast_slice(matrix_data),
        );
        
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
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.context.depth_texture_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0), // Clear to max depth (far plane)
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
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

    /// Render with multiple passes (solid, wireframe, vertices)
    pub fn render_multi_pass(
        &mut self,
        solid_pipeline: &wgpu::RenderPipeline,
        wireframe_pipeline: &wgpu::RenderPipeline,
        vertices_pipeline: &wgpu::RenderPipeline,
        modes: &RenderModeFlags,
    ) -> Result<(), String> {
        // Update view-projection matrix uniform
        let view_proj_matrix = self.camera.view_projection_matrix(self.aspect_ratio);
        let matrix_data: &[f32; 16] = view_proj_matrix.as_ref();
        self.context.queue.write_buffer(
            &self.view_uniform_buffer,
            0,
            bytemuck::cast_slice(matrix_data),
        );
        
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

        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self.context.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Multi-Pass Render Encoder"),
        });

        // If no render modes are active, just clear the screen to white
        if !modes.solid && !modes.wireframe && !modes.vertices {
            let _render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Clear Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(constants::CLEAR_COLOR),
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.context.depth_texture_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });
            // Render pass drops here, automatically ending it
        }

        // Pass 1: Solid rendering
        if modes.solid {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Solid Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(constants::CLEAR_COLOR),
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.context.depth_texture_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });

            render_pass.set_pipeline(solid_pipeline);
            render_pass.set_bind_group(0, &self.view_bind_group, &[]);
            
            for entry in self.meshes.values().filter(|e| e.visible) {
                render_pass.set_vertex_buffer(0, entry.gpu_mesh.vertex_buffer.slice(..));
                render_pass.set_index_buffer(entry.gpu_mesh.index_buffer.slice(..), wgpu::IndexFormat::Uint32);
                render_pass.draw_indexed(0..entry.gpu_mesh.index_count, 0, 0..1);
            }
        }

        // Pass 2: Wireframe rendering
        if modes.wireframe {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Wireframe Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: if modes.solid { wgpu::LoadOp::Load } else { wgpu::LoadOp::Clear(constants::CLEAR_COLOR) },
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.context.depth_texture_view,
                    depth_ops: Some(wgpu::Operations {
                        load: if modes.solid { wgpu::LoadOp::Load } else { wgpu::LoadOp::Clear(1.0) },
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });

            render_pass.set_pipeline(wireframe_pipeline);
            render_pass.set_bind_group(0, &self.view_bind_group, &[]);
            
            // Draw edges for each mesh
            for entry in self.meshes.values().filter(|e| e.visible) {
                // Extract edges from faces - each triangle has 3 edges
                let edges = self.extract_edges(&entry.cpu_mesh);
                if !edges.is_empty() {
                    // Create temporary edge buffer
                    let edge_buffer = self.context.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("Wireframe Edge Buffer"),
                        contents: bytemuck::cast_slice(&edges),
                        usage: wgpu::BufferUsages::VERTEX,
                    });
                    
                    render_pass.set_vertex_buffer(0, edge_buffer.slice(..));
                    render_pass.draw(0..(edges.len() as u32), 0..1);
                }
            }
        }

        // Pass 3: Vertices rendering
        if modes.vertices {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Vertices Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: if modes.solid || modes.wireframe { wgpu::LoadOp::Load } else { wgpu::LoadOp::Clear(constants::CLEAR_COLOR) },
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.context.depth_texture_view,
                    depth_ops: Some(wgpu::Operations {
                        load: if modes.solid || modes.wireframe { wgpu::LoadOp::Load } else { wgpu::LoadOp::Clear(1.0) },
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                occlusion_query_set: None,
                timestamp_writes: None,
                multiview_mask: None,
            });

            render_pass.set_pipeline(vertices_pipeline);
            render_pass.set_bind_group(0, &self.view_bind_group, &[]);
            
            // Draw vertices for each mesh
            for entry in self.meshes.values().filter(|e| e.visible) {
                // Extract positions only
                let positions: Vec<[f32; 3]> = entry.cpu_mesh.vertices.iter()
                    .map(|v| [v.position.x, v.position.y, v.position.z])
                    .collect();
                
                if !positions.is_empty() {
                    let vertex_buffer = self.context.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("Vertices Point Buffer"),
                        contents: bytemuck::cast_slice(&positions),
                        usage: wgpu::BufferUsages::VERTEX,
                    });
                    
                    render_pass.set_vertex_buffer(0, vertex_buffer.slice(..));
                    render_pass.draw(0..(positions.len() as u32), 0..1);
                }
            }
        }

        // Submit commands
        self.context.queue.submit(std::iter::once(encoder.finish()));
        output.present();

        Ok(())
    }

    /// Extract edges from mesh faces for wireframe rendering
    fn extract_edges(&self, mesh: &polylab_core::Mesh) -> Vec<[f32; 3]> {
        let mut edges = Vec::new();
        
        for face in &mesh.faces {
            let len = face.vertices.len();
            for i in 0..len {
                let v1 = &mesh.vertices[face.vertices[i]];
                let v2 = &mesh.vertices[face.vertices[(i + 1) % len]];
                
                // Add edge as two vertices (start, end)
                edges.push([v1.position.x, v1.position.y, v1.position.z]);
                edges.push([v2.position.x, v2.position.y, v2.position.z]);
            }
        }
        
        edges
    }

    /// Resize the surface (e.g., when browser window changes)
    pub fn resize(&mut self, new_width: u32, new_height: u32) {
        self.context.resize(new_width, new_height);
        
        // Update aspect ratio
        self.aspect_ratio = new_width as f32 / new_height as f32;
        // View-projection matrix will be updated on next render() call
    }
    
    // ========================
    // Camera Control Methods
    // ========================
    
    /// Move camera forward/backward (positive = forward)
    pub fn camera_move_forward(&mut self, delta: f32) {
        self.camera.move_forward(delta);
    }
    
    /// Move camera right/left (positive = right)
    pub fn camera_move_right(&mut self, delta: f32) {
        self.camera.move_right(delta);
    }
    
    /// Move camera up/down (positive = up)
    pub fn camera_move_up(&mut self, delta: f32) {
        self.camera.move_up(delta);
    }
    
    /// Rotate camera yaw (left/right) in radians
    pub fn camera_rotate_yaw(&mut self, delta: f32) {
        self.camera.rotate_yaw(delta);
    }
    
    /// Rotate camera pitch (up/down) in radians
    pub fn camera_rotate_pitch(&mut self, delta: f32) {
        self.camera.rotate_pitch(delta);
    }
    
    /// Set camera position
    pub fn camera_set_position(&mut self, x: f32, y: f32, z: f32) {
        self.camera.set_position(glam::Vec3::new(x, y, z));
    }
    
    /// Get camera position
    pub fn camera_position(&self) -> (f32, f32, f32) {
        let pos = self.camera.position();
        (pos.x, pos.y, pos.z)
    }
    
    /// Get camera yaw (rotation around Y axis) in radians
    pub fn camera_get_yaw(&self) -> f32 {
        self.camera.yaw()
    }
    
    /// Get camera pitch (rotation around X axis) in radians
    pub fn camera_get_pitch(&self) -> f32 {
        self.camera.pitch()
    }
    
    /// Set camera yaw (rotation around Y axis) in radians
    pub fn camera_set_yaw(&mut self, yaw: f32) {
        self.camera.set_yaw(yaw);
    }
    
    /// Set camera pitch (rotation around X axis) in radians
    pub fn camera_set_pitch(&mut self, pitch: f32) {
        self.camera.set_pitch(pitch);
    }
    
    /// Set orbital rotation target
    pub fn camera_set_orbit_target(&mut self, x: f32, y: f32, z: f32) {
        self.camera.set_orbit_target(glam::Vec3::new(x, y, z));
    }
    
    /// Get orbital rotation target
    pub fn camera_orbit_target(&self) -> (f32, f32, f32) {
        let target = self.camera.orbit_target();
        (target.x, target.y, target.z)
    }
    
    /// Orbit camera around target point
    pub fn camera_orbit_around(&mut self, delta_yaw: f32, delta_pitch: f32) {
        self.camera.orbit_around(delta_yaw, delta_pitch);
    }
    
    /// Reset camera to default position and orientation
    ///
    /// Sets camera to (0, 0, 10) looking at origin with default angles.
    /// Useful for "reset view" button functionality.
    pub fn camera_reset(&mut self) {
        self.camera.set_position(Vec3::new(0.0, 0.0, 10.0));
        self.camera.set_yaw(0.0);
        self.camera.set_pitch(0.0);
        self.camera.set_orbit_target(Vec3::ZERO);
    }
    
    /// Center camera on all visible meshes in the scene
    ///
    /// Calculates bounding box of all visible meshes, positions camera to view them all,
    /// and sets orbit target to the center. Returns true if successful, false if no visible meshes.
    pub fn camera_center_on_meshes(&mut self) -> bool {
        // Collect bounding boxes of all visible meshes
        let mut global_min = None;
        let mut global_max = None;
        
        for entry in self.meshes.values() {
            if !entry.visible {
                continue;
            }
            
            if let Some((mesh_min, mesh_max)) = entry.cpu_mesh.bounding_box() {
                match (global_min, global_max) {
                    (None, None) => {
                        global_min = Some(mesh_min);
                        global_max = Some(mesh_max);
                    }
                    (Some(gmin), Some(gmax)) => {
                        global_min = Some(gmin.min(mesh_min));
                        global_max = Some(gmax.max(mesh_max));
                    }
                    _ => unreachable!(),
                }
            }
        }
        
        // If no visible meshes, do nothing
        let (min, max) = match (global_min, global_max) {
            (Some(min), Some(max)) => (min, max),
            _ => return false,
        };
        
        // Calculate center and size of bounding box
        let center = (min + max) * 0.5;
        let size = max - min;
        let max_dimension = size.x.max(size.y).max(size.z);
        
        // Position camera at a distance to view entire bounding box
        // Use FOV to calculate required distance
        let fov_rad = self.camera.fov.to_radians();
        let distance = (max_dimension * 0.5) / (fov_rad * 0.5).tan() * 1.5; // 1.5 for margin
        
        // Place camera in front of center, looking at it
        let new_position = center + Vec3::new(0.0, 0.0, distance);
        
        self.camera.set_position(new_position);
        self.camera.set_orbit_target(center);
        self.camera.set_yaw(0.0);
        self.camera.set_pitch(0.0);
        
        true
    }
    
    /// Render a frame with a custom view-projection matrix
    ///
    /// Similar to render() but uses the provided view-projection matrix
    /// instead of computing it from the main camera.
    /// This allows rendering multiple views (e.g., stereo) with different camera parameters.
    pub fn render_with_view_projection(&mut self, pipeline: &wgpu::RenderPipeline, view_proj_matrix: Mat4) -> Result<(), String> {
        // Update view-projection matrix uniform with custom matrix
        let matrix_data: &[f32; 16] = view_proj_matrix.as_ref();
        self.context.queue.write_buffer(
            &self.view_uniform_buffer,
            0,
            bytemuck::cast_slice(matrix_data),
        );
        
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
                label: Some("Stereo Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(constants::CLEAR_COLOR),
                        store: wgpu::StoreOp::Store,
                    },
                    depth_slice: None,
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.context.depth_texture_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0), // Clear to max depth (far plane)
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
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
    
    /// Export current scene to PolyLab Scene (.pls) format
    ///
    /// Collects all visible meshes, camera, and light into a Scene structure
    /// and exports as a ZIP archive containing OBJ files and JSON metadata.
    ///
    /// # Returns
    /// ZIP file bytes ready for download
    ///
    /// # Errors
    /// Returns error if export fails (e.g., ZIP creation error)
    pub fn export_scene(&self, scene_name: String) -> Result<Vec<u8>, String> {
        use polylab_core::{Scene, Camera as SceneCamera, Light as SceneLight};
        
        // Create scene
        let mut scene = Scene::new(scene_name);
        
        // Convert camera
        let camera_pos = self.camera.position();
        let camera_target = self.camera.orbit_target();
        scene.camera = SceneCamera {
            position: camera_pos,
            target: camera_target,
            fov: self.camera.fov,
            near: self.camera.near,
            far: self.camera.far,
        };
        
        // Convert light
        scene.light = SceneLight {
            direction: self.light.direction,
            color: self.light.color,
            intensity: self.light.intensity,
        };
        
        // Add all visible meshes
        for (id, entry) in &self.meshes {
            if entry.visible {
                scene.add_mesh(
                    id.clone(),
                    id.clone(), // Use ID as name for now
                    entry.cpu_mesh.clone()
                );
            }
        }
        
        // Export to PLS format
        scene.export_to_pls()
    }
}

// ========================
// Utility Functions
// ========================

/// Create a view-projection matrix from camera parameters
///
/// This is a standalone utility function that can be used to calculate
/// view-projection matrices without creating a Camera object.
/// Useful for external systems (e.g., rover, NPCs) that need camera matrices.
///
/// # Parameters
/// * `eye_position` - Camera position in world space
/// * `yaw` - Horizontal rotation in radians (Y-axis). 0 = looking towards -Z
/// * `pitch` - Vertical rotation in radians (X-axis). Positive = looking up
/// * `aspect_ratio` - Width / height ratio of the viewport
///
/// # Returns
/// A 4x4 view-projection matrix combining view and perspective transforms
///
/// # Example
/// ```
/// use glam::Vec3;
/// use polylab_viewer::create_view_projection_matrix;
///
/// let eye_pos = Vec3::new(0.0, 1.0, -5.0);
/// let yaw = 0.0;  // Looking towards -Z
/// let pitch = 0.0; // Level (no tilt)
/// let aspect = 16.0 / 9.0;
///
/// let matrix = create_view_projection_matrix(eye_pos, yaw, pitch, aspect);
/// ```
pub fn create_view_projection_matrix(
    eye_position: Vec3,
    yaw: f32,
    pitch: f32,
    aspect_ratio: f32,
) -> Mat4 {
    // Create a temporary camera with the given parameters
    let mut camera = Camera::new();
    camera.set_position(eye_position);
    camera.set_yaw(yaw);
    camera.set_pitch(pitch);
    
    // Return the view-projection matrix
    camera.view_projection_matrix(aspect_ratio)
}
