//! GPU mesh representation - vertex and index buffers
//!
//! Converts CPU mesh data (polylab-core::Mesh) to GPU buffers for rendering.

use wgpu;
use wgpu::util::DeviceExt;
use polylab_core::Mesh;

/// Vertex format for GPU rendering (position + color + normal)
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GpuVertex {
    pub position: [f32; 3],
    pub color: [f32; 3],  // RGB color
    pub normal: [f32; 3], // Normal vector for lighting
}

impl GpuVertex {
    /// Vertex buffer layout descriptor for pipeline creation
    pub fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<GpuVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                // Position attribute (location = 0)
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x3,
                },
                // Color attribute (location = 1)
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x3,
                },
                // Normal attribute (location = 2)
                wgpu::VertexAttribute {
                    offset: (std::mem::size_of::<[f32; 3]>() * 2) as wgpu::BufferAddress,
                    shader_location: 2,
                    format: wgpu::VertexFormat::Float32x3,
                },
            ],
        }
    }
}

/// GPU representation of a mesh - holds vertex and index buffers
pub struct MeshGPU {
    pub vertex_buffer: wgpu::Buffer,
    pub index_buffer: wgpu::Buffer,
    pub index_count: u32,
}

impl MeshGPU {
    /// Create GPU buffers from a CPU mesh
    ///
    /// Converts Mesh (Vec<Vertex>, Vec<Face>) into GPU-friendly buffers.
    /// Vertices are stored as tightly packed [f32; 3] positions + colors + normals.
    /// Indices are flattened face data (3 indices per triangle).
    pub fn from_mesh(device: &wgpu::Device, mesh: &Mesh) -> Self {
        // Convert vertices to GPU format (position + color + normal)
        let gpu_vertices: Vec<GpuVertex> = mesh
            .vertices
            .iter()
            .map(|v| {
                // Use vertex color if available, otherwise default to light burgundy
                let color = v.color.unwrap_or(glam::Vec3::new(0.85, 0.6, 0.6));
                
                // Use vertex normal if available, otherwise default to up (Y+)
                let normal = v.normal.unwrap_or(glam::Vec3::new(0.0, 1.0, 0.0));
                
                GpuVertex {
                    position: [v.position.x, v.position.y, v.position.z],
                    color: [color.x, color.y, color.z],
                    normal: [normal.x, normal.y, normal.z],
                }
            })
            .collect();

        // Flatten faces into index buffer
        let indices: Vec<u32> = mesh
            .faces
            .iter()
            .flat_map(|f| f.vertices.iter().map(|&idx| idx as u32))
            .collect();

        // Create vertex buffer
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Mesh Vertex Buffer"),
            contents: bytemuck::cast_slice(&gpu_vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        // Create index buffer
        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Mesh Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        Self {
            vertex_buffer,
            index_buffer,
            index_count: indices.len() as u32,
        }
    }

    /// Create a default triangle mesh for testing
    ///
    /// Hardcoded RGB triangle in clip space (for backward compatibility).
    pub fn default_triangle(device: &wgpu::Device) -> Self {
        use polylab_core::{Mesh, Vertex, Face};
        use glam::Vec3;

        let mesh = Mesh {
            vertices: vec![
                Vertex { position: Vec3::new(-0.5, -0.5, 0.0), normal: None, tex_coords: None, color: None },
                Vertex { position: Vec3::new(0.5, -0.5, 0.0), normal: None, tex_coords: None, color: None },
                Vertex { position: Vec3::new(0.0, 0.5, 0.0), normal: None, tex_coords: None, color: None },
            ],
            faces: vec![
                Face { vertices: [0, 1, 2] }
            ],
        };

        Self::from_mesh(device, &mesh)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use polylab_core::{Vertex, Face};
    use glam::Vec3;

    // Note: GPU tests require wgpu::Device, which needs async initialization.
    // These tests verify data conversion logic only (no actual GPU upload).

    #[test]
    fn test_gpu_vertex_layout() {
        let layout = GpuVertex::desc();
        assert_eq!(layout.array_stride, 36); // 9 floats * 4 bytes (position + color + normal)
        assert_eq!(layout.attributes.len(), 3);
        assert_eq!(layout.attributes[0].shader_location, 0); // position
        assert_eq!(layout.attributes[1].shader_location, 1); // color
        assert_eq!(layout.attributes[2].shader_location, 2); // normal
    }

    #[test]
    fn test_vertex_conversion() {
        let cpu_vertex = Vertex {
            position: Vec3::new(1.0, 2.0, 3.0),
            normal: Some(Vec3::new(0.0, 1.0, 0.0)),
            tex_coords: None,
            color: Some(Vec3::new(0.5, 0.6, 0.7)),
        };

        let color = cpu_vertex.color.unwrap_or(Vec3::new(0.85, 0.6, 0.6));
        let normal = cpu_vertex.normal.unwrap_or(Vec3::new(0.0, 1.0, 0.0));
        let gpu_vertex = GpuVertex {
            position: [cpu_vertex.position.x, cpu_vertex.position.y, cpu_vertex.position.z],
            color: [color.x, color.y, color.z],
            normal: [normal.x, normal.y, normal.z],
        };

        assert_eq!(gpu_vertex.position, [1.0, 2.0, 3.0]);
        assert_eq!(gpu_vertex.color, [0.5, 0.6, 0.7]);
        assert_eq!(gpu_vertex.normal, [0.0, 1.0, 0.0]);
    }

    #[test]
    fn test_index_flattening() {
        let faces = vec![
            Face { vertices: [0, 1, 2] },
            Face { vertices: [2, 1, 3] },
        ];

        let indices: Vec<u32> = faces
            .iter()
            .flat_map(|f| f.vertices.iter().map(|&idx| idx as u32))
            .collect();

        assert_eq!(indices, vec![0, 1, 2, 2, 1, 3]);
        assert_eq!(indices.len(), 6); // 2 triangles * 3 indices
    }

    #[test]
    fn test_bytemuck_pod() {
        // Verify GpuVertex can be safely cast to bytes
        let vertex = GpuVertex { 
            position: [1.0, 2.0, 3.0],
            color: [0.5, 0.5, 0.5],
            normal: [0.0, 1.0, 0.0],
        };
        let bytes: &[u8] = bytemuck::bytes_of(&vertex);
        assert_eq!(bytes.len(), 36); // 9 floats * 4 bytes (position + color + normal)
    }
}
