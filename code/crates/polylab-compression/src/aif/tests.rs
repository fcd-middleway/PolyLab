//! Tests for the AIF data structure.

use super::*;
use glam::Vec3;

#[test]
fn test_create_empty_aif() {
    let aif = AIF::new();
    assert_eq!(aif.num_vertices(), 0);
    assert_eq!(aif.num_edges(), 0);
    assert_eq!(aif.num_faces(), 0);
}

#[test]
fn test_add_vertices() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    
    assert_eq!(aif.num_vertices(), 3);
    assert!(aif.vertex(v1).is_some());
    assert!(aif.vertex(v2).is_some());
    assert!(aif.vertex(v3).is_some());
}

#[test]
fn test_add_edge() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    
    let edge = aif.add_edge(v1, v2);
    assert!(edge.is_some());
    assert_eq!(aif.num_edges(), 1);
    
    let edge_id = edge.unwrap();
    let edge_data = aif.edge(edge_id).unwrap();
    assert!(edge_data.has_vertex(v1));
    assert!(edge_data.has_vertex(v2));
}

#[test]
fn test_add_duplicate_edge() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    
    let edge1 = aif.add_edge(v1, v2).unwrap();
    let edge2 = aif.add_edge(v1, v2).unwrap();
    
    // Should return the same edge
    assert_eq!(edge1, edge2);
    assert_eq!(aif.num_edges(), 1);
}

#[test]
fn test_find_edge() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    
    let e1 = aif.add_edge(v1, v2).unwrap();
    aif.add_edge(v2, v3).unwrap();
    
    // Should find existing edge
    assert_eq!(aif.find_edge(v1, v2), Some(e1));
    assert_eq!(aif.find_edge(v2, v1), Some(e1)); // Order shouldn't matter
    
    // Should not find non-existent edge
    assert_eq!(aif.find_edge(v1, v3), None);
}

#[test]
fn test_edge_length() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(3.0, 4.0, 0.0));
    
    let edge = aif.add_edge(v1, v2).unwrap();
    let length = aif.edge_length(edge).unwrap();
    
    assert!((length - 5.0).abs() < 0.001); // 3-4-5 triangle
}

#[test]
fn test_vertex_edges() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    
    let e1 = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v1, v3).unwrap();
    
    let v1_edges = aif.vertex_edges(v1);
    assert_eq!(v1_edges.len(), 2);
    assert!(v1_edges.contains(&e1));
    assert!(v1_edges.contains(&e2));
    
    let v2_edges = aif.vertex_edges(v2);
    assert_eq!(v2_edges.len(), 1);
    assert!(v2_edges.contains(&e1));
}

#[test]
fn test_vertex_valence() {
    let mut aif = AIF::new();
    
    let v_center = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v1 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(-1.0, 0.0, 0.0));
    
    aif.add_edge(v_center, v1).unwrap();
    aif.add_edge(v_center, v2).unwrap();
    aif.add_edge(v_center, v3).unwrap();
    
    assert_eq!(aif.vertex_valence(v_center), 3);
    assert_eq!(aif.vertex_valence(v1), 1);
}

#[test]
fn test_add_triangle_face() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    
    let e1 = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v2, v3).unwrap();
    let e3 = aif.add_edge(v3, v1).unwrap();
    
    let face = aif.add_face(vec![e1, e2, e3]);
    assert!(face.is_some());
    assert_eq!(aif.num_faces(), 1);
    
    let face_id = face.unwrap();
    let face_data = aif.face(face_id).unwrap();
    assert!(face_data.is_triangle());
    assert_eq!(face_data.valence(), 3);
}

#[test]
fn test_edge_faces() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    let v4 = aif.add_vertex(Vec3::new(1.0, 1.0, 0.0));
    
    let e_shared = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v2, v3).unwrap();
    let e3 = aif.add_edge(v3, v1).unwrap();
    let e4 = aif.add_edge(v2, v4).unwrap();
    let e5 = aif.add_edge(v4, v1).unwrap();
    
    let f1 = aif.add_face(vec![e_shared, e2, e3]).unwrap();
    let f2 = aif.add_face(vec![e_shared, e4, e5]).unwrap();
    
    let shared_faces = aif.edge_faces(e_shared);
    assert_eq!(shared_faces.len(), 2);
    assert!(shared_faces.contains(&f1));
    assert!(shared_faces.contains(&f2));
    
    // Edge should not be boundary anymore
    assert!(!aif.is_boundary_edge(e_shared));
    
    // Other edges should be boundary
    assert!(aif.is_boundary_edge(e2));
}

#[test]
fn test_remove_vertex() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    
    let edge = aif.add_edge(v1, v2).unwrap();
    
    assert_eq!(aif.num_vertices(), 2);
    assert_eq!(aif.num_edges(), 1);
    
    aif.remove_vertex(v1);
    
    assert_eq!(aif.num_vertices(), 1);
    assert_eq!(aif.num_edges(), 0); // Edge should be removed too
    assert!(aif.vertex(v1).is_none());
    assert!(aif.edge(edge).is_none());
}

#[test]
fn test_remove_edge() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    
    let edge = aif.add_edge(v1, v2).unwrap();
    
    assert_eq!(aif.num_edges(), 1);
    assert_eq!(aif.vertex_valence(v1), 1);
    
    aif.remove_edge(edge);
    
    assert_eq!(aif.num_edges(), 0);
    assert_eq!(aif.vertex_valence(v1), 0); // Edge removed from vertex
    assert!(aif.vertex(v1).is_some()); // Vertex still exists
}

#[test]
fn test_remove_face() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    
    let e1 = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v2, v3).unwrap();
    let e3 = aif.add_edge(v3, v1).unwrap();
    
    let face = aif.add_face(vec![e1, e2, e3]).unwrap();
    
    assert_eq!(aif.num_faces(), 1);
    assert_eq!(aif.edge_faces(e1).len(), 1);
    
    aif.remove_face(face);
    
    assert_eq!(aif.num_faces(), 0);
    assert_eq!(aif.edge_faces(e1).len(), 0); // Face removed from edges
    assert!(aif.edge(e1).is_some()); // Edges still exist
}

#[test]
fn test_collapse_edge() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(2.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(1.0, 2.0, 0.0));
    
    let e1 = aif.add_edge(v1, v2).unwrap();
    aif.add_edge(v1, v3).unwrap();
    aif.add_edge(v2, v3).unwrap();
    
    assert_eq!(aif.num_vertices(), 3);
    assert_eq!(aif.num_edges(), 3);
    
    let new_vertex = aif.collapse_edge(e1);
    assert!(new_vertex.is_some());
    
    // Should have one fewer vertex and edge
    assert_eq!(aif.num_vertices(), 2); // v1 and v2 removed, new_vertex added
    assert_eq!(aif.num_edges(), 2); // e1 removed
    
    // Check new vertex position (midpoint)
    let new_v = aif.vertex(new_vertex.unwrap()).unwrap();
    assert!((new_v.position.x - 1.0).abs() < 0.001);
    assert!((new_v.position.y - 0.0).abs() < 0.001);
}

#[test]
fn test_adjacent_edges() {
    let mut aif = AIF::new();
    
    let v1 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    let v4 = aif.add_vertex(Vec3::new(1.0, 1.0, 0.0));
    
    let e1 = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v1, v3).unwrap();
    let e3 = aif.add_edge(v2, v4).unwrap();
    
    let adjacent = aif.adjacent_edges(e1);
    assert_eq!(adjacent.len(), 2);
    assert!(adjacent.contains(&e2)); // Shares v1
    assert!(adjacent.contains(&e3)); // Shares v2
}

#[test]
fn test_stats() {
    let mut aif = AIF::with_capacity(100, 200, 100);
    
    aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    
    let stats = aif.stats();
    assert_eq!(stats.num_vertices, 2);
    assert_eq!(stats.num_edges, 0);
    assert!(stats.vertex_capacity >= 100);
}

#[test]
fn test_compaction() {
    let mut aif = AIF::with_capacity(1000, 1000, 1000);
    
    // Add many vertices
    let vertices: Vec<VertexId> = (0..100)
        .map(|i| aif.add_vertex(Vec3::new(i as f32, 0.0, 0.0)))
        .collect();
    
    // Remove most of them
    for v_id in &vertices[0..90] {
        aif.remove_vertex(*v_id);
    }
    
    assert_eq!(aif.num_vertices(), 10);
    let initial_capacity = aif.vertices.capacity();
    
    // Force compaction
    aif.compact();
    
    let final_capacity = aif.vertices.capacity();
    assert!(final_capacity < initial_capacity);
    assert_eq!(aif.num_vertices(), 10); // Still has same number of vertices
}
