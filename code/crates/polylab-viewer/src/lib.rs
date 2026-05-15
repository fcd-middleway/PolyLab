//! PolyLab Viewer
//!
//! WebGPU-based 3D rendering engine for meshes and point clouds.

// Core modules (available for both WASM and desktop)
mod constants;
mod webgpu_context;
mod pipeline;
mod renderer;
mod mesh_gpu;
mod camera;

// Public exports for desktop usage
pub use pipeline::create_render_pipeline;
pub use renderer::Renderer;
pub use mesh_gpu::{MeshGPU, GpuVertex};
pub use camera::Camera;

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
    pub fn render(&mut self) -> Result<(), JsValue> {
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

    /// Generate a procedural terrain mesh using Perlin noise
    ///
    /// Creates a 3D terrain with configurable parameters and adds it to the scene.
    ///
    /// # Parameters
    /// * `mesh_id` - Unique identifier for the terrain mesh
    /// * `seed` - Random seed (0-999999)
    /// * `octaves` - Number of noise layers (1-8, more = more detail)
    /// * `persistence` - Amplitude decay per octave (0.1-1.0, lower = smoother)
    /// * `scale` - Noise frequency scale (1-100, higher = zoomed out)
    /// * `width` - Terrain width in world units
    /// * `depth` - Terrain depth in world units
    /// * `width_segments` - Number of vertices along width (resolution)
    /// * `depth_segments` - Number of vertices along depth (resolution)
    ///
    /// # Returns
    /// The mesh ID on success
    ///
    /// # Example
    /// ```js
    /// const terrainId = viewer.generate_terrain(
    ///     "terrain-1",  // mesh_id
    ///     12345,        // seed
    ///     4,            // octaves
    ///     0.5,          // persistence
    ///     20.0,         // scale
    ///     20.0,         // width
    ///     20.0,         // depth
    ///     50,           // width_segments
    ///     50            // depth_segments
    /// );
    /// ```
    #[wasm_bindgen]
    pub fn generate_terrain(
        &mut self,
        mesh_id: &str,
        seed: u32,
        octaves: u32,
        persistence: f32,
        scale: f32,
        width: f32,
        depth: f32,
        width_segments: u32,
        depth_segments: u32,
    ) -> Result<String, JsValue> {
        log::info!("Generating terrain with ID: {}", mesh_id);
        log::debug!(
            "Terrain params: seed={}, octaves={}, persistence={}, scale={}, {}x{}, {}x{} segments",
            seed, octaves, persistence, scale, width, depth, width_segments, depth_segments
        );

        // Validate parameters
        if octaves == 0 || octaves > 8 {
            return Err(JsValue::from_str("Octaves must be between 1 and 8"));
        }
        if persistence < 0.1 || persistence > 1.0 {
            return Err(JsValue::from_str("Persistence must be between 0.1 and 1.0"));
        }
        if scale <= 0.0 {
            return Err(JsValue::from_str("Scale must be positive"));
        }
        if width <= 0.0 || depth <= 0.0 {
            return Err(JsValue::from_str("Width and depth must be positive"));
        }
        if width_segments < 2 || depth_segments < 2 {
            return Err(JsValue::from_str("Width and depth segments must be at least 2"));
        }

        // Create terrain parameters
        let params = polylab_perlin::TerrainParams {
            seed: seed as u64,
            octaves,
            persistence,
            scale,
            width,
            depth,
            width_segments,
            depth_segments,
            height_min: 0.0,
            height_max: 10.0,
        };

        // Generate terrain mesh
        let mesh = polylab_perlin::generate_terrain(&params);
        
        log::debug!(
            "Terrain generated: {} vertices, {} faces",
            mesh.vertices.len(),
            mesh.faces.len()
        );

        // Add mesh to scene
        self.renderer.add_mesh(mesh_id.to_string(), mesh);

        log::info!("Terrain '{}' generated successfully", mesh_id);
        Ok(mesh_id.to_string())
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
    
    // ========================
    // Camera Control Methods
    // ========================
    
    /// Move camera forward/backward
    ///
    /// Positive delta moves forward, negative moves backward.
    /// Delta is multiplied by camera move_speed and deltaTime in the update loop.
    #[wasm_bindgen]
    pub fn camera_move_forward(&mut self, delta: f32) {
        self.renderer.camera_move_forward(delta);
    }
    
    /// Move camera right/left
    ///
    /// Positive delta moves right, negative moves left.
    #[wasm_bindgen]
    pub fn camera_move_right(&mut self, delta: f32) {
        self.renderer.camera_move_right(delta);
    }
    
    /// Move camera up/down
    ///
    /// Positive delta moves up, negative moves down.
    #[wasm_bindgen]
    pub fn camera_move_up(&mut self, delta: f32) {
        self.renderer.camera_move_up(delta);
    }
    
    /// Rotate camera yaw (left/right) in radians
    ///
    /// Positive delta rotates right, negative rotates left.
    #[wasm_bindgen]
    pub fn camera_rotate_yaw(&mut self, delta: f32) {
        self.renderer.camera_rotate_yaw(delta);
    }
    
    /// Rotate camera pitch (up/down) in radians
    ///
    /// Positive delta rotates up, negative rotates down.
    /// Pitch is automatically clamped to avoid gimbal lock.
    #[wasm_bindgen]
    pub fn camera_rotate_pitch(&mut self, delta: f32) {
        self.renderer.camera_rotate_pitch(delta);
    }
    
    /// Set camera position
    #[wasm_bindgen]
    pub fn camera_set_position(&mut self, x: f32, y: f32, z: f32) {
        self.renderer.camera_set_position(x, y, z);
    }
    
    /// Get camera position
    ///
    /// Returns [x, y, z] as a JavaScript array.
    #[wasm_bindgen]
    pub fn camera_position(&self) -> Vec<f32> {
        let (x, y, z) = self.renderer.camera_position();
        vec![x, y, z]
    }
    
    /// Set orbital rotation target point
    ///
    /// Sets the point around which the camera orbits when using mouse drag.
    /// Default is origin (0, 0, 0).
    #[wasm_bindgen]
    pub fn camera_set_orbit_target(&mut self, x: f32, y: f32, z: f32) {
        self.renderer.camera_set_orbit_target(x, y, z);
    }
    
    /// Get orbital rotation target point
    ///
    /// Returns [x, y, z] as a JavaScript array.
    #[wasm_bindgen]
    pub fn camera_orbit_target(&self) -> Vec<f32> {
        let (x, y, z) = self.renderer.camera_orbit_target();
        vec![x, y, z]
    }
    
    /// Orbit camera around target point
    ///
    /// Rotates camera in a spherical arc around the orbit target.
    /// Used for mouse-drag orbital rotation (typical 3D viewer behavior).
    ///
    /// # Parameters
    /// * `delta_yaw` - Horizontal rotation in radians (positive = orbit right)
    /// * `delta_pitch` - Vertical rotation in radians (positive = orbit up)
    #[wasm_bindgen]
    pub fn camera_orbit_around(&mut self, delta_yaw: f32, delta_pitch: f32) {
        self.renderer.camera_orbit_around(delta_yaw, delta_pitch);
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
