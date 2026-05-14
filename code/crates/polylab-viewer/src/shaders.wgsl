// Mesh shader - WGSL (WebGPU Shading Language)
//
// Reads vertex positions from a vertex buffer (instead of hardcoding them).
// Supports any mesh loaded from OBJ files.

// Uniform buffer - aspect ratio correction
struct ViewUniforms {
    aspect_ratio: f32,  // width / height
}

@group(0) @binding(0)
var<uniform> view: ViewUniforms;

// Vertex shader output / Fragment shader input
struct VertexOutput {
    @builtin(position) position: vec4<f32>,  // Clip-space position
    @location(0) color: vec3<f32>,           // Interpolated color (RGB)
}

// Vertex shader - reads positions from vertex buffer
@vertex
fn vs_main(
    @location(0) position: vec3<f32>,  // Position from vertex buffer
    @builtin(vertex_index) in_vertex_index: u32
) -> VertexOutput {
    var out: VertexOutput;
    
    // Apply aspect ratio correction to X coordinate
    out.position = vec4<f32>(position.x / view.aspect_ratio, position.y, position.z, 1.0);
    
    // Per-vertex colors based on position (for now)
    // TODO: Read colors from vertex buffer when available
    out.color = normalize(position) * 0.5 + 0.5;  // Map [-1,1] to [0,1] RGB
    
    return out;
}

// Fragment shader - outputs interpolated colors
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Colors are interpolated across triangle by GPU
    return vec4<f32>(in.color, 1.0); // RGB + full alpha
}
