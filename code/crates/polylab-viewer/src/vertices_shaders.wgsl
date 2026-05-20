// Vertices shader - WGSL (WebGPU Shading Language)
//
// Renders vertices as colored points

// Uniform buffer - camera view and projection matrices
struct ViewUniforms {
    view_proj: mat4x4<f32>,
}

@group(0) @binding(0)
var<uniform> view: ViewUniforms;

// Vertex shader output / Fragment shader input
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
}

// Vertex shader - transforms vertices through view-projection
@vertex
fn vs_main(
    @location(0) position: vec3<f32>,
) -> VertexOutput {
    var out: VertexOutput;
    out.position = view.view_proj * vec4<f32>(position, 1.0);
    return out;
}

// Fragment shader - red color for vertices
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.2, 0.2, 1.0); // Red
}
