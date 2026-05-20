//! Storage implementation for the AIF data structure using SlotMap.

use slotmap::SlotMap;
use super::types::*;

/// AIF (Adjacency and Incidence Framework) data structure.
///
/// Stores vertices, edges, faces, and corners using SlotMap for efficient
/// insertion, deletion, and access operations.
#[derive(Debug, Clone)]
pub struct AIF {
    /// Storage for vertices.
    pub(crate) vertices: SlotMap<VertexId, Vertex>,
    
    /// Storage for edges.
    pub(crate) edges: SlotMap<EdgeId, Edge>,
    
    /// Storage for faces.
    pub(crate) faces: SlotMap<FaceId, Face>,
    
    /// Storage for corners.
    pub(crate) corners: SlotMap<CornerId, Corner>,
    
    /// Counter for simplification operations (used for compaction).
    simplification_count: usize,
}

impl AIF {
    /// Creates a new empty AIF structure.
    pub fn new() -> Self {
        Self {
            vertices: SlotMap::with_key(),
            edges: SlotMap::with_key(),
            faces: SlotMap::with_key(),
            corners: SlotMap::with_key(),
            simplification_count: 0,
        }
    }
    
    /// Creates a new AIF structure with preallocated capacity.
    pub fn with_capacity(vertices: usize, edges: usize, faces: usize) -> Self {
        Self {
            vertices: SlotMap::with_capacity_and_key(vertices),
            edges: SlotMap::with_capacity_and_key(edges),
            faces: SlotMap::with_capacity_and_key(faces),
            corners: SlotMap::with_capacity_and_key(faces * 3), // Estimate: 3 corners per face
            simplification_count: 0,
        }
    }
    
    /// Returns the number of vertices.
    pub fn num_vertices(&self) -> usize {
        self.vertices.len()
    }
    
    /// Returns the number of edges.
    pub fn num_edges(&self) -> usize {
        self.edges.len()
    }
    
    /// Returns the number of faces.
    pub fn num_faces(&self) -> usize {
        self.faces.len()
    }
    
    /// Returns the number of corners.
    pub fn num_corners(&self) -> usize {
        self.corners.len()
    }
    
    /// Returns statistics about the mesh.
    pub fn stats(&self) -> MeshStats {
        MeshStats {
            num_vertices: self.num_vertices(),
            num_edges: self.num_edges(),
            num_faces: self.num_faces(),
            num_corners: self.num_corners(),
            vertex_capacity: self.vertices.capacity(),
            edge_capacity: self.edges.capacity(),
            face_capacity: self.faces.capacity(),
            fill_rate: self.fill_rate(),
        }
    }
    
    /// Returns the fill rate (ratio of used slots to capacity).
    pub fn fill_rate(&self) -> f32 {
        let total_used = self.num_vertices() + self.num_edges() + self.num_faces();
        let total_capacity = self.vertices.capacity() + self.edges.capacity() + self.faces.capacity();
        
        if total_capacity == 0 {
            1.0
        } else {
            total_used as f32 / total_capacity as f32
        }
    }
    
    /// Compacts the internal storage if the fill rate is too low.
    pub fn compact_if_needed(&mut self) {
        const MIN_FILL_RATE: f32 = 0.5;
        const MIN_CAPACITY: usize = 1000;
        
        // Only compact if we have significant capacity and low fill rate
        if self.vertices.capacity() > MIN_CAPACITY && self.fill_rate() < MIN_FILL_RATE {
            self.compact();
        }
    }
    
    /// Compacts all internal storage by rebuilding SlotMaps.
    ///
    /// This operation is O(n) and should be called periodically during
    /// simplification to reclaim memory.
    pub fn compact(&mut self) {
        use std::collections::HashMap;
        
        // Compact vertices
        let mut new_vertices = SlotMap::with_capacity_and_key(self.num_vertices());
        let mut vertex_map = HashMap::new();
        
        for (old_id, vertex) in self.vertices.drain() {
            let new_id = new_vertices.insert(vertex);
            vertex_map.insert(old_id, new_id);
        }
        
        self.vertices = new_vertices;
        
        // Compact edges and update vertex references
        let mut new_edges = SlotMap::with_capacity_and_key(self.num_edges());
        let mut edge_map = HashMap::new();
        
        for (old_id, mut edge) in self.edges.drain() {
            edge.vertex1 = vertex_map[&edge.vertex1];
            edge.vertex2 = vertex_map[&edge.vertex2];
            let new_id = new_edges.insert(edge);
            edge_map.insert(old_id, new_id);
        }
        
        self.edges = new_edges;
        
        // Compact faces and update edge references
        let mut new_faces = SlotMap::with_capacity_and_key(self.num_faces());
        let mut face_map = HashMap::new();
        
        for (old_id, mut face) in self.faces.drain() {
            for edge_id in &mut face.edges {
                *edge_id = edge_map[edge_id];
            }
            let new_id = new_faces.insert(face);
            face_map.insert(old_id, new_id);
        }
        
        self.faces = new_faces;
        
        // Compact corners and update references
        let mut new_corners = SlotMap::with_capacity_and_key(self.num_corners());
        
        for (_old_id, mut corner) in self.corners.drain() {
            corner.vertex = vertex_map[&corner.vertex];
            corner.face = face_map[&corner.face];
            new_corners.insert(corner);
        }
        
        self.corners = new_corners;
        
        // Update vertex edge lists
        for vertex in self.vertices.values_mut() {
            for edge_id in &mut vertex.edges {
                *edge_id = edge_map[edge_id];
            }
        }
        
        // Update edge face lists
        for edge in self.edges.values_mut() {
            for face_id in &mut edge.faces {
                *face_id = face_map[face_id];
            }
        }
        
        // Update face corner lists
        for face in self.faces.values_mut() {
            // Note: corner IDs are not preserved in face.corners
            // This would need additional tracking if required
            face.corners.clear();
        }
    }
    
    /// Increments the simplification counter and triggers compaction if needed.
    pub(crate) fn record_simplification(&mut self) {
        self.simplification_count += 1;
        
        // Compact every 10,000 operations
        if self.simplification_count % 10_000 == 0 {
            self.compact_if_needed();
        }
    }
}

impl Default for AIF {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics about the mesh structure.
#[derive(Debug, Clone)]
pub struct MeshStats {
    pub num_vertices: usize,
    pub num_edges: usize,
    pub num_faces: usize,
    pub num_corners: usize,
    pub vertex_capacity: usize,
    pub edge_capacity: usize,
    pub face_capacity: usize,
    pub fill_rate: f32,
}

impl std::fmt::Display for MeshStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Mesh: {} vertices, {} edges, {} faces (fill rate: {:.1}%)",
            self.num_vertices,
            self.num_edges,
            self.num_faces,
            self.fill_rate * 100.0
        )
    }
}
