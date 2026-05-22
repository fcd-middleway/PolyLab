//! Scene management and export
//!
//! Handles scene structure with meshes, cameras, and lights.
//! Supports export to PolyLab Scene (.pls) format.

use crate::mesh::Mesh;
use glam::Vec3;

/// Camera configuration
#[derive(Debug, Clone)]
pub struct Camera {
    pub position: Vec3,
    pub target: Vec3,
    pub fov: f32,
    pub near: f32,
    pub far: f32,
}

impl Camera {
    /// Create a default camera
    pub fn default_camera() -> Self {
        Self {
            position: Vec3::new(0.0, 2.0, 5.0),
            target: Vec3::ZERO,
            fov: 45.0,
            near: 0.1,
            far: 200.0,
        }
    }
}

/// Directional light configuration
#[derive(Debug, Clone)]
pub struct Light {
    pub direction: Vec3,
    pub color: Vec3,
    pub intensity: f32,
}

impl Light {
    /// Create a default sun light
    pub fn default_sun() -> Self {
        Self {
            direction: Vec3::new(0.3, -0.8, -0.5).normalize(),
            color: Vec3::new(1.0, 1.0, 1.0),
            intensity: 1.0,
        }
    }
}

/// Mesh entry in the scene
#[derive(Debug, Clone)]
pub struct MeshEntry {
    pub id: String,
    pub name: String,
    pub mesh: Mesh,
    pub visible: bool,
}

/// Complete scene with all assets
#[derive(Debug, Clone)]
pub struct Scene {
    pub name: String,
    pub meshes: Vec<MeshEntry>,
    pub camera: Camera,
    pub light: Light,
}

impl Scene {
    /// Create a new empty scene
    pub fn new(name: String) -> Self {
        Self {
            name,
            meshes: Vec::new(),
            camera: Camera::default_camera(),
            light: Light::default_sun(),
        }
    }
    
    /// Add a mesh to the scene
    pub fn add_mesh(&mut self, id: String, name: String, mesh: Mesh) {
        self.meshes.push(MeshEntry {
            id,
            name,
            mesh,
            visible: true,
        });
    }
    
    /// Export scene to PolyLab Scene (.pls) format
    ///
    /// Generates a ZIP archive containing:
    /// - manifest.json (scene metadata)
    /// - meshes/*.obj (mesh geometry)
    /// - cameras/main.json (camera parameters)
    /// - lights/directional.json (light parameters)
    ///
    /// Returns the ZIP file as a byte vector.
    ///
    /// # Errors
    /// Returns error if ZIP creation or file writing fails.
    pub fn export_to_pls(&self) -> Result<Vec<u8>, String> {
        use std::io::{Write, Cursor};
        use zip::write::{SimpleFileOptions, ZipWriter};
        use zip::CompressionMethod;
        
        let mut buf = Vec::new();
        let cursor = Cursor::new(&mut buf);
        let mut zip = ZipWriter::new(cursor);
        
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated);
        
        // Generate manifest JSON
        let manifest = self.generate_manifest();
        zip.start_file("manifest.json", options)
            .map_err(|e| format!("Failed to create manifest.json: {}", e))?;
        zip.write_all(manifest.as_bytes())
            .map_err(|e| format!("Failed to write manifest.json: {}", e))?;
        
        // Export each visible mesh as OBJ
        for entry in &self.meshes {
            if !entry.visible {
                continue;
            }
            
            let obj_content = entry.mesh.to_obj();
            let filename = format!("meshes/{}.obj", entry.id);
            zip.start_file(&filename, options)
                .map_err(|e| format!("Failed to create {}: {}", filename, e))?;
            zip.write_all(obj_content.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", filename, e))?;
        }
        
        // Export camera
        let camera_json = self.generate_camera_json();
        zip.start_file("cameras/main.json", options)
            .map_err(|e| format!("Failed to create cameras/main.json: {}", e))?;
        zip.write_all(camera_json.as_bytes())
            .map_err(|e| format!("Failed to write cameras/main.json: {}", e))?;
        
        // Export light
        let light_json = self.generate_light_json();
        zip.start_file("lights/directional.json", options)
            .map_err(|e| format!("Failed to create lights/directional.json: {}", e))?;
        zip.write_all(light_json.as_bytes())
            .map_err(|e| format!("Failed to write lights/directional.json: {}", e))?;
        
        // Finalize ZIP
        zip.finish()
            .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;
        
        Ok(buf)
    }
    
    /// Generate manifest.json content
    fn generate_manifest(&self) -> String {
        let mut manifest = String::from("{\n");
        manifest.push_str("  \"format\": \"pls\",\n");
        manifest.push_str("  \"version\": \"1.0\",\n");
        manifest.push_str("  \"generator\": \"PolyLab 0.1.0\",\n");
        manifest.push_str(&format!("  \"scene\": {{\n"));
        manifest.push_str(&format!("    \"name\": \"{}\",\n", self.name));
        
        // Meshes array
        manifest.push_str("    \"meshes\": [\n");
        for (i, entry) in self.meshes.iter().filter(|e| e.visible).enumerate() {
            let comma = if i == self.meshes.len() - 1 { "" } else { "," };
            manifest.push_str(&format!("      {{\n"));
            manifest.push_str(&format!("        \"id\": \"{}\",\n", entry.id));
            manifest.push_str(&format!("        \"name\": \"{}\",\n", entry.name));
            manifest.push_str(&format!("        \"path\": \"meshes/{}.obj\",\n", entry.id));
            manifest.push_str(&format!("        \"visible\": {},\n", entry.visible));
            manifest.push_str(&format!("        \"vertices\": {},\n", entry.mesh.vertices.len()));
            manifest.push_str(&format!("        \"faces\": {}\n", entry.mesh.faces.len()));
            manifest.push_str(&format!("      }}{}\n", comma));
        }
        manifest.push_str("    ],\n");
        
        // Cameras array
        manifest.push_str("    \"cameras\": [\n");
        manifest.push_str("      {\n");
        manifest.push_str("        \"id\": \"main-camera\",\n");
        manifest.push_str("        \"name\": \"Main Camera\",\n");
        manifest.push_str("        \"path\": \"cameras/main.json\",\n");
        manifest.push_str("        \"active\": true\n");
        manifest.push_str("      }\n");
        manifest.push_str("    ],\n");
        
        // Lights array
        manifest.push_str("    \"lights\": [\n");
        manifest.push_str("      {\n");
        manifest.push_str("        \"id\": \"directional-light\",\n");
        manifest.push_str("        \"name\": \"Directional Light\",\n");
        manifest.push_str("        \"path\": \"lights/directional.json\"\n");
        manifest.push_str("      }\n");
        manifest.push_str("    ]\n");
        
        manifest.push_str("  }\n");
        manifest.push_str("}\n");
        
        manifest
    }
    
    /// Generate camera JSON
    fn generate_camera_json(&self) -> String {
        format!(
            "{{\n  \"type\": \"perspective\",\n  \"position\": [{}, {}, {}],\n  \"target\": [{}, {}, {}],\n  \"fov\": {},\n  \"near\": {},\n  \"far\": {}\n}}\n",
            self.camera.position.x, self.camera.position.y, self.camera.position.z,
            self.camera.target.x, self.camera.target.y, self.camera.target.z,
            self.camera.fov,
            self.camera.near,
            self.camera.far
        )
    }
    
    /// Generate light JSON
    fn generate_light_json(&self) -> String {
        format!(
            "{{\n  \"type\": \"directional\",\n  \"direction\": [{}, {}, {}],\n  \"color\": [{}, {}, {}],\n  \"intensity\": {}\n}}\n",
            self.light.direction.x, self.light.direction.y, self.light.direction.z,
            self.light.color.x, self.light.color.y, self.light.color.z,
            self.light.intensity
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::Vertex;
    #[test]
    fn test_scene_creation() {
        let scene = Scene::new("Test Scene".to_string());
        assert_eq!(scene.name, "Test Scene");
        assert_eq!(scene.meshes.len(), 0);
    }
    
    #[test]
    fn test_add_mesh() {
        let mut scene = Scene::new("Test".to_string());
        let mesh = Mesh::new();
        scene.add_mesh("mesh1".to_string(), "My Mesh".to_string(), mesh);
        assert_eq!(scene.meshes.len(), 1);
        assert_eq!(scene.meshes[0].id, "mesh1");
    }
    
    #[test]
    fn test_export_empty_scene() {
        let scene = Scene::new("Empty".to_string());
        let result = scene.export_to_pls();
        assert!(result.is_ok());
        let zip_data = result.unwrap();
        assert!(zip_data.len() > 0);
    }
}
