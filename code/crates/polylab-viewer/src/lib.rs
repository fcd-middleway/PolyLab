//! PolyLab Viewer
//!
//! WebGPU-based 3D rendering engine for meshes and point clouds.

// Core modules (available for both WASM and desktop)
mod constants;
mod webgpu_context;
mod pipeline;
mod renderer;

// Public exports for desktop usage
pub use pipeline::create_render_pipeline;
pub use renderer::Renderer;

// WASM-specific code
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// Main viewer handle exposed to JavaScript
///
/// Wraps Renderer and RenderPipeline. Entry point for WASM API.
/// Created via `ViewerHandle.create(canvas_id)` in JS.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct ViewerHandle {
    renderer: Renderer,
    pipeline: wgpu::RenderPipeline,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl ViewerHandle {
    /// Create a new viewer attached to the given canvas element
    ///
    /// Initializes WebGPU context and creates render pipeline.
    /// Call from JS: `await ViewerHandle.create('canvas-id')`
    #[wasm_bindgen]
    pub async fn create(canvas_id: &str) -> Result<ViewerHandle, JsValue> {
        // Setup panic hook for better error messages in browser console
        console_error_panic_hook::set_once();

        // Get canvas element from DOM
        let window = web_sys::window().ok_or("No window found")?;
        let document = window.document().ok_or("No document found")?;
        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or(format!("Canvas '{}' not found", canvas_id))?;
        let canvas: web_sys::HtmlCanvasElement = canvas
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .map_err(|_| "Element is not a canvas")?;

        // Create renderer
        let renderer = Renderer::new(canvas)
            .await
            .map_err(|e| JsValue::from_str(&e))?;

        // Create render pipeline with bind group layout
        let bind_group_layout = renderer.bind_group_layout();
        let pipeline = create_render_pipeline(
            renderer.device(),
            renderer.surface_format(),
            &bind_group_layout,
        );

        Ok(ViewerHandle { renderer, pipeline })
    }

    /// Render a frame
    ///
    /// Call this every frame from requestAnimationFrame in JS.
    /// Returns error if surface is lost (needs resize).
    #[wasm_bindgen]
    pub fn render(&self) -> Result<(), JsValue> {
        self.renderer
            .render(&self.pipeline)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Resize the viewer
    ///
    /// Call when canvas/window size changes.
    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) {
        self.renderer.resize(width, height);
    }
}

// Initialize wasm-bindgen
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}
