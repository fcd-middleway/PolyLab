# Architecture du module AIF

## Séparation des responsabilités

Le module AIF est organisé selon une **séparation claire des responsabilités** :

### 📦 Modules

```
aif/
├── mod.rs          → Définition du module et exports publics
├── types.rs        → Types de base (Vertex, Edge, Face, Corner)
├── storage.rs      → Structure AIF et gestion mémoire
├── queries.rs      → Méthodes de lecture/navigation
├── operations.rs   → Méthodes de modification
└── conversion.rs   → Import/export Mesh
```

### 🎯 Responsabilités

#### **`types.rs`** - Types fondamentaux
- Définition des structures `Vertex`, `Edge`, `Face`, `Corner`
- Définition des identifiants `VertexId`, `EdgeId`, `FaceId`, `CornerId`
- Méthodes utilitaires sur les types (ex: `Edge::is_boundary()`)
- **Aucune** dépendance vers AIF

#### **`storage.rs`** - Structure de données et mémoire
- Structure `AIF` avec les SlotMaps
- Constructeurs (`new()`, `with_capacity()`)
- Accesseurs de base (`num_vertices()`, `num_edges()`, etc.)
- Gestion mémoire (compaction, statistiques)
- **Pas** d'opérations topologiques complexes

#### **`queries.rs`** - Requêtes topologiques (lecture seule)
- `impl AIF { ... }` avec méthodes **non-mutables** (`&self`)
- Accès direct : `vertex()`, `edge()`, `face()`, `corner()`
- Navigation : `vertex_edges()`, `edge_faces()`, `face_vertices()`
- Recherche : `find_edge()`, `adjacent_edges()`
- Propriétés : `edge_length()`, `vertex_valence()`, `is_boundary_*()`
- Itération : `vertex_ids()`, `edge_ids()`, etc.

#### **`operations.rs`** - Opérations topologiques (modification)
- `impl AIF { ... }` avec méthodes **mutables** (`&mut self`)
- Ajout : `add_vertex()`, `add_edge()`, `add_face()`
- Suppression : `remove_vertex()`, `remove_edge()`, `remove_face()`
- Simplification : `collapse_edge()` (opération critique)
- **Maintient** la cohérence topologique automatiquement

#### **`conversion.rs`** - Import/Export
- `impl AIF { ... }` avec méthodes de conversion
- `from_mesh()` : polylab_core::Mesh → AIF
- `to_mesh()` : AIF → polylab_core::Mesh
- Préservation des attributs (UVs, normales)

## 🔧 Approche Rust

### Pourquoi pas de traits ?

**Avant** (avec traits) :
```rust
pub trait TopologicalOperations {
    fn add_vertex(&mut self, pos: Vec3) -> VertexId;
    // ...
}

impl TopologicalOperations for AIF {
    fn add_vertex(&mut self, pos: Vec3) -> VertexId { ... }
}
```

**Après** (méthodes directes) :
```rust
impl AIF {
    pub fn add_vertex(&mut self, pos: Vec3) -> VertexId { ... }
}
```

### Avantages

1. **Plus simple** : Pas de trait à importer
2. **Plus clair** : Séparation par fichier = séparation de responsabilité
3. **Plus lisible** : Documentation groupée par catégorie
4. **Plus maintenable** : Modifications localisées

### Utilisation

```rust
use polylab_compression::aif::AIF;

let mut aif = AIF::new();

// Pas besoin d'importer de traits !
let v1 = aif.add_vertex(Vec3::ZERO);          // operations.rs
let v2 = aif.add_vertex(Vec3::X);             // operations.rs
let edge = aif.add_edge(v1, v2).unwrap();     // operations.rs

let length = aif.edge_length(edge).unwrap();  // queries.rs
let valence = aif.vertex_valence(v1);         // queries.rs
```

## 📊 Diagramme de dépendances

```
┌─────────────┐
│   types.rs  │  ← Types fondamentaux (aucune dépendance)
└─────────────┘
       ↓
┌─────────────┐
│ storage.rs  │  ← Structure AIF (dépend des types)
└─────────────┘
       ↓
   ┌───┴───┬─────────────┐
   ↓       ↓             ↓
queries  operations  conversion
   │        │            │
   └────────┴────────────┘
         (tous dépendent de storage + types)
```

## 🎓 Comparaison avec d'autres langages

### En C#
```csharp
class AIF {
    // ...
}

class TopologicalOperations {
    public static VertexId AddVertex(AIF aif, Vec3 pos) { ... }
    public static void CollapseEdge(AIF aif, EdgeId edge) { ... }
}

// Usage:
TopologicalOperations.AddVertex(aif, pos);
```

### En Rust (notre approche)
```rust
impl AIF {
    pub fn add_vertex(&mut self, pos: Vec3) -> VertexId { ... }
    pub fn collapse_edge(&mut self, edge: EdgeId) { ... }
}

// Usage:
aif.add_vertex(pos);  // Plus naturel !
```

## 📝 Résumé

- **Un seul type** : `AIF`
- **Trois catégories de méthodes** : queries, operations, conversion
- **Séparation physique** : un fichier par catégorie
- **API simple** : pas de traits à importer, juste `use aif::AIF`
- **Extensibilité** : facile d'ajouter de nouvelles méthodes dans le bon fichier
