//! PolyLab Viewer
//!
//! WebGPU-based 3D rendering engine for meshes and point clouds.

// Only compile for WASM target
#[cfg(target_arch = "wasm32")]
mod pipeline;
#[cfg(target_arch = "wasm32")]
mod renderer;

#[cfg(target_arch = "wasm32")]
use pipeline::create_render_pipeline;
#[cfg(target_arch = "wasm32")]
use renderer::Renderer;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// Main viewer handle exposed to JavaScript
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
    /// Note: This is not a constructor to avoid wasm-bindgen async constructor issues
    #[wasm_bindgen]
    pub async fn create(canvas_id: &str) -> Result<ViewerHandle, JsValue> {
        // Setup panic hook for better error messages
        console_error_panic_hook::set_once();

        // Get canvas element from DOM
        let window = web_sys::window().ok_or("No window found")?;
        let document = window.document().ok_or("No document found")?;
        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or(format!("Canvas element '{}' not found", canvas_id))?;
        let canvas: web_sys::HtmlCanvasElement = canvas
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .map_err(|_| "Element is not a canvas")?;

        // Create renderer
        let renderer = Renderer::new(canvas)
            .await
            .map_err(|e| JsValue::from_str(&e))?;

        // Create render pipeline
        let pipeline = create_render_pipeline(&renderer.device, renderer.config.format);

        Ok(ViewerHandle { renderer, pipeline })
    }

    /// Render a frame
    #[wasm_bindgen]
    pub fn render(&self) -> Result<(), JsValue> {
        self.renderer
            .render(&self.pipeline)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Resize the viewer
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
