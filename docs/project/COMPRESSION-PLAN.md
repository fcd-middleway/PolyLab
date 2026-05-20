# Mode Compression - Plan d'Action

## 📋 Résumé

J'ai analysé l'application PolyLab et créé un plan complet pour intégrer le module de compression que nous avons développé.

**Documents créés** :
1. **[COMPRESSION-ROADMAP.md](COMPRESSION-ROADMAP.md)** - User Stories & Plan par sprints
2. **[COMPRESSION-ARCHITECTURE.md](COMPRESSION-ARCHITECTURE.md)** - Architecture technique détaillée

---

## 🎯 Vision

Permettre à l'utilisateur de :
1. Charger un maillage 3D (.obj)
2. Le simplifier progressivement (edge collapse)
3. Visualiser les résultats en temps réel
4. Générer et naviguer entre plusieurs niveaux de détail (LODs)
5. Comparer visuellement original vs simplifié

**À terme** : Mode interactif complet pour explorer la compression progressive de maillages.

---

## 📱 Interface proposée

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

## 🏗️ Architecture

### Flux de données

```
TypeScript                WASM Boundary              Rust
─────────────────────────────────────────────────────────────
CompressionProject.ts
    │
    ├─> viewer.create_compression_handle(...)
    │                  │
    │                  └──────────> CompressionHandle::new()
    │                                     │
    │                                     ├─> Mesh → AIF
    │                                     └─> Store in memory
    │
    ├─> compressionHandle.simplify_step(0.9)
    │                  │
    │                  └──────────> collapse_edge() × N times
    │                                     │
    │                                     └─> AIF → Mesh
    │                  ◄──────────
    │   { vertices, faces, stats }
    │
    └─> viewer.update_mesh(vertices, faces)
             │
             └─────────────────> Update GPU buffers
```

### Nouveaux fichiers

```
polylab-compression/
├── src/
│   ├── wasm_api.rs         🆕 API WASM
│   ├── aif/                ✅ Déjà fait
│   └── entropy/            ✅ Déjà fait

polylab-viewer/
└── src/
    └── lib.rs              ➕ Add compression methods
```

---

## 📅 Plan d'implémentation

### Sprint 1 : MVP Basique (2-3 jours) 🎯

**Objectif** : Load → Simplify → Reset fonctionnel

#### Étape 1 : Créer l'API WASM (Rust)

**Fichier** : `polylab-compression/src/wasm_api.rs`

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
        // TODO: Implement
    }
    
    #[wasm_bindgen]
    pub fn simplify_step(&mut self, target_ratio: f32) -> JsValue {
        // TODO: Implement
    }
    
    #[wasm_bindgen]
    pub fn reset(&mut self) -> JsValue {
        // TODO: Implement
    }
    
    #[wasm_bindgen]
    pub fn get_stats(&self) -> JsValue {
        // TODO: Implement
    }
}
```

**Tâches** :
- [ ] Créer le fichier
- [ ] Implémenter `new()` : créer Mesh, convertir en AIF
- [ ] Implémenter `simplify_step()` : collapse N edges, return new mesh
- [ ] Implémenter `reset()` : reload original mesh
- [ ] Implémenter `get_stats()` : return stats as JsValue
- [ ] Ajouter `pub mod wasm_api;` dans `lib.rs`

#### Étape 2 : Intégrer dans le viewer (Rust)

**Fichier** : `polylab-viewer/src/lib.rs`

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

**Tâches** :
- [ ] Ajouter dépendance `polylab-compression` dans Cargo.toml
- [ ] Ajouter méthode `create_compression_handle()`
- [ ] Vérifier que `update_mesh()` existe (pour mettre à jour le GPU)

#### Étape 3 : Mettre à jour l'UI (TypeScript)

**Fichier** : `code/app/web/src/projects/CompressionProject.ts`

```typescript
private compressionHandle: any = null;

protected async onMeshLoaded(meshId: string, mesh: any) {
    // Create compression handle
    this.compressionHandle = await this.viewer!.create_compression_handle(
        meshId,
        Array.from(mesh.vertices),
        Array.from(mesh.indices)
    );
    
    // Get initial stats
    const stats = this.compressionHandle.get_stats();
    this.displayStats(stats);
}

private async compressMesh() {
    if (!this.compressionHandle) return;
    
    // Simplify by 10%
    const result = this.compressionHandle.simplify_step(0.9);
    
    // Update viewer
    this.viewer!.update_mesh(
        this.currentMeshId,
        new Float32Array(result.vertices),
        new Uint32Array(result.faces)
    );
    
    // Update UI
    this.displayStats(result.stats);
    this.statusBar?.updateStats({ 
        status: `Simplified: -${result.stats.collapsed} vertices` 
    });
}

private async resetMesh() {
    if (!this.compressionHandle) return;
    
    const result = this.compressionHandle.reset();
    
    this.viewer!.update_mesh(
        this.currentMeshId,
        new Float32Array(result.vertices),
        new Uint32Array(result.faces)
    );
    
    this.displayStats(result.stats);
    this.statusBar?.updateStats({ status: 'Mesh reset' });
}

private displayStats(stats: any) {
    this.detailsPanel?.addProperty('Original', {
        Vertices: stats.original_vertices,
        Faces: stats.original_faces
    });
    
    this.detailsPanel?.addProperty('Current', {
        Vertices: stats.vertices,
        Faces: stats.faces,
        Edges: stats.edges
    });
    
    this.detailsPanel?.addProperty('Compression', {
        Reduction: `${(stats.compression_ratio * 100).toFixed(1)}%`
    });
}
```

**Tâches** :
- [ ] Modifier `onMeshLoaded()` pour créer le handle
- [ ] Implémenter `compressMesh()` (appel WASM)
- [ ] Ajouter méthode `resetMesh()`
- [ ] Implémenter `displayStats()`
- [ ] Ajouter bouton "Reset" dans toolbar config

#### Étape 4 : Tests

**Scénarios de test** :
1. Charger `test-assets/cube.obj`
2. Vérifier stats initiales (8 vertices, 12 faces)
3. Cliquer "Simplify" 3 fois
4. Vérifier que le mesh se simplifie visuellement
5. Cliquer "Reset"
6. Vérifier retour à l'état initial

---

### Sprint 2 : Multi-LODs (2-3 jours)

**Objectif** : Générer et naviguer entre plusieurs LODs

#### Nouvelles fonctionnalités

1. **Bouton "Generate LODs"** dans toolbar
2. **Slider LOD** dans PropertiesPanel
3. **Liste des LODs** dans MeshPanel

#### Implémentation Rust

```rust
#[wasm_bindgen]
impl CompressionHandle {
    #[wasm_bindgen]
    pub fn generate_lods(&mut self, num_lods: usize) -> JsValue {
        // Progressive simplification
        // Store LOD snapshots
        // Return metadata array
    }
    
    #[wasm_bindgen]
    pub fn get_lod_mesh(&self, index: usize) -> JsValue {
        // Return mesh for specific LOD
    }
}
```

#### Implémentation TypeScript

```typescript
private async generateLODs() {
    const lods = this.compressionHandle.generate_lods(8);
    this.createLODSlider(lods);
}

private createLODSlider(lods: any[]) {
    // Add slider to PropertiesPanel
    // On change: call get_lod_mesh() and update viewer
}
```

---

## 🎯 Critères de succès

### Sprint 1 (MVP)
- [ ] ✅ Charger un .obj → voir le mesh
- [ ] ✅ Cliquer "Simplify" → mesh se simplifie de 10%
- [ ] ✅ Répéter 5-10 fois → mesh devient très simple
- [ ] ✅ Cliquer "Reset" → mesh revient à l'original
- [ ] ✅ Stats cohérentes à chaque étape

### Sprint 2 (LODs)
- [ ] ✅ Cliquer "Generate LODs" → création de 8 niveaux
- [ ] ✅ Slider de 0% à 100% → transition fluide
- [ ] ✅ Label dynamique : "LOD 3/8 - 3750 vertices"

---

## 📝 Prochaines étapes

**Maintenant** :
1. Créer `wasm_api.rs` dans polylab-compression
2. Implémenter `CompressionHandle` avec méthodes de base
3. Intégrer dans polylab-viewer
4. Tester avec un cube

**Cette semaine** :
- Sprint 1 complet (MVP)
- Premier test avec Stanford Bunny

**Semaine prochaine** :
- Sprint 2 (multi-LODs)
- Tests de performance

---

## 🔧 Commandes utiles

```bash
# Build WASM (compression + viewer)
cd code/crates/polylab-compression
wasm-pack build --target web

cd ../polylab-viewer
wasm-pack build --target web

# Run web app
cd ../../app/web
npm run dev

# Run tests
cargo test -p polylab-compression
```

---

## 📚 Documentation

- **[COMPRESSION-ROADMAP.md](COMPRESSION-ROADMAP.md)** : User Stories détaillées (5 phases)
- **[COMPRESSION-ARCHITECTURE.md](COMPRESSION-ARCHITECTURE.md)** : Architecture technique complète
- **[README.md](../../README.md)** : Setup du projet

---

## 💡 Questions ouvertes

1. **Priorité des edges** : Random ou QEM (Quadric Error Metrics) ?
   - Sprint 1 : Random (simple)
   - Sprint 3 : QEM (meilleure qualité)

2. **Stockage des LODs** : En mémoire ou sérializé ?
   - Sprint 2 : En mémoire (Vec<Mesh>)
   - Plus tard : Sérializé si trop gros

3. **UI du slider** : Range input HTML ou custom ?
   - Sprint 2 : Range input (simple)
   - Plus tard : Custom avec preview

---

## ✅ État actuel

**Phase actuelle** : Planification  
**Prochaine action** : Créer `wasm_api.rs`  
**Durée estimée Sprint 1** : 2-3 jours

---

**Prêt à commencer ?** 🚀

Dis-moi si tu veux :
- A) Commencer l'implémentation du Sprint 1 maintenant
- B) Modifier/affiner les user stories
- C) Discuter de l'architecture
- D) Autre chose
