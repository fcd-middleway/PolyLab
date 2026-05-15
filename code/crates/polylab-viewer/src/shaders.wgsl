// Mesh shader - WGSL (WebGPU Shading Language)
//
// Reads vertex positions from a vertex buffer and applies camera transformations.
// Supports any mesh loaded from OBJ files with full 3D camera control.

// Uniform buffer - camera view and projection matrices
struct ViewUniforms {
    view_proj: mat4x4<f32>,  // Combined view-projection matrix
}

@group(0) @binding(0)
var<uniform> view: ViewUniforms;

// Vertex shader output / Fragment shader input
struct VertexOutput {
    @builtin(position) position: vec4<f32>,  // Clip-space position
    @location(0) color: vec3<f32>,           // Interpolated color (RGB)
    @location(1) world_pos: vec3<f32>,       // World position for lighting
}

// Vertex shader - transforms vertices through view-projection
@vertex
fn vs_main(
    @location(0) position: vec3<f32>,  // Position from vertex buffer
    @builtin(vertex_index) in_vertex_index: u32
) -> VertexOutput {
    var out: VertexOutput;
    
    // Transform position through view-projection matrix
    out.position = view.view_proj * vec4<f32>(position, 1.0);
    
    // Store world position for future lighting calculations
    out.world_pos = position;
    
    // Per-vertex colors based on position (for now)
    // TODO: Read colors from vertex buffer or apply proper lighting
    out.color = normalize(position) * 0.5 + 0.5;  // Map [-1,1] to [0,1] RGB
    
    return out;
}

// Fragment shader - outputs interpolated colors
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Colors are interpolated across triangle by GPU
    return vec4<f32>(in.color, 1.0); // RGB + full alpha
}
