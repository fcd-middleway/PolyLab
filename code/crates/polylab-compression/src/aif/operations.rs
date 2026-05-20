//! Topological operations for mesh modification.
//!
//! This module contains all operations that modify the mesh structure:
//! - Adding/removing vertices, edges, faces
//! - Edge collapse (critical for decimation)
//! - Mesh simplification operations
//!
//! These operations maintain topological consistency and update all
//! incidence relations automatically.

use super::types::*;
use super::storage::AIF;
use glam::Vec3;

/// Implementation of topological modification operations on AIF meshes.
impl AIF {
    /// Adds a new vertex to the mesh.
    ///
    /// # Arguments
    /// * `position` - 3D position of the vertex
    ///
    /// # Returns
    /// The ID of the newly created vertex
    /// # Returns
    /// The ID of the newly created vertex
    pub fn add_vertex(&mut self, position: Vec3) -> VertexId {
        let vertex = Vertex::new(position);
        self.vertices.insert(vertex)
    }
    
    /// Removes a vertex from the mesh.
    ///
    /// Automatically removes all incident edges and faces to maintain consistency.
    ///
    /// # Arguments
    /// * `vertex_id` - ID of the vertex to remove
    pub fn remove_vertex(&mut self, vertex_id: VertexId) {
        if let Some(vertex) = self.vertices.get(vertex_id) {
            // Remove all incident edges (which will also remove incident faces)
            let edges_to_remove: Vec<EdgeId> = vertex.edges.clone();
            
            for edge_id in edges_to_remove {
                self.remove_edge(edge_id);
            }
        }
        
        // Remove the vertex itself
        self.vertices.remove(vertex_id);
    }
    
    /// Adds a new edge between two vertices.
    ///
    /// If an edge already exists between these vertices, returns the existing edge.
    /// This ensures no duplicate edges in the mesh.
    ///
    /// # Arguments
    /// * `v1` - First vertex ID
    /// * `v2` - Second vertex ID
    ///
    /// # Returns
    /// - `Some(EdgeId)` if edge was created or already exists
    /// - `None` if either vertex doesn't exist
    pub fn add_edge(&mut self, v1: VertexId, v2: VertexId) -> Option<EdgeId> {
        // Check that both vertices exist
        if !self.vertices.contains_key(v1) || !self.vertices.contains_key(v2) {
            return None;
        }
        
        // Check if edge already exists
        if let Some(existing_edge_id) = self.find_edge(v1, v2) {
            return Some(existing_edge_id);
        }
        
        // Create the edge
        let edge = Edge::new(v1, v2);
        let edge_id = self.edges.insert(edge);
        
        // Add edge to both vertices
        if let Some(vertex) = self.vertices.get_mut(v1) {
            vertex.edges.push(edge_id);
        }
        
        if let Some(vertex) = self.vertices.get_mut(v2) {
            vertex.edges.push(edge_id);
        }
        
        Some(edge_id)
    }
    
    /// Removes an edge from the mesh.
    ///
    /// Automatically removes all incident faces to maintain consistency.
    ///
    /// # Arguments
    /// * `edge_id` - ID of the edge to remove
    pub fn remove_edge(&mut self, edge_id: EdgeId) {
        if let Some(edge) = self.edges.get(edge_id) {
            let v1 = edge.vertex1;
            let v2 = edge.vertex2;
            
            // Remove all incident faces
            let faces_to_remove: Vec<FaceId> = edge.faces.clone();
            for face_id in faces_to_remove {
                self.remove_face(face_id);
            }
            
            // Remove edge from vertex1
            if let Some(vertex) = self.vertices.get_mut(v1) {
                vertex.edges.retain(|&e| e != edge_id);
            }
            
            // Remove edge from vertex2
            if let Some(vertex) = self.vertices.get_mut(v2) {
                vertex.edges.retain(|&e| e != edge_id);
            }
        }
        
        // Remove the edge itself
        self.edges.remove(edge_id);
    }
    
    /// Adds a new face from a list of edges.
    ///
    /// The edges must form a closed loop. Updates all edges to reference this face.
    ///
    /// # Arguments
    /// * `edges` - Ordered list of edge IDs forming the face boundary
    ///
    /// # Returns
    /// - `Some(FaceId)` if face was created successfully
    /// - `None` if edges list is empty or any edge doesn't exist
    pub fn add_face(&mut self, edges: Vec<EdgeId>) -> Option<FaceId> {
        if edges.is_empty() {
            return None;
        }
        
        // Verify all edges exist
        for edge_id in &edges {
            if !self.edges.contains_key(*edge_id) {
                return None;
            }
        }
        
        // Create the face
        let face = Face::new(edges.clone());
        let face_id = self.faces.insert(face);
        
        // Add face to all edges
        for edge_id in edges {
            if let Some(edge) = self.edges.get_mut(edge_id) {
                edge.faces.push(face_id);
            }
        }
        
        Some(face_id)
    }
    
    /// Removes a face from the mesh.
    ///
    /// Automatically removes all corners associated with this face.
    ///
    /// # Arguments
    /// * `face_id` - ID of the face to remove
    pub fn remove_face(&mut self, face_id: FaceId) {
        if let Some(face) = self.faces.get(face_id) {
            // Remove face from all edges
            let edges: Vec<EdgeId> = face.edges.clone();
            for edge_id in edges {
                if let Some(edge) = self.edges.get_mut(edge_id) {
                    edge.faces.retain(|&f| f != face_id);
                }
            }
            
            // Remove corners
            let corners: Vec<CornerId> = face.corners.clone();
            for corner_id in corners {
                self.corners.remove(corner_id);
            }
        }
        
        // Remove the face itself
        self.faces.remove(face_id);
    }
    
    /// Collapses an edge, merging its two vertices into one.
    ///
    /// This is the critical operation for mesh decimation. The new vertex is placed
    /// at the midpoint of the collapsed edge. All edges incident to the original
    /// vertices are reconnected to the new vertex. Degenerate edges (loops) are
    /// automatically removed.
    ///
    /// # Arguments
    /// * `edge_id` - ID of the edge to collapse
    ///
    /// # Returns
    /// - `Some(VertexId)` - ID of the new merged vertex
    /// - `None` if the edge doesn't exist
    ///
    /// # Side Effects
    /// - Records a simplification operation (triggers compaction if needed)
    /// - May remove incident faces
    /// - Removes degenerate edges
    pub fn collapse_edge(&mut self, edge_id: EdgeId) -> Option<VertexId> {
        // Get edge vertices
        let edge = self.edges.get(edge_id)?;
        let v1_id = edge.vertex1;
        let v2_id = edge.vertex2;
        
        // Get vertex positions and edge lists BEFORE any mutations
        let v1_pos = self.vertices.get(v1_id)?.position;
        let v2_pos = self.vertices.get(v2_id)?.position;
        let v1_edges: Vec<EdgeId> = self.vertices.get(v1_id)?.edges.iter().copied()
            .filter(|&e| e != edge_id)
            .collect();
        let v2_edges: Vec<EdgeId> = self.vertices.get(v2_id)?.edges.iter().copied()
            .filter(|&e| e != edge_id)
            .collect();
        
        // Compute new vertex position (midpoint)
        let new_position = (v1_pos + v2_pos) * 0.5;
        
        // Create new vertex
        let new_vertex_id = self.add_vertex(new_position);
        
        // Reconnect v1 edges to new vertex
        for edge_id_to_update in v1_edges {
            if let Some(edge) = self.edges.get_mut(edge_id_to_update) {
                if edge.vertex1 == v1_id {
                    edge.vertex1 = new_vertex_id;
                } else if edge.vertex2 == v1_id {
                    edge.vertex2 = new_vertex_id;
                }
                
                // Add edge to new vertex
                if let Some(new_vertex) = self.vertices.get_mut(new_vertex_id) {
                    if !new_vertex.edges.contains(&edge_id_to_update) {
                        new_vertex.edges.push(edge_id_to_update);
                    }
                }
            }
        }
        
        // Reconnect v2 edges to new vertex
        for edge_id_to_update in v2_edges {
            if let Some(edge) = self.edges.get_mut(edge_id_to_update) {
                if edge.vertex1 == v2_id {
                    edge.vertex1 = new_vertex_id;
                } else if edge.vertex2 == v2_id {
                    edge.vertex2 = new_vertex_id;
                }
                
                // Add edge to new vertex
                if let Some(new_vertex) = self.vertices.get_mut(new_vertex_id) {
                    if !new_vertex.edges.contains(&edge_id_to_update) {
                        new_vertex.edges.push(edge_id_to_update);
                    }
                }
            }
        }
        
        // Remove degenerate edges (edges that now connect new_vertex to itself)
        let edges_to_check: Vec<EdgeId> = self.vertices.get(new_vertex_id)?.edges.clone();
        for edge_id_to_check in edges_to_check {
            if let Some(edge) = self.edges.get(edge_id_to_check) {
                if edge.vertex1 == edge.vertex2 {
                    self.remove_edge(edge_id_to_check);
                }
            }
        }
        
        // Remove collapsed edge first (before vertices)
        self.remove_edge(edge_id);
        
        // Remove old vertices directly (without removing their edges since we already reconnected them)
        self.vertices.remove(v1_id);
        self.vertices.remove(v2_id);
        
        // Record simplification for compaction tracking
        self.record_simplification();
        
        Some(new_vertex_id)
    }
}
