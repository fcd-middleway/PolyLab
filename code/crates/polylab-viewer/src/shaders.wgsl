// Triangle demo shader - WGSL (WebGPU Shading Language)
//
// Hardcoded triangle positions and colors (no vertex buffers).
// Vertex shader runs 3 times (once per vertex), fragment shader per pixel.

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

// Vertex shader - generates triangle positions from vertex index
@vertex
fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    
    // Hardcoded triangle positions in clip space [-1, 1]
    let x = f32(i32(in_vertex_index) - 1);
    let y = f32(i32(in_vertex_index & 1u) * 2 - 1);
    
    // Apply aspect ratio correction to X coordinate
    out.position = vec4<f32>(x * 0.5 / view.aspect_ratio, y * 0.5, 0.0, 1.0);
    
    // Per-vertex colors (red, green, blue)
    var colors = array<vec3<f32>, 3>(
        vec3<f32>(1.0, 0.0, 0.0), // Vertex 0: Red (top)
        vec3<f32>(0.0, 1.0, 0.0), // Vertex 1: Green (bottom-left)
        vec3<f32>(0.0, 0.0, 1.0)  // Vertex 2: Blue (bottom-right)
    );
    out.color = colors[in_vertex_index];
    
    return out;
}

// Fragment shader - outputs interpolated colors
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Colors are interpolated across triangle by GPU
    return vec4<f32>(in.color, 1.0); // RGB + full alpha
}
