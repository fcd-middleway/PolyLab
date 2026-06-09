# Compression Progressive - État Actuel
**Dernière mise à jour** : 9 juin 2026

## 📊 Synthèse

Le projet de compression progressive est **partiellement implémenté** avec une UI fonctionnelle mais une logique de simplification **limitée aux maillages manifold triangulaires**. 

Le "gros morceau" à venir : **implémenter un collapse_edge robuste pour maillages non-manifold et polygonaux**.

---

## ✅ Ce qui est FAIT

### 1. Infrastructure de base

#### Structure AIF (Already-Indexed Format)
**Fichier** : `polylab-compression/src/aif/`

- ✅ **Storage** (`storage.rs`) : SlotMap pour vertices, edges, faces, corners
- ✅ **Types** (`types.rs`) : VertexId, EdgeId, FaceId, CornerId avec génération
- ✅ **Operations** (`operations.rs`) : 
  - `add_vertex()`, `add_edge()`, `add_face()`
  - `remove_vertex()`, `remove_edge()`, `remove_face()`
  - `collapse_edge()` **BASIQUE** (midpoint, pas de validation topologique)
- ✅ **Queries** (`queries.rs`) :
  - `vertex_valence()`, `edge_length()`, `is_boundary_edge()`
  - `vertex_edges()`, `edge_faces()`, `adjacent_edges()`
- ✅ **Conversion** (`conversion.rs`) :
  - `from_mesh()` : Mesh → AIF
  - `to_mesh()` : AIF → Mesh
- ✅ **Tests** (`tests.rs`) : 23 tests unitaires basiques

#### API WASM
**Fichier** : `polylab-compression/src/wasm_api.rs`

- ✅ `CompressionHandle` avec méthodes :
  - `new(vertices, faces)` : crée Mesh → AIF
  - `simplify_step(target_ratio, metric_name)` : simplifie par vagues
  - `reset()` : restaure le mesh original
  - `get_stats()` : retourne statistiques (vertices, faces, compression_ratio)
- ✅ Structures sérialisables :
  - `MeshStats` : statistiques mesh
  - `SimplifyResult` : résultat de simplification (vertices, faces, stats)

#### Décimation
**Fichier** : `polylab-compression/src/decimation/`

- ✅ **Métriques** (`metrics.rs`) :
  - `MetricType::Random` : coût aléatoire (baseline)
  - `MetricType::EdgeLength` : priorise les arêtes courtes
- ✅ **Queue** (`mod.rs`) :
  - `DecimationQueue` : BinaryHeap pour sélection d'arêtes
  - `build(aif, metric)` : construit la queue avec coûts
  - `pop()` : retourne l'arête la moins coûteuse

#### Interface TypeScript
**Fichier** : `code/app/web/src/projects/CompressionProject.ts`

- ✅ Boutons toolbar :
  - **⚡ Simplify** : appelle `simplify_step(0.9)` (réduit de 10%)
  - **🔄 Reset** : appelle `reset()`
- ✅ Affichage stats dans Properties panel
- ✅ Update viewer avec nouveaux vertices/faces
- ✅ Status bar avec feedback utilisateur

### 2. Fonctionnalités utilisateur

- ✅ **Charger un mesh OBJ** → Conversion AIF automatique
- ✅ **Simplifier par étapes** → Réduction ~10% à chaque clic
- ✅ **Reset** → Restaure le mesh original
- ✅ **Statistiques temps réel** → Vertices, faces, compression ratio

---

## ❌ Ce qui MANQUE (Le "Gros Morceau")

### 1. Robustesse topologique de `collapse_edge()`

**Problème** : L'implémentation actuelle de `collapse_edge()` est **trop naïve** :

```rust
// Code actuel (simplifié)
pub fn collapse_edge(&mut self, edge_id: EdgeId) -> Option<VertexId> {
    // 1. Récupère les 2 vertices de l'arête
    // 2. Crée un nouveau vertex au midpoint
    // 3. Reconnecte TOUTES les arêtes des 2 vertices au nouveau vertex
    // 4. Supprime les arêtes dégénérées (nouveau_vertex → nouveau_vertex)
    // 5. Supprime l'arête et les 2 anciens vertices
}
```

**Cas non gérés** :

#### A. Arêtes complexes (non-manifold)
Une arête peut être incidente à **plus de 2 faces** :
```
     f2
     /\
    /  \
   v1--e--v2
    \  /
     \/
     f1
```

**Problème** : Le collapse naïf va créer des faces dégénérées ou invalides.

#### B. Sommets complexes (non-manifold)
Un sommet peut appartenir à **plusieurs composantes disconnectées** :
```
    f1
   / \
  v---e---w   (arête complexe : v appartient à f1 ET f2 déconnectées)
   \ /
    f2
```

**Problème** : Le collapse peut fusionner des régions qui ne devraient pas être connectées.

#### C. Faces polygonales
Une face peut avoir **plus de 3 arêtes** (quad, pentagone, etc.) :
```
  v1----e1----v2
  |           |
  e4          e2
  |           |
  v4----e3----v3
```

**Problème** : Le collapse peut créer une face avec des arêtes dégénérées.

#### D. Bords (boundary edges)
Une arête de bord n'est incidente qu'à **1 seule face** :
```
  v1--e--v2  (e est un bord, 1 seule face)
    \  /
     \/
     f1
```

**Problème** : Le collapse peut créer des trous ou déchirer le maillage.

### 2. Validation topologique pré-collapse

**Ce qui manque** :
- ❌ **Règles de validité** : quand peut-on collapser une arête ?
- ❌ **Détection de cas interdits** :
  - Arête complexe incidente à >2 faces
  - Collapse créant une face dégénérée (2 arêtes identiques)
  - Collapse changeant la topologie (genre)
  - Collapse créant une auto-intersection
- ❌ **Stratégies de collapse** :
  - Midpoint (actuel)
  - Endpoint (garder v1 ou v2)
  - Optimal placement (QEM)

### 3. Support des faces polygonales

**Actuellement** : Le code assume que toutes les faces sont des **triangles** :
- `Mesh::faces` : Vec<Face> où Face a 3 vertices
- `from_mesh()` : ne gère que les triangles
- `to_mesh()` : génère que des triangles

**Ce qui manque** :
- ❌ Support des faces à N côtés (N ≥ 3)
- ❌ Triangulation optionnelle pour l'affichage
- ❌ Préservation de la structure polygonale lors du collapse

### 4. Tests avec maillages complexes

**Tests actuels** : Maillages simples (1-2 triangles, manifold)

**Tests manquants** :
- ❌ Maillages non-manifold :
  - Arêtes complexes (T-junction)
  - Sommets complexes (pinch point)
  - Surfaces ouvertes avec bords
- ❌ Maillages polygonaux :
  - Quads uniquement
  - Mix triangles/quads
  - Pentagones, hexagones
- ❌ Cas dégénérés :
  - Faces nulles (aire = 0)
  - Arêtes nulles (longueur = 0)
  - Sommets isolés

---

## 🎯 Le "Gros Morceau" : Plan d'Action

### Phase 1 : Maillages de test 🧪

**Objectif** : Créer un set de maillages hétéroclites pour tester unitairement et visuellement.

#### A. Fichiers de test à créer

**Dossier** : `/test-assets/compression/`

1. **manifold_simple/**
   - `triangle.obj` : 1 triangle (baseline)
   - `quad.obj` : 1 quad
   - `cube_tris.obj` : cube triangulé
   - `cube_quads.obj` : cube en quads
   - `sphere_low.obj` : sphère 100 vertices

2. **non_manifold/**
   - `t_junction.obj` : 2 quads avec arête complexe (T-junction)
   - `pinch_point.obj` : 2 surfaces jointes par 1 vertex
   - `open_surface.obj` : plan avec bords
   - `multiple_boundaries.obj` : surface avec plusieurs trous

3. **degenerate/**
   - `zero_area_face.obj` : face collapsed (3 vertices alignés)
   - `zero_length_edge.obj` : arête de longueur 0
   - `isolated_vertex.obj` : vertex sans arête

4. **polygonal/**
   - `pentagon.obj` : face à 5 côtés
   - `hexagon.obj` : face à 6 côtés
   - `mixed_valence.obj` : mix tri/quad/pentagon

#### B. Tests unitaires Rust

**Fichier** : `polylab-compression/src/aif/collapse_tests.rs` 🆕

```rust
#[test]
fn test_collapse_manifold_edge() { }

#[test]
fn test_collapse_boundary_edge() { }

#[test]
fn test_collapse_complex_edge_should_fail() { }

#[test]
fn test_collapse_creates_degenerate_face_should_fail() { }

#[test]
fn test_collapse_preserves_topology() { }
```

#### C. Tests visuels UI

**Fichier** : `code/app/web/src/projects/CompressionProject.ts`

- **Bouton "Load Test Mesh"** : menu déroulant avec tous les test assets
- **Mode "Step-by-step"** : collapse 1 arête à la fois avec highlight
- **Visualisation des erreurs** : colorer les arêtes invalides en rouge

---

### Phase 2 : Validation topologique 🔍

**Objectif** : Implémenter les règles de validité AVANT collapse.

#### A. Analyse de validité

**Fichier** : `polylab-compression/src/aif/validation.rs` 🆕

```rust
pub enum CollapseValidity {
    Valid,
    InvalidComplexEdge,      // >2 faces
    InvalidBoundaryMismatch, // v1 et v2 pas même status boundary
    InvalidDegenerateFace,   // Créerait face avec <3 edges
    InvalidTopologyChange,   // Changerait le genre
}

impl AIF {
    pub fn can_collapse_edge(&self, edge_id: EdgeId) -> CollapseValidity {
        // 1. Check edge exists
        // 2. Check edge face count (≤2 for manifold)
        // 3. Check boundary consistency
        // 4. Check faces after collapse
        // 5. Return validity
    }
}
```

#### B. Stratégies de collapse

**Fichier** : `polylab-compression/src/aif/collapse_strategy.rs` 🆕

```rust
pub enum CollapseStrategy {
    Midpoint,         // Moyenne v1 et v2
    Endpoint(bool),   // Garder v1 (false) ou v2 (true)
    Optimal,          // QEM ou autre métrique
}

impl AIF {
    pub fn collapse_edge_with_strategy(
        &mut self, 
        edge_id: EdgeId,
        strategy: CollapseStrategy
    ) -> Result<VertexId, CollapseError> {
        // 1. Validate
        // 2. Compute new position selon stratégie
        // 3. Collapse
        // 4. Return new vertex
    }
}
```

---

### Phase 3 : Implémentation robuste 💪

**Objectif** : Réécrire `collapse_edge()` avec validation complète.

#### Algorithme robuste

```rust
pub fn collapse_edge(&mut self, edge_id: EdgeId) -> Result<VertexId, CollapseError> {
    // STEP 1: VALIDATION
    let validity = self.can_collapse_edge(edge_id);
    if validity != CollapseValidity::Valid {
        return Err(CollapseError::Invalid(validity));
    }
    
    // STEP 2: GATHER TOPOLOGICAL INFO
    let edge = self.edges.get(edge_id)?;
    let (v1, v2) = (edge.vertex1, edge.vertex2);
    let v1_edges = self.vertex_edges(v1);
    let v2_edges = self.vertex_edges(v2);
    let common_edges = v1_edges.intersection(&v2_edges);
    let edge_faces = self.edge_faces(edge_id);
    
    // STEP 3: COMPUTE NEW POSITION
    let new_pos = self.compute_collapse_position(v1, v2);
    let new_vertex = self.add_vertex(new_pos);
    
    // STEP 4: UPDATE FACES
    for face_id in edge_faces {
        // Soit supprimer la face (devient dégénérée)
        // Soit mettre à jour ses arêtes
    }
    
    // STEP 5: RECONNECT EDGES
    for edge_id in v1_edges.union(&v2_edges) {
        if edge_id == collapsed_edge { continue; }
        // Remplacer v1/v2 par new_vertex
    }
    
    // STEP 6: REMOVE DEGENERATE ELEMENTS
    self.remove_degenerate_edges();
    self.remove_degenerate_faces();
    
    // STEP 7: CLEANUP
    self.remove_edge(edge_id);
    self.remove_vertex(v1);
    self.remove_vertex(v2);
    
    Ok(new_vertex)
}
```

---

## 🧭 Prochaines Actions Concrètes

### 1. Aujourd'hui : Créer les maillages de test ✅

```bash
cd /Users/fcd/Projects/Autres/PolyLab
mkdir -p test-assets/compression/{manifold_simple,non_manifold,degenerate,polygonal}
```

**Générer** :
- `triangle.obj`, `quad.obj`, `cube_tris.obj`, `cube_quads.obj`
- `t_junction.obj`, `pinch_point.obj`, `open_surface.obj`
- `zero_area_face.obj`, `isolated_vertex.obj`
- `pentagon.obj`, `mixed_valence.obj`

### 2. Demain : Tests unitaires de validation

**Créer** : `polylab-compression/src/aif/validation.rs`

**Implémenter** :
- `can_collapse_edge()` avec tous les cas d'invalidité
- Tests unitaires pour chaque cas

### 3. J+2 : Stratégies de collapse

**Créer** : `polylab-compression/src/aif/collapse_strategy.rs`

**Implémenter** :
- `CollapseStrategy` enum
- `collapse_edge_with_strategy()`

### 4. J+3 : Réécriture de collapse_edge

**Modifier** : `polylab-compression/src/aif/operations.rs`

**Remplacer** : `collapse_edge()` naïf par version robuste

### 5. J+4 : Tests visuels UI

**Modifier** : `CompressionProject.ts`

**Ajouter** :
- Bouton "Load Test Mesh"
- Mode "Step-by-step" avec highlight
- Visualisation des erreurs

---

## 📝 Notes Importantes

### Convention de nommage
- ✅ **Fait** : marqueur de complétion
- ❌ **Manquant** : à implémenter
- 🆕 **Nouveau fichier** : à créer
- ➕ **Modification** : fichier existant à modifier

### Priorité

1. **CRITIQUE** : Validation topologique (sans ça, tout collapse est risqué)
2. **HAUTE** : Tests avec maillages non-manifold (pour valider la robustesse)
3. **MOYENNE** : Support des faces polygonales (pour généralité)
4. **BASSE** : Métriques avancées (QEM, etc.) - optimisation

### Dépendances

```
Maillages de test → Tests unitaires → Validation → Collapse robuste → Tests visuels
```

---

**Conclusion** : Le projet a une bonne base (structure AIF, API, UI), mais le cœur de l'algorithme (`collapse_edge`) est trop simpliste pour des maillages génériques. Le "gros morceau" consiste à :

1. **Créer un set de tests hétéroclites**
2. **Implémenter la validation topologique**
3. **Réécrire collapse_edge de façon robuste**
4. **Tester unitairement ET visuellement**

Cette approche pas-à-pas et testable permettra d'avancer sans se perdre dans la complexité des connectivités non-manifold.
