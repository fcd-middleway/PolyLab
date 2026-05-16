// Mesh shader - WGSL (WebGPU Shading Language)
//
// Renders meshes with Lambertian shading using a directional light.
// Supports per-vertex colors and normals for realistic terrain rendering.

// Uniform buffer - camera view and projection matrices
struct ViewUniforms {
    view_proj: mat4x4<f32>,  // Combined view-projection matrix
}

@group(0) @binding(0)
var<uniform> view: ViewUniforms;

// Directional light data
struct DirectionalLight {
    direction: vec3<f32>,    // Light direction (normalized)
    _padding1: f32,
    color: vec3<f32>,        // Light color (RGB)
    _padding2: f32,
    intensity: f32,          // Light intensity multiplier
    ambient: f32,            // Ambient light level
    _padding3: vec2<f32>,
}

@group(0) @binding(1)
var<uniform> light: DirectionalLight;

// Vertex shader output / Fragment shader input
struct VertexOutput {
    @builtin(position) position: vec4<f32>,  // Clip-space position
    @location(0) color: vec3<f32>,           // Interpolated color (RGB)
    @location(1) normal: vec3<f32>,          // Interpolated normal
    @location(2) world_pos: vec3<f32>,       // World position for lighting
}

// Vertex shader - transforms vertices through view-projection
@vertex
fn vs_main(
    @location(0) position: vec3<f32>,  // Position from vertex buffer
    @location(1) color: vec3<f32>,     // Color from vertex buffer
    @location(2) normal: vec3<f32>,    // Normal from vertex buffer
    @builtin(vertex_index) in_vertex_index: u32
) -> VertexOutput {
    var out: VertexOutput;
    
    // Transform position through view-projection matrix
    out.position = view.view_proj * vec4<f32>(position, 1.0);
    
    // Store world position for future effects
    out.world_pos = position;
    
    // Pass through vertex color and normal (interpolated by GPU across triangles)
    out.color = color;
    out.normal = normalize(normal);
    
    return out;
}

// Fragment shader - applies Lambertian shading with directional light
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Normalize interpolated normal (GPU interpolation can change length)
    let normal = normalize(in.normal);
    
    // Calculate diffuse lighting (Lambertian)
    // dot(normal, -light.direction) gives us the angle between surface and light
    // max(..., 0.0) ensures we don't get negative lighting on back faces
    let diffuse = max(dot(normal, -light.direction), 0.0);
    
    // Combine ambient + diffuse lighting
    let lighting = light.ambient + (diffuse * light.intensity);
    
    // Apply lighting to vertex color
    let lit_color = in.color * light.color * lighting;
    
    return vec4<f32>(lit_color, 1.0);
}
