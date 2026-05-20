//! Core types for the AIF data structure.

use glam::Vec3;
use slotmap::new_key_type;

// Define opaque key types for SlotMap
new_key_type! {
    /// Unique identifier for a vertex.
    pub struct VertexId;
    
    /// Unique identifier for an edge.
    pub struct EdgeId;
    
    /// Unique identifier for a face.
    pub struct FaceId;
    
    /// Unique identifier for a corner (vertex-face association).
    pub struct CornerId;
}

/// Geometric vertex with position.
#[derive(Debug, Clone)]
pub struct Vertex {
    /// 3D position in space.
    pub position: Vec3,
    
    /// List of incident edges (edges that have this vertex as endpoint).
    pub edges: Vec<EdgeId>,
}

impl Vertex {
    /// Creates a new vertex at the given position.
    pub fn new(position: Vec3) -> Self {
        Self {
            position,
            edges: Vec::new(),
        }
    }
}

/// Topological edge connecting two vertices.
#[derive(Debug, Clone)]
pub struct Edge {
    /// First endpoint vertex.
    pub vertex1: VertexId,
    
    /// Second endpoint vertex.
    pub vertex2: VertexId,
    
    /// Faces incident to this edge (0, 1, or 2+ for non-manifold).
    pub faces: Vec<FaceId>,
}

impl Edge {
    /// Creates a new edge between two vertices.
    pub fn new(v1: VertexId, v2: VertexId) -> Self {
        Self {
            vertex1: v1,
            vertex2: v2,
            faces: Vec::new(),
        }
    }
    
    /// Returns true if the edge is a boundary edge (only one incident face).
    pub fn is_boundary(&self) -> bool {
        self.faces.len() == 1
    }
    
    /// Returns true if the edge is manifold (at most 2 incident faces).
    pub fn is_manifold(&self) -> bool {
        self.faces.len() <= 2
    }
    
    /// Returns true if the edge has a specific vertex as endpoint.
    pub fn has_vertex(&self, vertex_id: VertexId) -> bool {
        self.vertex1 == vertex_id || self.vertex2 == vertex_id
    }
    
    /// Returns the other vertex of the edge.
    pub fn other_vertex(&self, vertex_id: VertexId) -> Option<VertexId> {
        if self.vertex1 == vertex_id {
            Some(self.vertex2)
        } else if self.vertex2 == vertex_id {
            Some(self.vertex1)
        } else {
            None
        }
    }
}

/// Polygonal face defined by a cycle of edges.
#[derive(Debug, Clone)]
pub struct Face {
    /// Ordered list of edges forming the face boundary (CCW).
    pub edges: Vec<EdgeId>,
    
    /// Corners of this face (for per-vertex-per-face attributes).
    pub corners: Vec<CornerId>,
}

impl Face {
    /// Creates a new face from a list of edges.
    pub fn new(edges: Vec<EdgeId>) -> Self {
        Self {
            edges,
            corners: Vec::new(),
        }
    }
    
    /// Returns the number of vertices/edges in the face.
    pub fn valence(&self) -> usize {
        self.edges.len()
    }
    
    /// Returns true if the face is a triangle.
    pub fn is_triangle(&self) -> bool {
        self.edges.len() == 3
    }
    
    /// Returns true if the face is a quad.
    pub fn is_quad(&self) -> bool {
        self.edges.len() == 4
    }
}

/// Corner represents a vertex within the context of a face.
/// Used to store per-vertex-per-face attributes (UV coordinates, normals, etc.).
#[derive(Debug, Clone)]
pub struct Corner {
    /// The vertex this corner refers to.
    pub vertex: VertexId,
    
    /// The face this corner belongs to.
    pub face: FaceId,
    
    /// UV texture coordinates (optional).
    pub uv: Option<[f32; 2]>,
    
    /// Normal vector (optional).
    pub normal: Option<Vec3>,
}

impl Corner {
    /// Creates a new corner.
    pub fn new(vertex: VertexId, face: FaceId) -> Self {
        Self {
            vertex,
            face,
            uv: None,
            normal: None,
        }
    }
    
    /// Sets UV coordinates.
    pub fn with_uv(mut self, uv: [f32; 2]) -> Self {
        self.uv = Some(uv);
        self
    }
    
    /// Sets normal vector.
    pub fn with_normal(mut self, normal: Vec3) -> Self {
        self.normal = Some(normal);
        self
    }
}
