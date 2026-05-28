# Compression Progressive - Plan d'Implémentation

## 📋 Vue d'ensemble

Ce document consolide le plan d'architecture et d'implémentation pour le mode Compression progressive de maillages 3D dans PolyLab.

**Objectif** : Permettre la simplification et la visualisation progressive de maillages 3D via edge collapse, avec support pour maillages texturés, polygonaux et non-variétés.

---

## 🎯 User Stories & Roadmap

### Phase 1 : Compression basique (MVP) 🎯

#### US-1.1 : Charger un maillage ✅
En tant qu'utilisateur, je veux charger un fichier OBJ dans le mode Compression pour voir le maillage original dans le viewer.

**Critères d'acceptation** :
- ✅ Bouton "Load Mesh" dans la toolbar
- ✅ Sélection fichier .obj
- ✅ Affichage du mesh dans le viewer
- ✅ Statistiques du mesh dans Properties panel

**État** : Déjà implémenté (hérité de BaseProject)

---

#### US-1.2 : Convertir mesh → AIF
En tant qu'utilisateur, quand je charge un mesh, je veux qu'il soit automatiquement converti en structure AIF pour pouvoir le simplifier.

**Critères d'acceptation** :
- Conversion automatique après chargement
- Affichage dans Properties : "Original: X vertices, Y faces, Z edges"
- Message status bar : "Mesh loaded and analyzed"

---

#### US-1.3 : Simplifier le mesh (1 étape)
En tant qu'utilisateur, je veux cliquer sur "Simplify Step" pour réduire le maillage de 10% et voir l'effet.

**Critères d'acceptation** :
- Bouton "⚡ Simplify Step" dans toolbar
- Réduction ~10% vertices après clic
- Properties update : "Current: X vertices, Y faces"
- Status bar : "Simplified: -N vertices"
- Possibilité de répéter

---

#### US-1.4 : Réinitialiser le mesh
En tant qu'utilisateur, je veux revenir au mesh original pour recommencer la simplification.

**Critères d'acceptation** :
- Bouton "🔄 Reset" dans toolbar
- Restaure le mesh original
- Properties reviennent à l'état initial
- Status bar : "Mesh reset to original"

---

### Phase 2 : Visualisation multi-niveaux 📊

#### US-2.1 : Pré-calculer plusieurs LODs
En tant qu'utilisateur, je veux cliquer sur "Generate LODs" pour pré-calculer 5-10 niveaux de détail et naviguer rapidement entre eux.

**Critères d'acceptation** :
- Bouton "Generate LODs"
- Barre de progression
- Liste des LODs dans panel gauche :
  - LOD 0: 100% (5000 vertices)
  - LOD 1: 90% (4500 vertices)
  - LOD 2: 75% (3750 vertices)
  - ...
- Status bar : "Generated 8 LODs in 0.3s"

---

#### US-2.2 : Slider de LOD
En tant qu'utilisateur, je veux utiliser un slider horizontal pour passer d'un LOD à l'autre en temps réel.

**Critères d'acceptation** :
- Slider dans Properties panel (0% → 100%)
- Mise à jour temps réel du mesh
- Label dynamique : "LOD 3/8 - 3750 vertices"
- Transition fluide (< 16ms)

---

#### US-2.3 : Vue split-screen (before/after)
En tant qu'utilisateur, je veux voir côte à côte le mesh original et le mesh simplifié pour comparer visuellement.

**Critères d'acceptation** :
- Bouton "Split View" dans layout actions
- Canvas divisé en 2 : Original (gauche) | Simplifié (droite)
- Synchronisation des rotations caméra

---

### Phase 3 : Métriques et validation ✅

#### US-3.1 : Afficher métriques de qualité
En tant qu'utilisateur, je veux voir des métriques (erreur géométrique, ratio de compression) pour évaluer la qualité.

**Critères d'acceptation** :
- Panel Properties affiche :
  - Ratio de compression : 10%
  - Erreur RMS : 0.05
  - Erreur max : 0.15

---

## 🏗️ Architecture Technique

### Flux de données

```
TypeScript (UI Layer)                WASM Boundary              Rust (Logic Layer)
─────────────────────────────────────────────────────────────────────────────────────
CompressionProject.ts
    │
    ├─> viewer.create_compression_handle(...)
    │                  │
    │                  └──────────> CompressionHandle::new()
    │                                     │
    │                                     ├─> Mesh → AIF conversion
    │                                     └─> Store in memory
    │
    ├─> compressionHandle.simplify_step(0.9)
    │                  │
    │                  └──────────> collapse_edge() × N times
    │                                     │
    │                                     └─> AIF → Mesh conversion
    │                  ◄──────────
    │   { vertices, faces, stats }
    │
    └─> viewer.update_mesh(vertices, faces)
             │
             └─────────────────> Update GPU buffers
```

---

### Structure de données

#### polylab-compression/src/wasm_api.rs 🆕

```rust
use wasm_bindgen::prelude::*;
use crate::aif::AIF;
use polylab_core::Mesh;
use serde::{Serialize, Deserialize};

#[derive(Serialize)]
pub struct CompressionStats {
    pub vertices: usize,
    pub faces: usize,
    pub edges: usize,
    pub compression_ratio: f32,
}

#[wasm_bindgen]
pub struct CompressionHandle {
    mesh_id: String,
    original_mesh: Mesh,
    current_aif: AIF,
}

#[wasm_bindgen]
impl CompressionHandle {
    #[wasm_bindgen(constructor)]
    pub fn new(mesh_id: String, vertices: Vec<f32>, faces: Vec<u32>) 
        -> Result<CompressionHandle, JsValue> 
    {
        // 1. Créer polylab_core::Mesh
        // 2. Convertir Mesh → AIF
        // 3. Stocker original + current
        // 4. Retourner handle
    }
    
    #[wasm_bindgen]
    pub fn simplify_step(&mut self, target_ratio: f32) -> JsValue {
        // 1. Récupérer edges de current_aif
        // 2. Calculer nombre d'edges à collapser
        // 3. Boucle : collapse N edges
        // 4. Convertir AIF → Mesh
        // 5. Extraire vertices, faces
        // 6. Retourner JsValue avec stats
    }
    
    #[wasm_bindgen]
    pub fn reset(&mut self) -> JsValue {
        // 1. Recharger original_mesh
        // 2. Recréer AIF fresh
        // 3. Retourner stats
    }
    
    #[wasm_bindgen]
    pub fn get_stats(&self) -> JsValue {
        // Retourner { vertices, faces, edges, compression_ratio }
    }
    
    #[wasm_bindgen]
    pub fn generate_lods(&mut self, num_lods: usize) -> JsValue {
        // 1. Boucle : simplifier progressivement
        // 2. Stocker chaque LOD (snapshot)
        // 3. Retourner array de stats LOD
    }
    
    #[wasm_bindgen]
    pub fn get_lod_mesh(&self, index: usize) -> JsValue {
        // Convertir LOD snapshot → (vertices, faces)
    }
}
```

---

#### polylab-viewer/src/lib.rs ➕

```rust
#[cfg(target_arch = "wasm32")]
use polylab_compression::CompressionHandle;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl ViewerHandle {
    #[wasm_bindgen]
    pub fn create_compression_handle(
        &self, 
        mesh_id: String, 
        vertices: Vec<f32>, 
        faces: Vec<u32>
    ) -> Result<CompressionHandle, JsValue> {
        CompressionHandle::new(mesh_id, vertices, faces)
    }
}
```

---

### Interface TypeScript

#### code/app/web/src/projects/CompressionProject.ts 🆕

```typescript
import { BaseProject } from './BaseProject';
import { ViewerHandle } from '../../wasm/polylab_viewer';

export class CompressionProject extends BaseProject {
    private compressionHandle?: any; // CompressionHandle from WASM
    private currentMeshId?: string;
    
    async compressMesh() {
        if (!this.compressionHandle) return;
        
        // Appel WASM
        const result = this.compressionHandle.simplify_step(0.9);
        const { vertices, faces, stats } = result;
        
        // Mise à jour GPU
        this.viewer.update_mesh(this.currentMeshId!, vertices, faces);
        
        // Mise à jour UI
        this.updateProperties(stats);
        this.showStatus(`Simplified: -${stats.collapsed} vertices`);
    }
    
    async resetMesh() {
        if (!this.compressionHandle) return;
        
        const result = this.compressionHandle.reset();
        const { vertices, faces, stats } = result;
        
        this.viewer.update_mesh(this.currentMeshId!, vertices, faces);
        this.updateProperties(stats);
        this.showStatus('Mesh reset to original');
    }
    
    async generateLODs() {
        if (!this.compressionHandle) return;
        
        const result = this.compressionHandle.generate_lods(8);
        this.showStatus(`Generated ${result.length} LODs`);
        this.populateLODList(result);
    }
}
```

---

## 📱 Interface Utilisateur Proposée

### Vue principale (Sprint 1)

```
┌──────────────────────────────────────────────────────────┐
│ PolyLab                              [📁] [⚡] [🔄] [?] │
├──────────────────────────────────────────────────────────┤
│  [📦 Load] [⚡ Simplify] [🔄 Reset] | 🎬 Scene          │
├──────┬───────────────────────────────────────┬──────────┤
│ Mesh │         [3D Viewer Canvas]           │ Stats    │
│ List │                                       │          │
│      │                                       │ Original:│
│ ▶ 📦 │                                       │ 5000 vtx │
│ Cube │                                       │ 9996 tri │
│      │                                       │          │
│      │                                       │ Current: │
│      │                                       │ 4500 vtx │
│      │                                       │ 8996 tri │
│      │                                       │          │
│      │                                       │ Compress:│
│      │                                       │ 10% red. │
├──────┴───────────────────────────────────────┴──────────┤
│ 📦 Mesh Compression - Simplified: -500 vertices         │
└──────────────────────────────────────────────────────────┘
```

### Actions utilisateur

1. **Load** → Ouvre file picker → Charge .obj → Affiche dans viewer
2. **Simplify** → Réduit de 10% → Met à jour l'affichage
3. **Reset** → Restaure le mesh original

---

## 📅 Plan d'Implémentation

### Sprint 1 : MVP Basique (2-3 jours) 🎯

**Objectif** : Load → Simplify → Reset fonctionnel

#### Étape 1 : Créer l'API WASM (Rust)

**Tâches** :
- [ ] Créer `polylab-compression/src/wasm_api.rs`
- [ ] Implémenter `CompressionHandle::new()` : créer Mesh, convertir en AIF
- [ ] Implémenter `simplify_step()` : collapse N edges, return new mesh
- [ ] Implémenter `reset()` : reload original mesh
- [ ] Implémenter `get_stats()` : return stats as JsValue
- [ ] Ajouter `pub mod wasm_api;` dans `lib.rs`

---

#### Étape 2 : Intégrer dans le viewer (Rust)

**Tâches** :
- [ ] Ajouter dépendance `polylab-compression` dans `polylab-viewer/Cargo.toml`
- [ ] Ajouter méthode `create_compression_handle()` dans `ViewerHandle`
- [ ] Vérifier que `update_mesh()` existe

---

#### Étape 3 : Mettre à jour l'UI (TypeScript)

**Tâches** :
- [ ] Créer `CompressionProject.ts`
- [ ] Ajouter boutons toolbar : Load, Simplify, Reset
- [ ] Implémenter `compressMesh()`, `resetMesh()`
- [ ] Créer `PropertiesPanel` avec stats Original/Current
- [ ] Ajouter à `projectRegistry.ts`

---

### Sprint 2 : LODs & Navigation (2-3 jours)

**Objectif** : Génération et navigation entre LODs

#### Étape 4 : Génération LODs (Rust)

**Tâches** :
- [ ] Implémenter `CompressionHandle::generate_lods()`
- [ ] Stocker snapshots LOD (Vec<LODSnapshot>)
- [ ] Implémenter `get_lod_mesh(index)`

---

#### Étape 5 : UI Navigation LODs (TypeScript)

**Tâches** :
- [ ] Ajouter bouton "Generate LODs"
- [ ] Créer `LODListPanel` (liste des LODs disponibles)
- [ ] Ajouter slider horizontal pour navigation
- [ ] Bind slider → `get_lod_mesh()` → `update_mesh()`

---

### Sprint 3 : Vue comparaison & métriques (2 jours)

#### Étape 6 : Split-screen

**Tâches** :
- [ ] Ajouter bouton "Split View"
- [ ] Créer 2 canvas WebGPU côte à côte
- [ ] Synchroniser caméras

---

#### Étape 7 : Métriques de qualité

**Tâches** :
- [ ] Calculer erreur géométrique (RMS, max)
- [ ] Afficher dans Properties panel
- [ ] Visualiser heatmap d'erreur (optionnel)

---

## 📦 Nouveaux Fichiers

```
polylab-compression/
├── src/
│   ├── wasm_api.rs         🆕 API WASM
│   ├── aif/                ✅ Déjà fait
│   └── entropy/            ✅ Déjà fait

polylab-viewer/
└── src/
    └── lib.rs              ➕ Add compression methods

code/app/web/src/
└── projects/
    └── CompressionProject.ts  🆕
```

---

## 🔧 Dépendances

### polylab-compression/Cargo.toml
```toml
[dependencies]
polylab-core = { path = "../polylab-core" }
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
```

### polylab-viewer/Cargo.toml
```toml
[dependencies]
polylab-compression = { path = "../polylab-compression" }
```

---

## ✅ Critères de Succès

### Sprint 1 (MVP)
- ✅ Charger un mesh .obj
- ✅ Simplifier par étapes de 10%
- ✅ Réinitialiser au mesh original
- ✅ Afficher statistiques en temps réel

### Sprint 2 (LODs)
- ✅ Générer 8 LODs automatiquement
- ✅ Naviguer avec slider
- ✅ Transition fluide < 16ms

### Sprint 3 (Validation)
- ✅ Vue split-screen fonctionnelle
- ✅ Métriques d'erreur calculées

---

**Dernière mise à jour** : Documentation consolidée depuis COMPRESSION-ARCHITECTURE.md, COMPRESSION-PLAN.md, COMPRESSION-ROADMAP.md
