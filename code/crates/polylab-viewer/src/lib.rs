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
mod light;

// Public exports for desktop usage
pub use pipeline::{create_render_pipeline, create_wireframe_pipeline, create_vertices_pipeline};
pub use renderer::{Renderer, RenderModeFlags};
pub use mesh_gpu::{MeshGPU, GpuVertex};
pub use camera::Camera;
pub use light::DirectionalLight;

// Utility function (re-exported for external crates like polylab-rover)
pub use renderer::create_view_projection_matrix;

// WASM-specific code
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// Main viewer handle exposed to JavaScript
///
/// Wraps Renderer and RenderPipelines. Entry point for WASM API.
/// Created via `ViewerHandle.create(canvas_id)` in JS.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct ViewerHandle {
    renderer: Renderer,
    solid_pipeline: wgpu::RenderPipeline,
    wireframe_pipeline: wgpu::RenderPipeline,
    vertices_pipeline: wgpu::RenderPipeline,
    render_modes: RenderModeFlags,
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

        log::debug!("Renderer created, building render pipelines...");
        
        // Create render pipelines with bind group layout
        let bind_group_layout = renderer.bind_group_layout();
        let solid_pipeline = create_render_pipeline(
            renderer.device(),
            renderer.surface_format(),
            &bind_group_layout,
        );
        let wireframe_pipeline = create_wireframe_pipeline(
            renderer.device(),
            renderer.surface_format(),
            &bind_group_layout,
        );
        let vertices_pipeline = create_vertices_pipeline(
            renderer.device(),
            renderer.surface_format(),
            &bind_group_layout,
        );

        log::info!("Viewer created successfully");
        Ok(ViewerHandle { 
            renderer, 
            solid_pipeline,
            wireframe_pipeline,
            vertices_pipeline,
            render_modes: RenderModeFlags::solid_only(),
        })
    }

    /// Render a frame
    ///
    /// Call this every frame from requestAnimationFrame in JS.
    /// Returns error if surface is lost (needs resize).
    #[wasm_bindgen]
    pub fn render(&mut self) -> Result<(), JsValue> {
        self.renderer
            .render_multi_pass(
                &self.solid_pipeline,
                &self.wireframe_pipeline,
                &self.vertices_pipeline,
                &self.render_modes,
            )
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Resize the viewer
    ///
    /// Call when canvas/window size changes.
    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) {
        self.renderer.resize(width, height);
    }

    /// Set render modes (solid, wireframe, vertices)
    ///
    /// Controls which rendering passes are active.
    /// All modes can be active simultaneously for debugging.
    #[wasm_bindgen]
    pub fn set_render_modes(&mut self, solid: bool, wireframe: bool, vertices: bool) {
        self.render_modes = RenderModeFlags {
            solid,
            wireframe,
            vertices,
        };
        log::info!("Render modes updated: solid={}, wireframe={}, vertices={}", solid, wireframe, vertices);
    }

    /// Get current render mode settings
    #[wasm_bindgen]
    pub fn get_render_modes(&self) -> JsValue {
        use wasm_bindgen::JsCast;
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"solid".into(), &JsValue::from(self.render_modes.solid)).unwrap();
        js_sys::Reflect::set(&obj, &"wireframe".into(), &JsValue::from(self.render_modes.wireframe)).unwrap();
        js_sys::Reflect::set(&obj, &"vertices".into(), &JsValue::from(self.render_modes.vertices)).unwrap();
        obj.into()
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
        let mut mesh = polylab_core::obj_parser::parse_obj(obj_content)
            .map_err(|e| {
                log::error!("Failed to parse OBJ file '{}': {}", mesh_id, e);
                JsValue::from_str(&format!("Failed to parse OBJ file: {}. Check that the file is a valid Wavefront OBJ format.", e))
            })?;

        log::debug!("Mesh parsed: {} vertices, {} faces", mesh.vertices.len(), mesh.faces.len());
        
        // Calculate smooth normals if mesh doesn't have them
        // (Many OBJ files don't include normal data)
        let has_normals = mesh.vertices.iter().any(|v| v.normal.is_some());
        if !has_normals {
            log::debug!("Mesh '{}' has no normals, calculating smooth normals...", mesh_id);
            mesh.calculate_smooth_normals();
        }
        
        // Add mesh to scene
        self.renderer.add_mesh(mesh_id.to_string(), mesh);

        log::info!("Mesh '{}' loaded successfully", mesh_id);
        Ok(mesh_id.to_string())
    }
    
    /// Load a mesh from OBJ content and position it at specified coordinates
    ///
    /// Similar to load_mesh() but translates the mesh to the given position.
    ///
    /// # Arguments
    /// * `mesh_id` - Unique identifier for the mesh
    /// * `obj_content` - OBJ file content as string
    /// * `x`, `y`, `z` - Position coordinates to place the mesh
    ///
    /// # Returns
    /// The mesh ID on success, or error if parsing fails
    ///
    /// Example usage from JS:
    /// ```js
    /// // Load cube at position (10, 0, 5)
    /// viewer.load_mesh_at("cube", objContent, 10.0, 0.0, 5.0);
    /// ```
    #[wasm_bindgen]
    pub fn load_mesh_at(&mut self, mesh_id: &str, obj_content: &str, x: f32, y: f32, z: f32) -> Result<String, JsValue> {
        log::info!("Loading mesh '{}' at position ({}, {}, {})", mesh_id, x, y, z);
        log::debug!("OBJ content size: {} bytes", obj_content.len());
        
        // Parse OBJ file
        let mut mesh = polylab_core::obj_parser::parse_obj(obj_content)
            .map_err(|e| {
                log::error!("Failed to parse OBJ file '{}': {}", mesh_id, e);
                JsValue::from_str(&format!("Failed to parse OBJ file: {}. Check that the file is a valid Wavefront OBJ format.", e))
            })?;

        log::debug!("Mesh parsed: {} vertices, {} faces", mesh.vertices.len(), mesh.faces.len());
        
        // Translate mesh to target position
        mesh.translate(glam::Vec3::new(x, y, z));
        log::debug!("Mesh translated to ({}, {}, {})", x, y, z);
        
        // Calculate smooth normals if mesh doesn't have them
        let has_normals = mesh.vertices.iter().any(|v| v.normal.is_some());
        if !has_normals {
            log::debug!("Mesh '{}' has no normals, calculating smooth normals...", mesh_id);
            mesh.calculate_smooth_normals();
        }
        
        // Add mesh to scene
        self.renderer.add_mesh(mesh_id.to_string(), mesh);

        log::info!("Mesh '{}' loaded and positioned successfully", mesh_id);
        Ok(mesh_id.to_string())
    }
    
    /// Load a mesh from OBJ content, rotate it around Y axis, and position it
    ///
    /// Combines rotation and translation in one operation.
    /// Rotation is applied first (around origin), then translation.
    ///
    /// # Arguments
    /// * `mesh_id` - Unique identifier for the mesh
    /// * `obj_content` - OBJ file content as string
    /// * `x`, `y`, `z` - Position coordinates to place the mesh
    /// * `rotation_y_degrees` - Rotation angle in degrees around Y axis (positive = counter-clockwise from above)
    ///
    /// # Returns
    /// The mesh ID on success, or error if parsing fails
    ///
    /// Example usage from JS:
    /// ```js
    /// // Load rover at z=-10, rotated 90° to the right (face +Z direction)
    /// viewer.load_mesh_at_rotated("rover", objContent, 0.0, 0.0, -10.0, 90.0);
    /// ```
    #[wasm_bindgen]
    pub fn load_mesh_at_rotated(&mut self, mesh_id: &str, obj_content: &str, x: f32, y: f32, z: f32, rotation_y_degrees: f32) -> Result<String, JsValue> {
        log::info!("Loading mesh '{}' at ({}, {}, {}) with Y rotation {}°", mesh_id, x, y, z, rotation_y_degrees);
        log::debug!("OBJ content size: {} bytes", obj_content.len());
        
        // Parse OBJ file
        let mut mesh = polylab_core::obj_parser::parse_obj(obj_content)
            .map_err(|e| {
                log::error!("Failed to parse OBJ file '{}': {}", mesh_id, e);
                JsValue::from_str(&format!("Failed to parse OBJ file: {}. Check that the file is a valid Wavefront OBJ format.", e))
            })?;

        log::debug!("Mesh parsed: {} vertices, {} faces", mesh.vertices.len(), mesh.faces.len());
        
        // Rotate mesh first (around origin)
        let angle_radians = rotation_y_degrees.to_radians();
        mesh.rotate_y(angle_radians);
        log::debug!("Mesh rotated by {}° around Y axis", rotation_y_degrees);
        
        // Then translate to target position
        mesh.translate(glam::Vec3::new(x, y, z));
        log::debug!("Mesh translated to ({}, {}, {})", x, y, z);
        
        // Calculate smooth normals if mesh doesn't have them
        let has_normals = mesh.vertices.iter().any(|v| v.normal.is_some());
        if !has_normals {
            log::debug!("Mesh '{}' has no normals, calculating smooth normals...", mesh_id);
            mesh.calculate_smooth_normals();
        }
        
        // Add mesh to scene
        self.renderer.add_mesh(mesh_id.to_string(), mesh);

        log::info!("Mesh '{}' loaded, rotated, and positioned successfully", mesh_id);
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
    
    /// Get camera yaw (rotation around Y axis) in radians
    #[wasm_bindgen]
    pub fn camera_get_yaw(&self) -> f32 {
        self.renderer.camera_get_yaw()
    }
    
    /// Get camera pitch (rotation around X axis) in radians
    #[wasm_bindgen]
    pub fn camera_get_pitch(&self) -> f32 {
        self.renderer.camera_get_pitch()
    }
    
    /// Set camera yaw (rotation around Y axis) in radians
    #[wasm_bindgen]
    pub fn camera_set_yaw(&mut self, yaw: f32) {
        self.renderer.camera_set_yaw(yaw);
    }
    
    /// Set camera pitch (rotation around X axis) in radians
    #[wasm_bindgen]
    pub fn camera_set_pitch(&mut self, pitch: f32) {
        self.renderer.camera_set_pitch(pitch);
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
    
    /// Reset camera to default position
    ///
    /// Resets camera to (0, 0, 10) looking at origin.
    /// Useful for "reset view" button.
    #[wasm_bindgen]
    pub fn reset_camera(&mut self) {
        self.renderer.camera_reset();
    }
    
    /// Center camera on all visible meshes
    ///
    /// Calculates bounding box of all visible meshes and positions camera to view them all.
    /// Returns true if successful, false if no visible meshes in scene.
    #[wasm_bindgen]
    pub fn center_on_meshes(&mut self) -> bool {
        self.renderer.camera_center_on_meshes()
    }
    
    /// Export current scene to PolyLab Scene (.pls) format
    ///
    /// Exports all visible meshes, camera, and light to a ZIP archive containing:
    /// - manifest.json with scene metadata
    /// - meshes/*.obj with geometry
    /// - cameras/main.json with camera parameters
    /// - lights/directional.json with light parameters
    ///
    /// Returns ZIP file as byte array for download.
    #[wasm_bindgen]
    pub fn export_scene(&self, name: &str) -> Result<Vec<u8>, JsValue> {
        self.renderer.export_scene(name.to_string())
            .map_err(|e| JsValue::from_str(&e))
    }
    
    // ========================
    // Custom View-Projection Matrix Rendering
    // ========================
    
    /// Render a frame with a custom view-projection matrix
    ///
    /// This allows rendering with camera parameters different from the main camera.
    /// Useful for multi-view rendering, stereo, portals, etc.
    ///
    /// # Parameters
    /// * `matrix_data` - 16 float values representing the view-projection matrix in column-major order
    ///
    /// # Example
    /// ```javascript
    /// // Create a custom camera matrix (from external source)
    /// const customMatrix = calculateCustomViewProjection();
    /// viewer.render_with_matrix(customMatrix);
    /// ```
    #[wasm_bindgen]
    pub fn render_with_matrix(&mut self, matrix_data: Vec<f32>) -> Result<(), JsValue> {
        if matrix_data.len() != 16 {
            return Err(JsValue::from_str(&format!(
                "Matrix must have 16 elements, got {}",
                matrix_data.len()
            )));
        }
        
        // Convert Vec<f32> to [f32; 16]
        let mut array = [0.0f32; 16];
        array.copy_from_slice(&matrix_data);
        
        // Create glam Mat4 from array
        let matrix = glam::Mat4::from_cols_array(&array);
        
        self.renderer
            .render_with_view_projection(&self.solid_pipeline, matrix)
            .map_err(|e| JsValue::from_str(&e))
    }

    // ========================
    // Compression API
    // ========================

    /// Create a compression handle for mesh simplification
    ///
    /// This creates a handle that can be used to progressively simplify a mesh
    /// using various decimation metrics (edge length, QEM, etc.)
    ///
    /// # Parameters
    /// * `mesh_id` - Unique identifier for the mesh
    /// * `vertices` - Flattened vertex positions [x, y, z, x, y, z, ...]
    /// * `faces` - Face indices (triangles: [i0, i1, i2, i0, i1, i2, ...])
    ///
    /// # Returns
    /// A CompressionHandle that can be used for simplification operations
    ///
    /// # Example
    /// ```javascript
    /// const vertices = new Float32Array([
    ///     0, 0, 0,  // v0
    ///     1, 0, 0,  // v1
    ///     0, 1, 0   // v2
    /// ]);
    /// const faces = new Uint32Array([0, 1, 2]);
    /// const handle = viewer.create_compression_handle("my-mesh", vertices, faces);
    /// ```
    #[wasm_bindgen]
    pub fn create_compression_handle(
        &self,
        mesh_id: String,
        vertices: Vec<f32>,
        faces: Vec<u32>,
    ) -> Result<polylab_compression::CompressionHandle, JsValue> {
        log::info!("Creating compression handle for mesh: {}", mesh_id);
        log::debug!("Mesh data: {} vertices, {} faces", vertices.len() / 3, faces.len() / 3);
        
        polylab_compression::CompressionHandle::new(mesh_id, vertices, faces)
    }

    /// Update an existing mesh with new geometry
    ///
    /// This replaces the vertex and face data of an existing mesh in the scene.
    /// Useful for updating meshes after simplification or other operations.
    ///
    /// # Parameters
    /// * `mesh_id` - Identifier of the mesh to update (must exist in scene)
    /// * `vertices` - New flattened vertex positions [x, y, z, x, y, z, ...]
    /// * `faces` - New face indices (triangles)
    ///
    /// # Example
    /// ```javascript
    /// // After simplification
    /// const result = compressionHandle.simplify_step(0.9, "edge_length");
    /// viewer.update_mesh("my-mesh", result.vertices, result.faces);
    /// ```
    #[wasm_bindgen]
    pub fn update_mesh(
        &mut self,
        mesh_id: &str,
        vertices: Vec<f32>,
        faces: Vec<u32>,
    ) -> Result<(), JsValue> {
        log::info!("Updating mesh: {}", mesh_id);
        log::debug!("New mesh data: {} vertices, {} faces", vertices.len() / 3, faces.len() / 3);
        
        // Create a new mesh from raw data
        let mut mesh = polylab_core::mesh::Mesh::new();
        
        // Add vertices
        for i in 0..vertices.len() / 3 {
            mesh.vertices.push(polylab_core::mesh::Vertex {
                position: glam::Vec3::new(
                    vertices[i * 3],
                    vertices[i * 3 + 1],
                    vertices[i * 3 + 2],
                ),
                normal: None,
                tex_coords: None,
                color: None,
            });
        }
        
        // Add faces
        for i in 0..faces.len() / 3 {
            mesh.faces.push(polylab_core::mesh::Face {
                vertices: [
                    faces[i * 3] as usize,
                    faces[i * 3 + 1] as usize,
                    faces[i * 3 + 2] as usize,
                ],
            });
        }
        
        // Calculate normals
        mesh.calculate_smooth_normals();
        
        // Update the mesh in the renderer
        self.renderer.add_mesh(mesh_id.to_string(), mesh);
        
        log::info!("Mesh '{}' updated successfully", mesh_id);
        Ok(())
    }
}

// ========================
// Standalone Utility Functions (WASM)
// ========================

/// Create a view-projection matrix from camera parameters (utility function)
///
/// This is a standalone function that can be used to calculate view-projection
/// matrices without a ViewerHandle. Useful for external systems (rovers, NPCs, etc.)
///
/// # Parameters
/// * `eye_x`, `eye_y`, `eye_z` - Camera position in world space
/// * `yaw` - Horizontal rotation in radians (Y-axis). 0 = looking towards -Z
/// * `pitch` - Vertical rotation in radians (X-axis). Positive = looking up
/// * `aspect_ratio` - Width / height ratio of the viewport
///
/// # Returns
/// 16-element array representing the 4x4 matrix in column-major order
///
/// # Example
/// ```javascript
/// const matrix = create_view_proj_matrix(
///     0, 1, -5,    // eye position
///     0, 0,        // yaw, pitch
///     16/9         // aspect ratio
/// );
/// viewer.render_with_matrix(matrix);
/// ```
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = createViewProjectionMatrix)]
pub fn create_view_proj_matrix_wasm(
    eye_x: f32,
    eye_y: f32,
    eye_z: f32,
    yaw: f32,
    pitch: f32,
    aspect_ratio: f32,
) -> Vec<f32> {
    let eye_position = glam::Vec3::new(eye_x, eye_y, eye_z);
    let matrix = crate::create_view_projection_matrix(eye_position, yaw, pitch, aspect_ratio);
    let data: &[f32; 16] = matrix.as_ref();
    data.to_vec()
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
