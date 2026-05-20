//! Example: Mesh → AIF → Simplification → Mesh
//!
//! This example demonstrates the complete workflow:
//! 1. Create a simple mesh
//! 2. Convert to AIF structure
//! 3. Perform edge collapse operations
//! 4. Convert back to mesh
//!
//! Run with: cargo run --example mesh_simplification

use polylab_compression::aif::AIF;
use polylab_core::mesh::{Mesh, Vertex, Face};
use glam::Vec3;

fn main() {
    println!("=== Mesh Simplification Example ===\n");

    // 1. Create a simple quad as 2 triangles
    let mut mesh = Mesh::new();
    
    mesh.vertices.push(Vertex {
        position: Vec3::new(0.0, 0.0, 0.0),
        normal: Some(Vec3::new(0.0, 0.0, 1.0)),
        tex_coords: Some((0.0, 0.0)),
        color: None,
    });
    mesh.vertices.push(Vertex {
        position: Vec3::new(1.0, 0.0, 0.0),
        normal: Some(Vec3::new(0.0, 0.0, 1.0)),
        tex_coords: Some((1.0, 0.0)),
        color: None,
    });
    mesh.vertices.push(Vertex {
        position: Vec3::new(1.0, 1.0, 0.0),
        normal: Some(Vec3::new(0.0, 0.0, 1.0)),
        tex_coords: Some((1.0, 1.0)),
        color: None,
    });
    mesh.vertices.push(Vertex {
        position: Vec3::new(0.0, 1.0, 0.0),
        normal: Some(Vec3::new(0.0, 0.0, 1.0)),
        tex_coords: Some((0.0, 1.0)),
        color: None,
    });

    mesh.faces.push(Face { vertices: [0, 1, 2] });
    mesh.faces.push(Face { vertices: [0, 2, 3] });

    println!("Original mesh:");
    println!("  Vertices: {}", mesh.vertices.len());
    println!("  Faces: {}", mesh.faces.len());

    // 2. Convert to AIF
    let mut aif = AIF::from_mesh(&mesh);
    println!("\nAIF structure:");
    println!("  Vertices: {}", aif.num_vertices());
    println!("  Edges: {}", aif.num_edges());
    println!("  Faces: {}", aif.num_faces());
    println!("  Corners: {}", aif.num_corners());

    // 3. Find and collapse an edge
    println!("\n--- Performing edge collapse ---");
    
    // Get all edge IDs (we'll collapse the diagonal edge in the quad)
    let edge_ids: Vec<_> = aif.edge_ids().collect();
    
    println!("Found {} edges in the mesh", edge_ids.len());
    
    // Try to collapse the first non-boundary edge
    let mut collapsed = false;
    for edge_id in edge_ids {
        if let Some(edge) = aif.edge(edge_id) {
            if !edge.is_boundary() {
                println!("Collapsing internal edge...");
                
                if let Some(_new_vertex) = aif.collapse_edge(edge_id) {
                    println!("  → Edge collapsed successfully");
                    collapsed = true;
                    break;
                }
            }
        }
    }

    if !collapsed {
        println!("  No suitable edge found to collapse");
    }

    println!("\nAIF after collapse:");
    println!("  Vertices: {}", aif.num_vertices());
    println!("  Edges: {}", aif.num_edges());
    println!("  Faces: {}", aif.num_faces());

    // 4. Convert back to mesh
    let simplified_mesh = aif.to_mesh();
    println!("\nSimplified mesh:");
    println!("  Vertices: {}", simplified_mesh.vertices.len());
    println!("  Faces: {}", simplified_mesh.faces.len());

    // 5. Show statistics
    let stats = aif.stats();
    println!("\nMemory statistics:");
    println!("  Total elements: {} vertices, {} edges, {} faces", 
        stats.num_vertices, stats.num_edges, stats.num_faces);
    println!("  Overall fill rate: {:.1}%", stats.fill_rate * 100.0);

    println!("\n✅ Example completed successfully!");
}
