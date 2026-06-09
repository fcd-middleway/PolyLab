#!/usr/bin/env python3
"""
Generate test meshes for compression algorithm validation.
Generates a variety of mesh configurations to test edge collapse robustness.
"""
import os
import math
from pathlib import Path

def write_obj(filename, vertices, faces):
    """Write OBJ file with vertices and faces."""
    with open(filename, 'w') as f:
        f.write("# Generated test mesh for PolyLab compression validation\n")
        f.write(f"# Vertices: {len(vertices)}\n")
        f.write(f"# Faces: {len(faces)}\n\n")
        
        # Write vertices
        for v in vertices:
            f.write(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
        
        f.write("\n")
        
        # Write faces (1-indexed in OBJ format)
        for face in faces:
            face_str = " ".join(str(i+1) for i in face)
            f.write(f"f {face_str}\n")

# ============================================================================
# Manifold Simple
# ============================================================================

def generate_triangle():
    """Single triangle (simplest mesh)."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [[0, 1, 2]]
    return vertices, faces

def generate_quad():
    """Single quad (4-sided polygon)."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [1.0, 1.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [[0, 1, 2, 3]]
    return vertices, faces

def generate_two_triangles():
    """Two triangles sharing an edge (manifold configuration)."""
    vertices = [
        [0.0, 0.0, 0.0],   # v0
        [1.0, 0.0, 0.0],   # v1
        [0.5, 1.0, 0.0],   # v2 (upper triangle)
        [0.5, -1.0, 0.0],  # v3 (lower triangle)
    ]
    faces = [
        [0, 1, 2],  # Upper triangle
        [0, 3, 1],  # Lower triangle (shares edge v0-v1)
    ]
    return vertices, faces

def generate_cube_tris():
    """Cube triangulated (2 triangles per face)."""
    vertices = [
        [-1.0, -1.0, -1.0],  # v0
        [ 1.0, -1.0, -1.0],  # v1
        [ 1.0,  1.0, -1.0],  # v2
        [-1.0,  1.0, -1.0],  # v3
        [-1.0, -1.0,  1.0],  # v4
        [ 1.0, -1.0,  1.0],  # v5
        [ 1.0,  1.0,  1.0],  # v6
        [-1.0,  1.0,  1.0],  # v7
    ]
    faces = [
        # Front face (z = -1)
        [0, 1, 2], [0, 2, 3],
        # Back face (z = 1)
        [4, 6, 5], [4, 7, 6],
        # Left face (x = -1)
        [0, 3, 7], [0, 7, 4],
        # Right face (x = 1)
        [1, 5, 6], [1, 6, 2],
        # Bottom face (y = -1)
        [0, 4, 5], [0, 5, 1],
        # Top face (y = 1)
        [3, 2, 6], [3, 6, 7],
    ]
    return vertices, faces

def generate_cube_quads():
    """Cube with quad faces."""
    vertices = [
        [-1.0, -1.0, -1.0],  # v0
        [ 1.0, -1.0, -1.0],  # v1
        [ 1.0,  1.0, -1.0],  # v2
        [-1.0,  1.0, -1.0],  # v3
        [-1.0, -1.0,  1.0],  # v4
        [ 1.0, -1.0,  1.0],  # v5
        [ 1.0,  1.0,  1.0],  # v6
        [-1.0,  1.0,  1.0],  # v7
    ]
    faces = [
        [0, 1, 2, 3],  # Front
        [4, 7, 6, 5],  # Back
        [0, 4, 5, 1],  # Bottom
        [3, 2, 6, 7],  # Top
        [0, 3, 7, 4],  # Left
        [1, 5, 6, 2],  # Right
    ]
    return vertices, faces

def generate_sphere_low():
    """Low-poly sphere (icosahedron subdivision)."""
    # Golden ratio
    phi = (1.0 + math.sqrt(5.0)) / 2.0
    
    # Icosahedron vertices
    vertices = [
        [-1.0,  phi,  0.0],
        [ 1.0,  phi,  0.0],
        [-1.0, -phi,  0.0],
        [ 1.0, -phi,  0.0],
        
        [ 0.0, -1.0,  phi],
        [ 0.0,  1.0,  phi],
        [ 0.0, -1.0, -phi],
        [ 0.0,  1.0, -phi],
        
        [ phi,  0.0, -1.0],
        [ phi,  0.0,  1.0],
        [-phi,  0.0, -1.0],
        [-phi,  0.0,  1.0],
    ]
    
    # Normalize to unit sphere
    vertices = [[v[0]/2.0, v[1]/2.0, v[2]/2.0] for v in vertices]
    
    # Icosahedron faces
    faces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ]
    
    return vertices, faces

# ============================================================================
# Non-Manifold
# ============================================================================

def generate_t_junction():
    """T-junction: edge incident to 3 faces (non-manifold complex edge)."""
    vertices = [
        [0.0, 0.0, 0.0],    # v0
        [2.0, 0.0, 0.0],    # v1
        [1.0, 1.5, 0.0],    # v2
        [3.0, 1.5, 0.0],    # v3
        [1.0, -1.5, 0.0],   # v4
    ]
    faces = [
        [0, 1, 2],  # Top left triangle
        [1, 3, 2],  # Top right triangle
        [0, 4, 1],  # Bottom triangle
    ]
    # Edge v0-v1 is incident to 3 faces: [0, 1, 2] (non-manifold!)
    return vertices, faces

def generate_pinch_point():
    """Pinch point: two surfaces joined by a single vertex (non-manifold vertex)."""
    vertices = [
        # First triangle
        [0.0, 0.0, 0.0],   # v0 (shared vertex)
        [-1.0, 1.0, 0.0],  # v1
        [1.0, 1.0, 0.0],   # v2
        
        # Second triangle (separate, only touching at v0)
        [-1.0, -1.0, 0.0], # v3
        [1.0, -1.0, 0.0],  # v4
    ]
    faces = [
        [0, 1, 2],  # Upper triangle
        [0, 3, 4],  # Lower triangle (only shares v0)
    ]
    return vertices, faces

def generate_open_surface():
    """Open surface with boundary edges."""
    vertices = [
        [0.0, 0.0, 0.0],  # v0
        [1.0, 0.0, 0.0],  # v1
        [2.0, 0.0, 0.0],  # v2
        [0.0, 1.0, 0.0],  # v3
        [1.0, 1.0, 0.0],  # v4
        [2.0, 1.0, 0.0],  # v5
    ]
    faces = [
        [0, 1, 4], [0, 4, 3],  # Left quad (2 triangles)
        [1, 2, 5], [1, 5, 4],  # Right quad (2 triangles)
    ]
    # Boundary: v0-v3, v3-v4-v5, v5-v2, v2-v0
    return vertices, faces

def generate_multiple_holes():
    """Surface with 2 holes (torus-like topology)."""
    # Simplified torus approximation with 2 holes
    vertices = [
        # Outer ring
        [2.0, 0.0, 0.0], [1.4, 1.4, 0.0], [0.0, 2.0, 0.0], [-1.4, 1.4, 0.0],
        [-2.0, 0.0, 0.0], [-1.4, -1.4, 0.0], [0.0, -2.0, 0.0], [1.4, -1.4, 0.0],
        
        # Inner ring (hole 1)
        [0.5, 0.5, 0.0], [0.5, -0.5, 0.0], [-0.5, -0.5, 0.0], [-0.5, 0.5, 0.0],
        
        # Inner ring (hole 2)
        [1.2, 0.0, 0.1], [0.6, 0.6, 0.1], [0.0, 1.2, 0.1], [-0.6, 0.6, 0.1],
    ]
    faces = [
        # Connect outer and inner rings
        [0, 1, 8], [1, 2, 8], [2, 3, 11], [3, 4, 11],
        [4, 5, 10], [5, 6, 10], [6, 7, 9], [7, 0, 9],
    ]
    return vertices, faces

def generate_wing_edge():
    """Wing edge: edge with only 1 incident face."""
    vertices = [
        [0.0, 0.0, 0.0],  # v0
        [1.0, 0.0, 0.0],  # v1
        [0.5, 1.0, 0.0],  # v2
        [1.5, 0.5, 0.0],  # v3 (dangling)
    ]
    faces = [
        [0, 1, 2],  # Main triangle
        # Edge v1-v3 has no incident face (wing edge)
    ]
    return vertices, faces

# ============================================================================
# Degenerate
# ============================================================================

def generate_zero_area_face():
    """Face with zero area (3 collinear vertices)."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [2.0, 0.0, 0.0],  # All on X axis
    ]
    faces = [[0, 1, 2]]  # Zero area face
    return vertices, faces

def generate_zero_length_edge():
    """Edge with zero length (duplicate vertex positions)."""
    vertices = [
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],  # Same position as v0
        [1.0, 1.0, 0.0],
    ]
    faces = [[0, 1, 2]]  # Edge v0-v1 has length 0
    return vertices, faces

def generate_isolated_vertex():
    """Mesh with an isolated vertex (no incident edges)."""
    vertices = [
        [0.0, 0.0, 0.0],  # v0
        [1.0, 0.0, 0.0],  # v1
        [0.0, 1.0, 0.0],  # v2
        [5.0, 5.0, 0.0],  # v3 (isolated)
    ]
    faces = [[0, 1, 2]]  # Only uses v0, v1, v2
    return vertices, faces

# ============================================================================
# Polygonal
# ============================================================================

def generate_pentagon():
    """Single pentagon (5-sided polygon)."""
    vertices = []
    n = 5
    for i in range(n):
        angle = 2 * math.pi * i / n - math.pi/2  # Start from top
        x = math.cos(angle)
        y = math.sin(angle)
        vertices.append([x, y, 0.0])
    
    faces = [[0, 1, 2, 3, 4]]
    return vertices, faces

def generate_hexagon():
    """Single hexagon (6-sided polygon)."""
    vertices = []
    n = 6
    for i in range(n):
        angle = 2 * math.pi * i / n
        x = math.cos(angle)
        y = math.sin(angle)
        vertices.append([x, y, 0.0])
    
    faces = [[0, 1, 2, 3, 4, 5]]
    return vertices, faces

def generate_quad_strip():
    """Strip of 3 quads."""
    vertices = [
        [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [2.0, 0.0, 0.0], [3.0, 0.0, 0.0],
        [0.0, 1.0, 0.0], [1.0, 1.0, 0.0], [2.0, 1.0, 0.0], [3.0, 1.0, 0.0],
    ]
    faces = [
        [0, 1, 5, 4],  # First quad
        [1, 2, 6, 5],  # Second quad
        [2, 3, 7, 6],  # Third quad
    ]
    return vertices, faces

def generate_mixed_valence():
    """Mix of triangle, quad, and pentagon."""
    vertices = [
        # Triangle
        [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.5, 1.0, 0.0],
        
        # Quad
        [2.0, 0.0, 0.0], [3.0, 0.0, 0.0], [3.0, 1.0, 0.0], [2.0, 1.0, 0.0],
        
        # Pentagon
        [4.0, 0.0, 0.0], [5.0, 0.0, 0.0], [5.5, 0.8, 0.0], [4.5, 1.2, 0.0], [3.5, 0.8, 0.0],
    ]
    faces = [
        [0, 1, 2],           # Triangle
        [3, 4, 5, 6],        # Quad
        [7, 8, 9, 10, 11],   # Pentagon
    ]
    return vertices, faces

# ============================================================================
# Main
# ============================================================================

def main():
    """Generate all test meshes."""
    base_dir = Path(__file__).parent.parent / "test-assets" / "compression"
    
    # Create directories
    (base_dir / "manifold_simple").mkdir(parents=True, exist_ok=True)
    (base_dir / "non_manifold").mkdir(parents=True, exist_ok=True)
    (base_dir / "degenerate").mkdir(parents=True, exist_ok=True)
    (base_dir / "polygonal").mkdir(parents=True, exist_ok=True)
    
    # Define all meshes
    meshes = {
        # Manifold simple
        "manifold_simple/triangle.obj": generate_triangle(),
        "manifold_simple/quad.obj": generate_quad(),
        "manifold_simple/two_triangles.obj": generate_two_triangles(),
        "manifold_simple/cube_tris.obj": generate_cube_tris(),
        "manifold_simple/cube_quads.obj": generate_cube_quads(),
        "manifold_simple/sphere_low.obj": generate_sphere_low(),
        
        # Non-manifold
        "non_manifold/t_junction.obj": generate_t_junction(),
        "non_manifold/pinch_point.obj": generate_pinch_point(),
        "non_manifold/open_surface.obj": generate_open_surface(),
        "non_manifold/multiple_holes.obj": generate_multiple_holes(),
        "non_manifold/wing_edge.obj": generate_wing_edge(),
        
        # Degenerate
        "degenerate/zero_area_face.obj": generate_zero_area_face(),
        "degenerate/zero_length_edge.obj": generate_zero_length_edge(),
        "degenerate/isolated_vertex.obj": generate_isolated_vertex(),
        
        # Polygonal
        "polygonal/pentagon.obj": generate_pentagon(),
        "polygonal/hexagon.obj": generate_hexagon(),
        "polygonal/quad_strip.obj": generate_quad_strip(),
        "polygonal/mixed_valence.obj": generate_mixed_valence(),
    }
    
    # Generate files
    print("🏗️  Generating test meshes...")
    print()
    
    for filename, (vertices, faces) in meshes.items():
        filepath = base_dir / filename
        write_obj(filepath, vertices, faces)
        v_count = len(vertices)
        f_count = len(faces)
        print(f"  ✅ {filename:40s} ({v_count:3d} vertices, {f_count:2d} faces)")
    
    print()
    print(f"🎉 Generated {len(meshes)} test meshes in {base_dir}")
    print()
    print("📋 Next steps:")
    print("  1. Test loading in UI: npm run dev → Compression mode → Load mesh")
    print("  2. Try simplifying each mesh and note which ones fail")
    print("  3. Run Rust tests: cd crates/polylab-compression && cargo test")

if __name__ == "__main__":
    main()
