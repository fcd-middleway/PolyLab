//! Topological queries on the AIF structure.
//!
//! This module contains all read-only queries for navigating and inspecting
//! the mesh topology:
//! - Direct access to vertices, edges, faces, corners
//! - Incidence queries (vertex→edges, edge→faces, etc.)
//! - Adjacency queries (neighboring edges, adjacent faces)
//! - Geometric queries (edge length, vertex valence)
//! - Boundary detection
//!
//! All queries are non-mutating and maintain const-correctness.

use super::types::*;
use super::storage::AIF;

/// Implementation of topological query operations on AIF meshes.
impl AIF {
    /// Gets a vertex by ID.
    ///
    /// # Arguments
    /// * `id` - Vertex identifier
    ///
    /// # Returns
    /// Reference to the vertex if it exists, None otherwise
    pub fn vertex(&self, id: VertexId) -> Option<&Vertex> {
        self.vertices.get(id)
    }
    
    /// Gets an edge by ID.
    ///
    /// # Arguments
    /// * `id` - Edge identifier
    ///
    /// # Returns
    /// Reference to the edge if it exists, None otherwise
    pub fn edge(&self, id: EdgeId) -> Option<&Edge> {
        self.edges.get(id)
    }
    
    /// Gets a face by ID.
    ///
    /// # Arguments
    /// * `id` - Face identifier
    ///
    /// # Returns
    /// Reference to the face if it exists, None otherwise
    pub fn face(&self, id: FaceId) -> Option<&Face> {
        self.faces.get(id)
    }
    
    /// Gets a corner by ID.
    ///
    /// # Arguments
    /// * `id` - Corner identifier
    ///
    /// # Returns
    /// Reference to the corner if it exists, None otherwise
    pub fn corner(&self, id: CornerId) -> Option<&Corner> {
        self.corners.get(id)
    }
    
    /// Returns all edges incident to a vertex.
    ///
    /// # Arguments
    /// * `vertex_id` - Vertex identifier
    ///
    /// # Returns
    /// Vector of edge IDs, empty if vertex doesn't exist
    pub fn vertex_edges(&self, vertex_id: VertexId) -> Vec<EdgeId> {
        self.vertices
            .get(vertex_id)
            .map(|v| v.edges.clone())
            .unwrap_or_default()
    }
    
    /// Returns all faces incident to a vertex.
    ///
    /// Collects faces from all edges incident to the vertex.
    ///
    /// # Arguments
    /// * `vertex_id` - Vertex identifier
    ///
    /// # Returns
    /// Vector of face IDs (no duplicates)
    pub fn vertex_faces(&self, vertex_id: VertexId) -> Vec<FaceId> {
        let mut faces = Vec::new();
        
        if let Some(vertex) = self.vertices.get(vertex_id) {
            for edge_id in &vertex.edges {
                if let Some(edge) = self.edges.get(*edge_id) {
                    for face_id in &edge.faces {
                        if !faces.contains(face_id) {
                            faces.push(*face_id);
                        }
                    }
                }
            }
        }
        
        faces
    }
    
    /// Returns the two vertices of an edge.
    ///
    /// # Arguments
    /// * `edge_id` - Edge identifier
    ///
    /// # Returns
    /// Tuple of (vertex1, vertex2) if edge exists, None otherwise
    pub fn edge_vertices(&self, edge_id: EdgeId) -> Option<(VertexId, VertexId)> {
        self.edges.get(edge_id).map(|e| (e.vertex1, e.vertex2))
    }
    
    /// Returns all faces incident to an edge.
    ///
    /// # Arguments
    /// * `edge_id` - Edge identifier
    ///
    /// # Returns
    /// Vector of face IDs (1 for boundary edges, 2+ for manifold/complex edges)
    pub fn edge_faces(&self, edge_id: EdgeId) -> Vec<FaceId> {
        self.edges
            .get(edge_id)
            .map(|e| e.faces.clone())
            .unwrap_or_default()
    }
    
    /// Returns the vertices of a face in order.
    ///
    /// Traverses the face edges to extract vertex sequence.
    ///
    /// # Arguments
    /// * `face_id` - Face identifier
    ///
    /// # Returns
    /// Ordered vector of vertex IDs forming the face boundary
    pub fn face_vertices(&self, face_id: FaceId) -> Vec<VertexId> {
        let mut vertices = Vec::new();
        
        if let Some(face) = self.faces.get(face_id) {
            for edge_id in &face.edges {
                if let Some(edge) = self.edges.get(*edge_id) {
                    // Add first vertex if not already in list
                    if !vertices.contains(&edge.vertex1) {
                        vertices.push(edge.vertex1);
                    }
                }
            }
        }
        
        vertices
    }
    
    /// Returns the edges of a face.
    ///
    /// # Arguments
    /// * `face_id` - Face identifier
    ///
    /// # Returns
    /// Ordered vector of edge IDs forming the face boundary
    pub fn face_edges(&self, face_id: FaceId) -> Vec<EdgeId> {
        self.faces
            .get(face_id)
            .map(|f| f.edges.clone())
            .unwrap_or_default()
    }
    
    /// Finds the edge connecting two vertices.
    ///
    /// # Arguments
    /// * `v1` - First vertex ID
    /// * `v2` - Second vertex ID
    ///
    /// # Returns
    /// Edge ID if such an edge exists, None otherwise
    pub fn find_edge(&self, v1: VertexId, v2: VertexId) -> Option<EdgeId> {
        if let Some(vertex) = self.vertices.get(v1) {
            for edge_id in &vertex.edges {
                if let Some(edge) = self.edges.get(*edge_id) {
                    if edge.has_vertex(v2) {
                        return Some(*edge_id);
                    }
                }
            }
        }
        None
    }
    
    /// Returns edges adjacent to a given edge (sharing a vertex).
    ///
    /// # Arguments
    /// * `edge_id` - Edge identifier
    ///
    /// # Returns
    /// Vector of adjacent edge IDs (excludes the input edge)
    pub fn adjacent_edges(&self, edge_id: EdgeId) -> Vec<EdgeId> {
        let mut adjacent = Vec::new();
        
        if let Some(edge) = self.edges.get(edge_id) {
            // Get edges from vertex1
            if let Some(v1) = self.vertices.get(edge.vertex1) {
                for adj_edge_id in &v1.edges {
                    if *adj_edge_id != edge_id && !adjacent.contains(adj_edge_id) {
                        adjacent.push(*adj_edge_id);
                    }
                }
            }
            
            // Get edges from vertex2
            if let Some(v2) = self.vertices.get(edge.vertex2) {
                for adj_edge_id in &v2.edges {
                    if *adj_edge_id != edge_id && !adjacent.contains(adj_edge_id) {
                        adjacent.push(*adj_edge_id);
                    }
                }
            }
        }
        
        adjacent
    }
    
    /// Computes the Euclidean length of an edge.
    ///
    /// # Arguments
    /// * `edge_id` - Edge identifier
    ///
    /// # Returns
    /// Edge length if edge exists, None otherwise
    pub fn edge_length(&self, edge_id: EdgeId) -> Option<f32> {
        let edge = self.edges.get(edge_id)?;
        let v1 = self.vertices.get(edge.vertex1)?;
        let v2 = self.vertices.get(edge.vertex2)?;
        
        Some((v1.position - v2.position).length())
    }
    
    /// Returns the valence (degree) of a vertex.
    ///
    /// The valence is the number of incident edges.
    ///
    /// # Arguments
    /// * `vertex_id` - Vertex identifier
    ///
    /// # Returns
    /// Number of edges connected to this vertex
    pub fn vertex_valence(&self, vertex_id: VertexId) -> usize {
        self.vertices
            .get(vertex_id)
            .map(|v| v.edges.len())
            .unwrap_or(0)
    }
    
    /// Checks if an edge is on the boundary.
    ///
    /// An edge is on the boundary if it has exactly one incident face.
    ///
    /// # Arguments
    /// * `edge_id` - Edge identifier
    ///
    /// # Returns
    /// true if boundary edge, false otherwise
    pub fn is_boundary_edge(&self, edge_id: EdgeId) -> bool {
        self.edges
            .get(edge_id)
            .map(|e| e.is_boundary())
            .unwrap_or(false)
    }
    
    /// Checks if a vertex is on the boundary.
    ///
    /// A vertex is on the boundary if at least one incident edge is a boundary edge.
    ///
    /// # Arguments
    /// * `vertex_id` - Vertex identifier
    ///
    /// # Returns
    /// true if boundary vertex, false otherwise
    pub fn is_boundary_vertex(&self, vertex_id: VertexId) -> bool {
        if let Some(vertex) = self.vertices.get(vertex_id) {
            for edge_id in &vertex.edges {
                if let Some(edge) = self.edges.get(*edge_id) {
                    if edge.is_boundary() {
                        return true;
                    }
                }
            }
        }
        false
    }
}

// Additional iteration methods
impl AIF {
    /// Returns an iterator over all vertex IDs.
    pub fn vertex_ids(&self) -> impl Iterator<Item = VertexId> + '_ {
        self.vertices.keys()
    }

    /// Returns an iterator over all edge IDs.
    pub fn edge_ids(&self) -> impl Iterator<Item = EdgeId> + '_ {
        self.edges.keys()
    }

    /// Returns an iterator over all face IDs.
    pub fn face_ids(&self) -> impl Iterator<Item = FaceId> + '_ {
        self.faces.keys()
    }

    /// Returns an iterator over all corner IDs.
    pub fn corner_ids(&self) -> impl Iterator<Item = CornerId> + '_ {
        self.corners.keys()
    }
}
