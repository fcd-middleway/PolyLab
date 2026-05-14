//! PolyLab Viewer
//!
//! WebGPU-based 3D rendering engine for meshes and point clouds.

// Core modules (available for both WASM and desktop)
mod constants;
mod webgpu_context;
mod pipeline;
mod renderer;
mod mesh_gpu;

// Public exports for desktop usage
pub use pipeline::create_render_pipeline;
pub use renderer::Renderer;
pub use mesh_gpu::{MeshGPU, GpuVertex};

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
        log::info!("Creating viewer for canvas: {}", canvas_id);
        
        // Get canvas element from DOM
        let window = web_sys::window()
            .ok_or_else(|| {
                log::error!("Failed to get window object");
                JsValue::from_str("Window object not available. Are you running in a browser?")
            })?;
        
        let document = window.document()
            .ok_or_else(|| {
                log::error!("Failed to get document object");
                JsValue::from_str("Document object not available")
            })?;
        
        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| {
                log::error!("Canvas element '{}' not found in DOM", canvas_id);
                JsValue::from_str(&format!("Canvas element '{}' not found. Check that the element exists and has the correct ID.", canvas_id))
            })?;
        
        let canvas: web_sys::HtmlCanvasElement = canvas
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .map_err(|_| {
                log::error!("Element '{}' is not a canvas element", canvas_id);
                JsValue::from_str(&format!("Element '{}' exists but is not a <canvas> element", canvas_id))
            })?;

        log::debug!("Canvas element found, creating WebGPU renderer...");
        
        // Create renderer
        let renderer = Renderer::new(canvas)
            .await
            .map_err(|e| {
                log::error!("Failed to create renderer: {}", e);
                JsValue::from_str(&format!("WebGPU initialization failed: {}. Make sure your browser supports WebGPU.", e))
            })?;

        log::debug!("Renderer created, building render pipeline...");
        
        // Create render pipeline with bind group layout
        let bind_group_layout = renderer.bind_group_layout();
        let pipeline = create_render_pipeline(
            renderer.device(),
            renderer.surface_format(),
            &bind_group_layout,
        );

        log::info!("Viewer created successfully");
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

    /// Load a mesh from OBJ file content
    ///
    /// Parses the OBJ string, creates GPU buffers, and adds it to the scene.
    /// Returns the mesh ID that can be used to control visibility or remove the mesh.
    ///
    /// Example usage from JS:
    /// ```js
    /// try {
    ///     const meshId = viewer.load_mesh("mesh-1", objFileContent);
    ///     console.log("Mesh loaded with ID:", meshId);
    /// } catch (error) {
    ///     console.error("Failed to load mesh:", error);
    /// }
    /// ```
    #[wasm_bindgen]
    pub fn load_mesh(&mut self, mesh_id: &str, obj_content: &str) -> Result<String, JsValue> {
        log::info!("Loading mesh with ID: {}", mesh_id);
        log::debug!("OBJ content size: {} bytes", obj_content.len());
        
        // Parse OBJ file
        let mesh = polylab_core::obj_parser::parse_obj(obj_content)
            .map_err(|e| {
                log::error!("Failed to parse OBJ file '{}': {}", mesh_id, e);
                JsValue::from_str(&format!("Failed to parse OBJ file: {}. Check that the file is a valid Wavefront OBJ format.", e))
            })?;

        log::debug!("Mesh parsed: {} vertices, {} faces", mesh.vertices.len(), mesh.faces.len());
        
        // Add mesh to scene
        self.renderer.add_mesh(mesh_id.to_string(), mesh);

        log::info!("Mesh '{}' loaded successfully", mesh_id);
        Ok(mesh_id.to_string())
    }

    /// Set the visibility of a mesh
    #[wasm_bindgen]
    pub fn set_mesh_visibility(&mut self, mesh_id: &str, visible: bool) {
        log::debug!("Setting mesh '{}' visibility to: {}", mesh_id, visible);
        self.renderer.set_mesh_visibility(mesh_id, visible);
    }

    /// Remove a mesh from the scene
    #[wasm_bindgen]
    pub fn remove_mesh(&mut self, mesh_id: &str) {
        log::info!("Removing mesh: {}", mesh_id);
        self.renderer.remove_mesh(mesh_id);
    }

    /// Get current mesh information (vertex count, triangle count)
    ///
    /// Returns a tuple (vertices, triangles) as a JavaScript array.
    #[wasm_bindgen]
    pub fn mesh_info(&self) -> Vec<u32> {
        let (vertices, triangles) = self.renderer.mesh_info();
        vec![vertices, triangles]
    }

    /// Get detailed mesh information including dimensions
    ///
    /// Returns [vertices, triangles, sizeX, sizeY, sizeZ] as a JavaScript array.
    /// Size values are 0.0 if no mesh is loaded.
    /// If mesh_id is provided, returns info for that mesh, otherwise for the first visible mesh.
    #[wasm_bindgen]
    pub fn mesh_details(&self, mesh_id: Option<String>) -> Vec<f32> {
        let (vertices, triangles, size_x, size_y, size_z) = 
            self.renderer.mesh_details(mesh_id.as_deref());
        vec![
            vertices as f32,
            triangles as f32,
            size_x,
            size_y,
            size_z,
        ]
    }
}

// Initialize wasm-bindgen
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn init() {
    // Setup panic hook for better error messages in browser console
    console_error_panic_hook::set_once();
    
    // Initialize logger to output to browser console
    console_log::init_with_level(log::Level::Debug).expect("Failed to initialize logger");
    
    log::info!("PolyLab Viewer initialized");
}
