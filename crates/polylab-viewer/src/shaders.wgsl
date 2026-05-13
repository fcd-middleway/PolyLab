// Vertex shader - generates triangle positions
@vertex
fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    
    // Hardcoded triangle positions (clip space coordinates)
    let x = f32(i32(in_vertex_index) - 1);
    let y = f32(i32(in_vertex_index & 1u) * 2 - 1);
    out.position = vec4<f32>(x * 0.5, y * 0.5, 0.0, 1.0);
    
    // Vertex colors (RGB gradient)
    var colors = array<vec3<f32>, 3>(
        vec3<f32>(1.0, 0.0, 0.0), // Red (top)
        vec3<f32>(0.0, 1.0, 0.0), // Green (bottom-left)
        vec3<f32>(0.0, 0.0, 1.0)  // Blue (bottom-right)
    );
    out.color = colors[in_vertex_index];
    
    return out;
}

// Fragment shader - outputs interpolated colors
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color, 1.0);
}

// Vertex output structure
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
}
