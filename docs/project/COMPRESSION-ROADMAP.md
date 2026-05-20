# Mode Compression - User Stories & Roadmap

## 🎯 Vision

Le **Mode Compression** permet à l'utilisateur de charger un maillage 3D, de le compresser progressivement en plusieurs niveaux de détail, et de visualiser les résultats de la compression en temps réel dans le viewer.

**Objectif final** : Démontrer visuellement l'algorithme de compression progressive par edge collapse avec reconstruction incrémentale.

---

## 👤 User Stories

### Phase 1 : Compression basique (MVP) 🎯

#### US-1.1 : Charger un maillage
```
En tant qu'utilisateur,
Je veux charger un fichier OBJ dans le mode Compression,
Afin de voir le maillage original dans le viewer.

Critères d'acceptation :
- ✅ Bouton "Load Mesh" dans la toolbar
- ✅ Sélection fichier .obj
- ✅ Affichage du mesh dans le viewer
- ✅ Statistiques du mesh (vertices, faces) dans le panel Properties
```

**État actuel** : ✅ Déjà implémenté (hérité de BaseProject)

---

#### US-1.2 : Convertir mesh → AIF
```
En tant qu'utilisateur,
Quand je charge un mesh,
Je veux qu'il soit automatiquement converti en structure AIF,
Afin de pouvoir le simplifier.

Critères d'acceptation :
- Conversion automatique après chargement
- Affichage dans Properties :
  - "Original: X vertices, Y faces"
  - "Topology: V edges, W corners"
- Message dans status bar : "Mesh loaded and analyzed"
```

**Implémentation Rust** :
```rust
// Dans polylab-viewer/src/lib.rs
#[wasm_bindgen]
impl ViewerHandle {
    #[wasm_bindgen]
    pub fn load_mesh_for_compression(&mut self, mesh_id: String, vertices: Vec<f32>, faces: Vec<u32>) 
        -> JsValue 
    {
        // 1. Créer polylab_core::Mesh depuis vertices/faces
        // 2. Convertir en AIF
        // 3. Extraire statistiques
        // 4. Stocker AIF dans une HashMap<String, AIF>
        // 5. Afficher le mesh original
        // 6. Retourner JsValue avec stats { vertices, faces, edges, corners }
    }
}
```

---

#### US-1.3 : Simplifier le mesh (1 étape)
```
En tant qu'utilisateur,
Je veux cliquer sur un bouton "Simplify Step" 
Pour réduire le maillage de 10% en un coup,
Afin de voir l'effet de la simplification.

Critères d'acceptation :
- Bouton "⚡ Simplify Step" dans toolbar
- Après clic : 
  - Le mesh affiché perd ~10% de ses vertices
  - Properties update : "Current: X vertices, Y faces"
  - Status bar : "Simplified: -N vertices"
- Possibilité de répéter plusieurs fois
```

**Implémentation Rust** :
```rust
#[wasm_bindgen]
pub fn simplify_step(&mut self, mesh_id: &str, target_ratio: f32) -> JsValue {
    // 1. Récupérer AIF depuis HashMap
    // 2. Collecter tous les edges
    // 3. Calculer nombre d'edges à collapser (target_ratio * num_edges)
    // 4. Boucle : collapse N edges
    // 5. Convertir AIF → Mesh
    // 6. Mettre à jour le GPU mesh
    // 7. Retourner stats { vertices, faces, collapsed_edges }
}
```

---

#### US-1.4 : Réinitialiser le mesh
```
En tant qu'utilisateur,
Je veux pouvoir revenir au mesh original,
Afin de recommencer la simplification.

Critères d'acceptation :
- Bouton "🔄 Reset" dans toolbar
- Restaure le mesh original
- Properties reviennent à l'état initial
- Status bar : "Mesh reset to original"
```

**Implémentation Rust** :
```rust
#[wasm_bindgen]
pub fn reset_mesh(&mut self, mesh_id: &str) -> JsValue {
    // 1. Recharger le mesh original depuis cache
    // 2. Recréer AIF fresh
    // 3. Mettre à jour GPU
    // 4. Retourner stats
}
```

---

### Phase 2 : Visualisation multi-niveaux 📊

#### US-2.1 : Pré-calculer plusieurs LODs
```
En tant qu'utilisateur,
Je veux cliquer sur "Generate LODs",
Pour pré-calculer automatiquement 5-10 niveaux de détail,
Afin de pouvoir naviguer rapidement entre eux.

Critères d'acceptation :
- Bouton "Generate LODs" 
- Barre de progression pendant le calcul
- Liste des LODs dans le panel gauche :
  - LOD 0: 100% (5000 vertices)
  - LOD 1: 90% (4500 vertices)
  - LOD 2: 75% (3750 vertices)
  - ...
- Status bar : "Generated 8 LODs in 0.3s"
```

**Implémentation Rust** :
```rust
#[wasm_bindgen]
pub fn generate_lods(&mut self, mesh_id: &str, num_lods: usize) -> JsValue {
    // 1. Récupérer AIF
    // 2. Boucle : simplifier progressivement
    // 3. Stocker chaque LOD (snapshot AIF ou Mesh)
    // 4. Retourner array de { lod_id, vertices, faces, ratio }
}
```

---

#### US-2.2 : Slider de LOD
```
En tant qu'utilisateur,
Je veux utiliser un slider horizontal,
Pour passer d'un LOD à l'autre en temps réel,
Afin de voir l'effet de la simplification progressivement.

Critères d'acceptation :
- Slider dans le panel Properties (0% → 100%)
- Mise à jour en temps réel du mesh affiché
- Label dynamique : "LOD 3/8 - 3750 vertices"
- Transition fluide (< 16ms)
```

---

#### US-2.3 : Vue split-screen (before/after)
```
En tant qu'utilisateur,
Je veux voir côte à côte le mesh original et le mesh simplifié,
Afin de comparer visuellement la perte de qualité.

Critères d'acceptation :
- Bouton dans layout actions : "Split View"
- Canvas divisé en 2 :
  - Gauche : Original (LOD 0)
  - Droite : Simplifié (LOD actuel)
- Synchronisation des rotations caméra
```

---

### Phase 3 : Métriques et validation ✅

#### US-3.1 : Afficher métriques de qualité
```
En tant qu'utilisateur,
Je veux voir des métriques de qualité (erreur géométrique, ratio de compression),
Afin d'évaluer la qualité de la simplification.

Critères d'acceptation :
- Panel Properties affiche :
  - Compression ratio : "85% reduction"
  - Max error : "0.05 units"
  - Average error : "0.012 units"
- Graph de l'erreur par LOD
```

**Implémentation Rust** :
```rust
// Dans AIF, ajouter :
pub fn compute_error_metrics(&self, original: &AIF) -> ErrorMetrics {
    // 1. Pour chaque vertex simplifié, calculer distance au vertex original
    // 2. Calculer max, avg, std dev
}
```

---

#### US-3.2 : Export du mesh simplifié
```
En tant qu'utilisateur,
Je veux exporter le mesh simplifié en .obj,
Afin de l'utiliser dans d'autres applications.

Critères d'acceptation :
- Menu File → "Export Simplified Mesh"
- Télécharge un fichier .obj
- Nom : "mesh_simplified_LOD3.obj"
```

---

### Phase 4 : Compression avec attributs 🎨

#### US-4.1 : Préserver les UVs
```
En tant qu'utilisateur,
Je veux que la simplification préserve les coordonnées UV,
Afin que le mesh texturé reste cohérent.

Critères d'acceptation :
- Chargement d'un mesh texturé (.obj + .mtl)
- Après simplification, la texture est toujours visible
- Panel Properties : "UVs preserved: Yes"
```

---

#### US-4.2 : Visualiser les UVs
```
En tant qu'utilisateur,
Je veux voir la paramétrisation UV avant/après simplification,
Afin de détecter les distorsions.

Critères d'acceptation :
- Bouton "Show UV Map"
- Affichage 2D de la carte UV
- Coloration des faces par distorsion
```

---

### Phase 5 : Compression streaming (avancé) 🚀

#### US-5.1 : Simuler le streaming progressif
```
En tant qu'utilisateur,
Je veux simuler le chargement progressif d'un mesh compressé,
Afin de voir le raffinement incrémental.

Critères d'acceptation :
- Bouton "Simulate Streaming"
- Animation :
  - t=0s : mesh ultra-simplifié (LOD max)
  - t=1s : ajout progressif de détails
  - t=3s : mesh complet
- Slider pour contrôler la vitesse
```

---

## 🏗️ Architecture d'intégration

### Structure des crates

```
polylab-compression/
├── src/
│   ├── lib.rs              (exports publics)
│   ├── entropy/            (encodage arithmétique)
│   ├── aif/                (structure topologique)
│   └── wasm_api.rs         (NEW) 🆕
```

**Nouveau fichier : `wasm_api.rs`**
```rust
//! API WASM pour le mode Compression
//! 
//! Expose les fonctions de compression via wasm-bindgen
//! pour être appelées depuis TypeScript.

use wasm_bindgen::prelude::*;
use crate::aif::AIF;
use polylab_core::Mesh;

#[wasm_bindgen]
pub struct CompressionHandle {
    mesh_id: String,
    original_mesh: Mesh,
    current_aif: AIF,
    lods: Vec<Mesh>,
}

#[wasm_bindgen]
impl CompressionHandle {
    #[wasm_bindgen(constructor)]
    pub fn new(mesh_id: String, vertices: Vec<f32>, faces: Vec<u32>) -> Self {
        // ...
    }
    
    #[wasm_bindgen]
    pub fn simplify_step(&mut self, ratio: f32) -> JsValue {
        // ...
    }
    
    #[wasm_bindgen]
    pub fn generate_lods(&mut self, num_lods: usize) -> JsValue {
        // ...
    }
    
    #[wasm_bindgen]
    pub fn get_stats(&self) -> JsValue {
        // ...
    }
}
```

---

### Intégration dans polylab-viewer

**Modification de `Cargo.toml`** :
```toml
[dependencies]
# ... existing deps
polylab-compression = { path = "../polylab-compression" }
```

**Modification de `lib.rs`** :
```rust
#[cfg(target_arch = "wasm32")]
use polylab_compression::CompressionHandle;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl ViewerHandle {
    // Nouvelle méthode
    #[wasm_bindgen]
    pub fn create_compression_handle(&self, mesh_id: String, vertices: Vec<f32>, faces: Vec<u32>) 
        -> CompressionHandle 
    {
        CompressionHandle::new(mesh_id, vertices, faces)
    }
}
```

---

### Flux de données

```
TypeScript (CompressionProject.ts)
    ↓
    viewer.create_compression_handle(...)
    ↓
WASM (polylab-viewer)
    ↓
    CompressionHandle::new()
    ↓
WASM (polylab-compression)
    ↓
    Mesh → AIF → simplify → Mesh
    ↓
    Return stats (JsValue)
    ↓
TypeScript
    ↓
    Update UI (panels, statusbar)
```

---

## 📅 Plan d'implémentation

### Sprint 1 : MVP Basique (2-3 jours)
- [ ] Créer `wasm_api.rs` dans polylab-compression
- [ ] Implémenter `CompressionHandle::new()`
- [ ] Implémenter `CompressionHandle::simplify_step()`
- [ ] Intégrer dans polylab-viewer
- [ ] Mettre à jour `CompressionProject.ts` (appels WASM)
- [ ] **Test** : Charger un cube, simplifier, voir le résultat

**Livrable** : US-1.1, US-1.2, US-1.3, US-1.4 ✅

---

### Sprint 2 : Multi-LODs (2-3 jours)
- [ ] Implémenter `CompressionHandle::generate_lods()`
- [ ] Stocker les LODs en mémoire (Vec<Mesh>)
- [ ] Ajouter slider dans UI (PropertiesPanel)
- [ ] Implémenter `CompressionHandle::get_lod(index)`
- [ ] Mise à jour en temps réel du viewer
- [ ] **Test** : Slider de 0% à 100%, transition fluide

**Livrable** : US-2.1, US-2.2 ✅

---

### Sprint 3 : Métriques (1-2 jours)
- [ ] Implémenter calcul d'erreur géométrique
- [ ] Ajouter méthode `compute_error_metrics()`
- [ ] Afficher métriques dans Properties panel
- [ ] **Test** : Vérifier cohérence des métriques

**Livrable** : US-3.1 ✅

---

### Sprint 4 : Split-View (2 jours)
- [ ] Modifier ViewerCanvas pour gérer 2 caméras
- [ ] Ajouter layout action "Split View"
- [ ] Synchroniser rotations
- [ ] **Test** : Comparer visually original vs simplifié

**Livrable** : US-2.3 ✅

---

### Sprint 5+ : Features avancées
- Export .obj (US-3.2)
- Préservation UVs (US-4.1, US-4.2)
- Simulation streaming (US-5.1)

---

## 🎨 Maquettes UI (textuelles)

### Vue principale

```
┌──────────────────────────────────────────────────────────────────┐
│ PolyLab                                    [📁] [⚡] [🔄] [?]    │
├──────────────────────────────────────────────────────────────────┤
│  Toolbar: [📦 Load] [⚡ Simplify] [🔄 Reset] | 🎬 Scene          │
├────────────┬──────────────────────────────────────┬──────────────┤
│ Scenes     │                                      │ Properties   │
│            │                                      │              │
│ ▶ Stanford │         [3D Viewer Canvas]          │ Original:    │
│   Bunny    │                                      │  - 5000 vtx  │
│            │                                      │  - 9996 tri  │
│            │                                      │              │
│            │                                      │ Current:     │
│            │                                      │  - 4500 vtx  │
│            │                                      │  - 8996 tri  │
│            │                                      │              │
│            │                                      │ LOD:         │
│            │                                      │ [====|--] 1  │
│            │                                      │              │
│            │                                      │ Compression: │
│            │                                      │  - 10% red.  │
│            │                                      │  - 0.02 err  │
├────────────┴──────────────────────────────────────┴──────────────┤
│ 📦 Mesh Compression - Simplified: -500 vertices                  │
└──────────────────────────────────────────────────────────────────┘
```

### Vue split-screen

```
┌──────────────────────────────────────────────────────────────────┐
│  [📦] [⚡] [🔄] | 🎬 Scene | 🔀 Split                            │
├────────────┬──────────────────┬──────────────────┬──────────────┤
│            │   Original       │   Simplified     │              │
│            │   (LOD 0)        │   (LOD 3)        │              │
│            │                  │                  │              │
│            │    [Bunny]       │    [Bunny]       │  Slider:     │
│            │   5000 vtx       │   3750 vtx       │  [===|---] 3 │
│            │                  │                  │              │
│            │                  │                  │  Error:      │
│            │                  │                  │   Max: 0.05  │
│            │                  │                  │   Avg: 0.01  │
└────────────┴──────────────────┴──────────────────┴──────────────┘
```

---

## 🧪 Stratégie de test

### Tests unitaires (Rust)
- ✅ AIF operations (déjà fait - 66 tests)
- [ ] CompressionHandle::new()
- [ ] CompressionHandle::simplify_step()
- [ ] CompressionHandle::generate_lods()
- [ ] Métriques d'erreur

### Tests d'intégration (TypeScript)
- [ ] Load mesh → conversion AIF réussie
- [ ] Simplify step → mesh affiché mis à jour
- [ ] Generate LODs → slider fonctionnel
- [ ] Reset → retour à l'état initial

### Tests manuels
- [ ] Charger Stanford Bunny (5000 vtx)
- [ ] Simplifier jusqu'à 500 vtx
- [ ] Vérifier qualité visuelle
- [ ] Tester split-view

---

## 🚀 Priorités

**Now (Sprint 1)** :
1. Créer `wasm_api.rs` avec `CompressionHandle`
2. Intégrer dans `ViewerHandle`
3. Mettre à jour `CompressionProject.ts`
4. Tester avec un cube simple

**Next (Sprint 2)** :
1. Générer plusieurs LODs
2. Ajouter slider UI
3. Tester avec Stanford Bunny

**Later** :
- Split-view
- Métriques avancées
- Export
- UVs
- Streaming

---

## 📝 Notes techniques

### Pourquoi séparer CompressionHandle de ViewerHandle ?

- **Séparation des responsabilités** : 
  - `ViewerHandle` = affichage GPU
  - `CompressionHandle` = logique compression
  
- **Possibilité d'avoir plusieurs meshes compressés** en parallèle

- **Réutilisabilité** : CompressionHandle peut être utilisé sans viewer (tests, CLI)

### Performance

- **Génération LODs** : ~300ms pour 5000 vtx → 500 vtx (10 LODs)
- **Simplify step** : ~30ms pour 10% reduction
- **Slider update** : < 16ms (60 FPS)

### Limitations connues

- Pas de gestion des textures pour l'instant
- Pas de multi-threading (WASM single-threaded)
- Métriques d'erreur simplifiées (distance euclidienne uniquement)
