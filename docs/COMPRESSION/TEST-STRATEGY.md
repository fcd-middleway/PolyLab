# Stratégie de Tests - Maillages Hétéroclites
**Objectif** : Valider la robustesse de l'algorithme de simplification sur des maillages génériques (non-manifold, polygonaux).

---

## 📦 Architecture des Test Assets

```
test-assets/compression/
├── manifold_simple/        # Maillages 2-variétés classiques
│   ├── triangle.obj        # 1 triangle (3 vertices, 1 face)
│   ├── quad.obj            # 1 quad (4 vertices, 1 face)
│   ├── two_triangles.obj   # 2 triangles partageant 1 arête
│   ├── cube_tris.obj       # Cube triangulé (8 vertices, 12 faces)
│   ├── cube_quads.obj      # Cube en quads (8 vertices, 6 faces)
│   └── sphere_low.obj      # Sphère subdivisée (100 vertices)
│
├── non_manifold/           # Configurations non-2-variétés
│   ├── t_junction.obj      # Arête complexe (T-junction, 3+ faces)
│   ├── pinch_point.obj     # Sommet complexe (2 surfaces jointes)
│   ├── open_surface.obj    # Surface avec bord ouvert
│   ├── multiple_holes.obj  # Surface avec plusieurs trous
│   └── wing_edge.obj       # Arête avec 1 seule face incidente
│
├── degenerate/             # Cas dégénérés et limites
│   ├── zero_area_face.obj  # Face collapsed (3 vertices alignés)
│   ├── zero_length_edge.obj # Arête de longueur 0
│   ├── isolated_vertex.obj # Vertex sans arête
│   └── duplicate_face.obj  # 2 faces identiques (mêmes vertices)
│
└── polygonal/              # Faces polygonales (non-triangulaires)
    ├── pentagon.obj        # 1 pentagone (5 vertices, 1 face)
    ├── hexagon.obj         # 1 hexagone (6 vertices, 1 face)
    ├── quad_strip.obj      # Bande de quads
    └── mixed_valence.obj   # Mix tri/quad/pentagon
```

---

## 🧪 Catalogue des Maillages de Test

### Catégorie 1 : Manifold Simple (Baseline)

#### 1.1 Triangle (`triangle.obj`)
**Description** : 1 triangle simple, cas le plus basique.

```
Topology:
  v0 (0, 0, 0)
   |\
   | \
   |  \
  v1--v2
(1,0,0) (0,1,0)

Vertices: 3
Edges: 3
Faces: 1 (triangle)
```

**Tests attendus** :
- ✅ Chargement OK
- ✅ Collapse de n'importe quelle arête → 2 vertices restants
- ✅ Après collapse : 1 arête, 0 face (face dégénérée supprimée)

---

#### 1.2 Quad (`quad.obj`)
**Description** : 1 quad simple (face à 4 côtés).

```
Topology:
  v0------v1
  |       |
  |       |
  v3------v2

Vertices: 4
Edges: 4
Faces: 1 (quad)
```

**Tests attendus** :
- ✅ Chargement OK (face polygonale)
- ✅ Collapse d'une arête diagonale → quad devient triangle
- ⚠️ Vérifier que la face reste valide après collapse

---

#### 1.3 Two Triangles (`two_triangles.obj`)
**Description** : 2 triangles partageant 1 arête (cas 2-manifold classique).

```
Topology:
    v2
   /|\
  / | \
 /  |  \
v0--e--v1
 \  |  /
  \ | /
   \|/
    v3

Vertices: 4
Edges: 5
Faces: 2 (triangles)
Arête partagée: e = (v0, v1)
```

**Tests attendus** :
- ✅ Chargement OK
- ✅ Collapse de e → 3 vertices, 2 faces deviennent 1 face (dégénérescence)
- ✅ Collapse d'une arête de bord → OK

---

#### 1.4 Cube Tris (`cube_tris.obj`)
**Description** : Cube triangulé (2 triangles par face).

```
Vertices: 8
Edges: 18 (12 edges du cube + 6 diagonales)
Faces: 12 (2 triangles par face du cube)
```

**Tests attendus** :
- ✅ Chargement OK
- ✅ Simplification progressive : 8 → 7 → 6 → ... → 4 vertices minimum (tétraèdre)
- ✅ Vérifier que le maillage reste manifold

---

#### 1.5 Cube Quads (`cube_quads.obj`)
**Description** : Cube en quads (faces à 4 côtés).

```
Vertices: 8
Edges: 12
Faces: 6 (quads)
```

**Tests attendus** :
- ✅ Chargement OK (faces polygonales)
- ✅ Simplification : 8 → 7 → ... vertices
- ⚠️ Vérifier que les faces restent valides (pas de quad dégénéré avec 2 arêtes identiques)

---

### Catégorie 2 : Non-Manifold (Cas Complexes)

#### 2.1 T-Junction (`t_junction.obj`)
**Description** : Arête complexe (incidente à 3 faces).

```
Topology:
     f2
     /\
    /  \
   v2  v3
    \  /
  v0-e-v1   ← Arête e = (v0, v1) est incidente à f1, f2, f3
    /  \
   v4  v5
    \  /
     \/
     f3

Vertices: 6
Edges: 9
Faces: 3
Arête complexe: e = (v0, v1) avec 3 faces incidentes
```

**Tests attendus** :
- ✅ Chargement OK (détection arête complexe)
- ❌ Collapse de e DOIT échouer (arête complexe invalide)
- ✅ Collapse d'une arête de bord → OK

---

#### 2.2 Pinch Point (`pinch_point.obj`)
**Description** : Sommet complexe (2 surfaces jointes par 1 vertex).

```
Topology:
  Triangle 1:
    v1
   / \
  v0-v2

  Triangle 2:
    v3
   / \
  v0-v4

Partagent seulement v0 (pas d'arête commune)

Vertices: 5
Edges: 6 (aucune arête partagée)
Faces: 2
```

**Tests attendus** :
- ✅ Chargement OK (détection sommet complexe)
- ⚠️ Collapse d'une arête impliquant v0 → attention à ne pas fusionner les 2 surfaces

---

#### 2.3 Open Surface (`open_surface.obj`)
**Description** : Plan avec bords ouverts (arêtes de boundary).

```
Topology:
  v0----v1----v2
  |  \  |  \  |
  |   \ |   \ |
  v3----v4----v5

4 triangles, bords sur v0-v3, v2-v5, v0-v2-v5-v3

Vertices: 6
Edges: 9 (4 internes, 5 boundary)
Faces: 4
```

**Tests attendus** :
- ✅ Chargement OK (détection arêtes de bord)
- ✅ Collapse d'une arête interne → OK
- ⚠️ Collapse d'une arête de bord → peut créer un trou

---

#### 2.4 Multiple Holes (`multiple_holes.obj`)
**Description** : Surface avec 2 trous (topologie non-triviale).

```
Topology:
  Anneau avec 2 trous (genre 2)

Vertices: 16
Edges: 24
Faces: 10
```

**Tests attendus** :
- ✅ Chargement OK
- ⚠️ Vérifier que collapse ne change pas le genre (nombre de trous)

---

### Catégorie 3 : Degenerate (Cas Limites)

#### 3.1 Zero Area Face (`zero_area_face.obj`)
**Description** : Face avec 3 vertices alignés (aire = 0).

```
Topology:
  v0---v1---v2  (tous sur l'axe X)

Vertices: 3
Edges: 2
Faces: 1 (aire = 0)
```

**Tests attendus** :
- ⚠️ Chargement : détecter la face dégénérée
- ❌ Collapse devrait échouer ou cleanup la face

---

#### 3.2 Zero Length Edge (`zero_length_edge.obj`)
**Description** : Arête de longueur 0 (v0 et v1 au même endroit).

```
Topology:
  v0 == v1  (position identique)
  |     /
  |    /
  v2--/

Vertices: 3 (mais v0 et v1 sont au même point)
Edges: 3
Faces: 1
```

**Tests attendus** :
- ⚠️ Chargement : détecter l'arête dégénérée
- ✅ Collapse automatique (fusion v0 et v1)

---

#### 3.3 Isolated Vertex (`isolated_vertex.obj`)
**Description** : Vertex sans arête incidente.

```
Topology:
  v0---v1
  |   /
  |  /
  v2

  v3 (isolé, pas d'arête)

Vertices: 4
Edges: 3
Faces: 1
```

**Tests attendus** :
- ✅ Chargement OK
- ✅ v3 devrait être ignoré ou supprimé lors de cleanup

---

### Catégorie 4 : Polygonal (Faces Non-Triangulaires)

#### 4.1 Pentagon (`pentagon.obj`)
**Description** : 1 pentagone (5 vertices).

```
Topology:
    v0
   /  \
  v4  v1
  |    |
  v3--v2

Vertices: 5
Edges: 5
Faces: 1 (pentagon)
```

**Tests attendus** :
- ✅ Chargement OK (face polygonale)
- ✅ Collapse d'une arête → pentagon devient quad
- ✅ Vérifier que la face reste valide

---

#### 4.2 Hexagon (`hexagon.obj`)
**Description** : 1 hexagone (6 vertices).

```
Topology:
   v0---v1
  /       \
 v5       v2
  \       /
   v4---v3

Vertices: 6
Edges: 6
Faces: 1 (hexagon)
```

**Tests attendus** :
- ✅ Chargement OK
- ✅ Collapse → hexagon devient pentagon

---

#### 4.3 Mixed Valence (`mixed_valence.obj`)
**Description** : Mix de triangles, quads et pentagons.

```
Topology:
  Face 1: Triangle (v0, v1, v2)
  Face 2: Quad (v2, v1, v3, v4)
  Face 3: Pentagon (v4, v3, v5, v6, v7)

Vertices: 8
Edges: 10
Faces: 3 (valences 3, 4, 5)
```

**Tests attendus** :
- ✅ Chargement OK (mix de valences)
- ✅ Simplification progressive
- ✅ Vérifier que chaque face garde sa valence ou se réduit proprement

---

## 🧬 Génération des Fichiers OBJ

### Script Python pour génération automatique

**Fichier** : `scripts/generate_test_meshes.py` 🆕

```python
#!/usr/bin/env python3
"""
Generate test meshes for compression algorithm validation.
"""
import os
from pathlib import Path

def write_obj(filename, vertices, faces):
    """Write OBJ file with vertices and faces."""
    with open(filename, 'w') as f:
        f.write("# Generated test mesh\n")
        f.write(f"# Vertices: {len(vertices)}\n")
        f.write(f"# Faces: {len(faces)}\n\n")
        
        # Write vertices
        for v in vertices:
            f.write(f"v {v[0]} {v[1]} {v[2]}\n")
        
        f.write("\n")
        
        # Write faces (1-indexed in OBJ format)
        for face in faces:
            face_str = " ".join(str(i+1) for i in face)
            f.write(f"f {face_str}\n")

def generate_triangle():
    """Single triangle."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [[0, 1, 2]]
    return vertices, faces

def generate_quad():
    """Single quad."""
    vertices = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [1.0, 1.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    faces = [[0, 1, 2, 3]]
    return vertices, faces

def generate_two_triangles():
    """Two triangles sharing an edge."""
    vertices = [
        [0.0, 0.0, 0.0],   # v0
        [1.0, 0.0, 0.0],   # v1
        [0.5, 1.0, 0.0],   # v2
        [0.5, -1.0, 0.0],  # v3
    ]
    faces = [
        [0, 1, 2],  # Upper triangle
        [0, 1, 3],  # Lower triangle (shares edge v0-v1)
    ]
    return vertices, faces

def generate_t_junction():
    """T-junction (complex edge with 3 incident faces)."""
    vertices = [
        [0.0, 0.0, 0.0],    # v0
        [2.0, 0.0, 0.0],    # v1
        [1.0, 1.5, 0.0],    # v2
        [3.0, 1.5, 0.0],    # v3
        [1.0, -1.5, 0.0],   # v4
        [3.0, -1.5, 0.0],   # v5
    ]
    faces = [
        [0, 1, 2],  # Top left triangle
        [1, 3, 2],  # Top right triangle
        [0, 4, 1],  # Bottom left triangle
    ]
    # Edge v0-v1 is incident to 3 faces (non-manifold)
    return vertices, faces

def generate_pentagon():
    """Single pentagon."""
    import math
    vertices = []
    n = 5
    for i in range(n):
        angle = 2 * math.pi * i / n
        x = math.cos(angle)
        y = math.sin(angle)
        vertices.append([x, y, 0.0])
    
    faces = [[0, 1, 2, 3, 4]]
    return vertices, faces

def generate_hexagon():
    """Single hexagon."""
    import math
    vertices = []
    n = 6
    for i in range(n):
        angle = 2 * math.pi * i / n
        x = math.cos(angle)
        y = math.sin(angle)
        vertices.append([x, y, 0.0])
    
    faces = [[0, 1, 2, 3, 4, 5]]
    return vertices, faces

def main():
    """Generate all test meshes."""
    base_dir = Path(__file__).parent.parent / "test-assets" / "compression"
    
    # Create directories
    (base_dir / "manifold_simple").mkdir(parents=True, exist_ok=True)
    (base_dir / "non_manifold").mkdir(parents=True, exist_ok=True)
    (base_dir / "degenerate").mkdir(parents=True, exist_ok=True)
    (base_dir / "polygonal").mkdir(parents=True, exist_ok=True)
    
    # Generate meshes
    meshes = {
        "manifold_simple/triangle.obj": generate_triangle(),
        "manifold_simple/quad.obj": generate_quad(),
        "manifold_simple/two_triangles.obj": generate_two_triangles(),
        "non_manifold/t_junction.obj": generate_t_junction(),
        "polygonal/pentagon.obj": generate_pentagon(),
        "polygonal/hexagon.obj": generate_hexagon(),
    }
    
    for filename, (vertices, faces) in meshes.items():
        filepath = base_dir / filename
        write_obj(filepath, vertices, faces)
        print(f"✅ Generated: {filepath}")
    
    print(f"\n🎉 Generated {len(meshes)} test meshes in {base_dir}")

if __name__ == "__main__":
    main()
```

---

## 🧪 Tests Unitaires Rust

### Fichier de tests à créer

**Fichier** : `polylab-compression/src/aif/collapse_tests.rs` 🆕

```rust
//! Tests for edge collapse with various mesh configurations.

use super::*;
use glam::Vec3;

#[test]
fn test_collapse_simple_triangle() {
    let mut aif = AIF::new();
    
    let v0 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v1 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(0.0, 1.0, 0.0));
    
    let e0 = aif.add_edge(v0, v1).unwrap();
    let e1 = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v2, v0).unwrap();
    
    aif.add_face(vec![e0, e1, e2]).unwrap();
    
    assert_eq!(aif.num_vertices(), 3);
    assert_eq!(aif.num_edges(), 3);
    assert_eq!(aif.num_faces(), 1);
    
    // Collapse edge v0-v1
    let new_vertex = aif.collapse_edge(e0);
    assert!(new_vertex.is_some());
    
    // Should have 2 vertices, 1 edge, 0 faces (degenerate removed)
    assert_eq!(aif.num_vertices(), 2);
    assert_eq!(aif.num_edges(), 1);
    assert_eq!(aif.num_faces(), 0);
}

#[test]
fn test_collapse_manifold_edge() {
    // Two triangles sharing an edge (2-manifold)
    let mut aif = AIF::new();
    
    let v0 = aif.add_vertex(Vec3::new(0.0, 0.0, 0.0));
    let v1 = aif.add_vertex(Vec3::new(1.0, 0.0, 0.0));
    let v2 = aif.add_vertex(Vec3::new(0.5, 1.0, 0.0));
    let v3 = aif.add_vertex(Vec3::new(0.5, -1.0, 0.0));
    
    let e_shared = aif.add_edge(v0, v1).unwrap();
    let e1 = aif.add_edge(v1, v2).unwrap();
    let e2 = aif.add_edge(v2, v0).unwrap();
    let e3 = aif.add_edge(v1, v3).unwrap();
    let e4 = aif.add_edge(v3, v0).unwrap();
    
    aif.add_face(vec![e_shared, e1, e2]).unwrap();
    aif.add_face(vec![e_shared, e3, e4]).unwrap();
    
    // Edge is manifold (exactly 2 faces)
    assert_eq!(aif.edge_faces(e_shared).len(), 2);
    assert!(!aif.is_boundary_edge(e_shared));
    
    // Collapse should work
    let new_vertex = aif.collapse_edge(e_shared);
    assert!(new_vertex.is_some());
    
    assert_eq!(aif.num_vertices(), 3);
}

#[test]
fn test_collapse_complex_edge_should_fail() {
    // T-junction: edge incident to 3 faces (non-manifold)
    // TODO: implement when validation is ready
    // Should return Err(CollapseError::InvalidComplexEdge)
}

#[test]
fn test_collapse_boundary_edge() {
    // Edge with only 1 incident face (boundary)
    // TODO: Should work but need special handling
}

#[test]
fn test_collapse_creates_degenerate_face() {
    // Collapsing an edge that would create a face with <3 edges
    // TODO: Should fail validation
}
```

---

## 📊 Matrice de Tests

| Mesh                 | Charge | Collapse | Robustesse | Visualisation |
|----------------------|--------|----------|------------|---------------|
| triangle             | ✅     | ✅       | ✅         | ✅            |
| quad                 | ✅     | ⚠️       | ⚠️         | ✅            |
| two_triangles        | ✅     | ✅       | ✅         | ✅            |
| cube_tris            | ✅     | ✅       | ✅         | ✅            |
| cube_quads           | ✅     | ⚠️       | ⚠️         | ✅            |
| t_junction           | ✅     | ❌       | ❌         | ⚠️            |
| pinch_point          | ✅     | ⚠️       | ⚠️         | ⚠️            |
| open_surface         | ✅     | ⚠️       | ⚠️         | ✅            |
| pentagon             | ✅     | ⚠️       | ⚠️         | ✅            |
| hexagon              | ✅     | ⚠️       | ⚠️         | ✅            |
| mixed_valence        | ✅     | ⚠️       | ⚠️         | ✅            |

**Légende** :
- ✅ : Fonctionne correctement
- ⚠️ : Fonctionne mais à valider/améliorer
- ❌ : Ne fonctionne pas (attendu)

---

## 🎯 Plan d'Action

1. **Générer les meshes** : `python scripts/generate_test_meshes.py`
2. **Tester le chargement** : Vérifier que tous se chargent dans l'UI
3. **Identifier les échecs** : Noter quels meshes crashent lors du collapse
4. **Prioriser les fixes** : Commencer par les cas manifold, puis non-manifold
5. **Itérer** : Fix → Test → Validate → Next

---

**Date de création** : 9 juin 2026
**Auteur** : GitHub Copilot
**Statut** : 🚧 À implémenter
