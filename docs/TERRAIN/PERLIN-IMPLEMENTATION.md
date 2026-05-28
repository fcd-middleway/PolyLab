# Terrain Generation - Implémentation Perlin

## 📊 Status Global

**Phase 1** : ✅ **TERMINÉE**
- Crate `polylab-terrain` créé et fonctionnel
- Structure de données centrale `TerrainData` opérationnelle
- Pipeline minimal (4 étapes) implémenté
- Bindings WASM testés et validés
- Layout multi-vues implémenté dans PerlinProject

**Phase 2** (Érosion et hydrologie) : ⏳ **EN ATTENTE**
**Phase 3** (Matériaux et visualisation avancée) : ⏳ **EN ATTENTE**

---

## 🎯 Objectif du Projet

Créer un système complet de génération de terrain procédural avec :
1. ✅ Génération heightmap via bruit Perlin multi-octaves (fBm)
2. ✅ Calcul de cartes dérivées (pente, flux, humidité, etc.)
3. ✅ Construction de mesh 3D triangulé avec couleurs
4. ✅ Visualisation multi-vues (3D + cartes 2D)
5. ⏳ Érosion thermique et hydraulique
6. ⏳ Classification matériaux et splat maps

---

## 🏗️ Architecture - Crate `polylab-terrain`

### Structure de fichiers

```
code/crates/polylab-terrain/
├── Cargo.toml
├── src/
│   ├── lib.rs                    # Exports publics
│   ├── terrain_data.rs          # Structure centrale TerrainData
│   ├── maps.rs                  # Types de cartes (HeightMap, ScalarMap, etc.)
│   ├── pipeline.rs              # Système de pipeline modulaire
│   ├── stages/
│   │   ├── mod.rs
│   │   ├── noise_generation.rs # Étape 1: Génération bruit Perlin
│   │   ├── slope_calculation.rs # Étape 2: Calcul pente
│   │   └── mesh_building.rs    # Étape 3: Construction mesh 3D
│   └── wasm_bindings.rs         # API WASM pour TypeScript
```

**Statut compilation** : ✅ 0 erreurs (compilation réussie en 3.86s)

---

## 📦 Structure de Données Centrale

### `TerrainData` (terrain_data.rs)

**Rôle** : Container central pour toutes les données de terrain (équivalent de AIF pour compression)

```rust
pub struct TerrainData {
    pub metadata: TerrainMetadata,          // Configuration + stats
    heightmap: HeightMap,                   // Hauteurs (obligatoire)
    slope_map: Option<ScalarMap>,           // Pentes (optionnel)
    flow_direction: Option<FlowDirectionMap>, // Directions flux (optionnel)
    flow_accumulation: Option<ScalarMap>,   // Accumulation flux (optionnel)
    moisture_map: Option<ScalarMap>,        // Humidité (optionnel)
    sediment_map: Option<ScalarMap>,        // Sédiments (optionnel)
    material_weights: Option<MaterialWeightMaps>, // Poids matériaux (optionnel)
    mesh: Option<Mesh>,                     // Mesh 3D généré (optionnel)
}

pub struct TerrainMetadata {
    pub width: usize,
    pub height: usize,
    pub resolution: f32,    // Espacement entre points (mètres)
    pub seed: u64,
    pub num_vertices: usize,
    pub num_faces: usize,
}
```

**Caractéristiques** :
- ✅ Extensible : toutes les cartes dérivées sont optionnelles
- ✅ Réutilisable : utilisable dans tout le projet PolyLab
- ✅ API claire : getters immutables et mutables, setters avec validation

---

### Types de Cartes (maps.rs)

#### `HeightMap`
**Rôle** : Grille 2D de hauteurs (données de base, obligatoire)

```rust
pub struct HeightMap {
    data: Vec<f32>,
    width: usize,
    height: usize,
}
```

**API** :
- `get(x, y) -> Option<f32>` : Lecture safe
- `set(x, y, value)` : Écriture avec validation
- `get_mut(x, y) -> Option<&mut f32>` : Accès mutable
- `normalize()` : Normalisation dans [0, 1]

---

#### `ScalarMap`
**Rôle** : Carte scalaire générique (pente, accumulation, humidité, etc.)

Structure identique à `HeightMap`, mais sémantique différente.

**Usage** :
- Slope map : valeurs en [0, 1] (0 = plat, 1 = vertical)
- Flow accumulation : nombre de cellules drainées
- Moisture map : humidité du sol
- Sediment map : quantité de sédiments

---

#### `FlowDirectionMap`
**Rôle** : Directions d'écoulement (algorithme D8)

```rust
pub struct FlowDirectionMap {
    data: Vec<FlowDirection>,
    width: usize,
    height: usize,
}

pub enum FlowDirection {
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest,
    None, // Sink ou flat
}
```

**Usage** : Simulation écoulement d'eau pour rivières et lacs

---

#### `MaterialWeightMaps`
**Rôle** : Poids multi-matériaux pour splat mapping

```rust
pub struct MaterialWeightMaps {
    num_materials: usize,
    weights: Vec<Vec<f32>>, // weights[material_id][cell_index]
    width: usize,
    height: usize,
}
```

**Usage** : Définir répartition de matériaux (herbe, roche, sable, neige, etc.)

---

## 🔄 Système de Pipeline

### Architecture Modulaire

```rust
// pipeline.rs
pub trait PipelineStage {
    fn name(&self) -> &str;
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError>;
    fn can_execute(&self, terrain: &TerrainData) -> Result<(), TerrainError>;
}

pub struct Pipeline {
    stages: Vec<Box<dyn PipelineStage>>,
}
```

**Principe** : Chaque étape = transformation de `TerrainData`

**Validation** : `can_execute()` vérifie les prérequis avant exécution

---

### Pipeline Minimal (Phase 1)

#### Étape 1 : `NoiseGenerationStage` (noise_generation.rs)

**Rôle** : Remplir la heightmap avec bruit Perlin multi-octaves (fBm)

**Paramètres** :
```rust
pub struct NoiseGenerationConfig {
    pub frequency: f64,     // Fréquence de base (ex: 0.05)
    pub octaves: usize,     // Nombre d'octaves (ex: 6)
    pub persistence: f64,   // Amplitude des octaves (ex: 0.5)
    pub lacunarity: f64,    // Fréquence des octaves (ex: 2.0)
    pub height_scale: f32,  // Échelle verticale (ex: 50.0)
}
```

**Algorithme** : Fractional Brownian Motion (fBm)
```
height = 0
amplitude = 1
frequency = base_frequency

for octave in 0..octaves:
    height += amplitude * perlin_noise(x * frequency, y * frequency, seed)
    amplitude *= persistence
    frequency *= lacunarity

height *= height_scale
```

**Output** : `terrain.heightmap` rempli avec valeurs de hauteur

---

#### Étape 2 : `SlopeCalculationStage` (slope_calculation.rs)

**Rôle** : Calculer la carte de pente à partir de la heightmap

**Algorithme** : Gradient 8-voisins avec distance euclidienne
```
Pour chaque cellule (x, y):
    max_slope = 0
    
    Pour chaque voisin (nx, ny) dans 8 directions:
        dh = height[x, y] - height[nx, ny]
        distance = resolution * sqrt((nx-x)² + (ny-y)²)
        slope = abs(dh) / distance
        max_slope = max(max_slope, slope)
    
    slope_map[x, y] = max_slope
```

**Output** : `terrain.slope_map` rempli avec valeurs de pente [0, 1+]

---

#### Étape 3 : `MeshBuildingStage` (mesh_building.rs)

**Rôle** : Construire mesh 3D triangulé à partir de la heightmap

**Génération vertices** :
```
Pour chaque cellule (x, y):
    vertex.x = x * resolution
    vertex.y = heightmap[x, y]
    vertex.z = y * resolution
    vertex.color = color_from_height(heightmap[x, y])
```

**Colormap terrain** :
```
Hauteur → Couleur
  < 5m  → Bleu (eau)
  5-10m → Beige (plage)
 10-25m → Vert (forêt)
 25-35m → Marron (montagne)
  > 35m → Blanc (neige)
```

**Génération faces** : Deux triangles par cellule (grille régulière)

**Normales** : Calcul automatique des normales lisses (moyenne des normales des faces incidentes)

**Output** : `terrain.mesh` rempli avec vertices, colors, faces, normals

---

## 🌐 Bindings WASM

### API TypeScript-compatible (wasm_bindings.rs)

#### `WasmTerrainConfig`
```rust
#[wasm_bindgen]
pub struct WasmTerrainConfig {
    pub width: usize,       // Résolution grid (ex: 256)
    pub height: usize,      // Résolution grid (ex: 256)
    pub resolution: f32,    // Espacement points (ex: 1.0m)
    pub seed: u64,          // Seed aléatoire (ex: 42)
    pub frequency: f64,     // Fréquence Perlin (ex: 0.05)
    pub octaves: usize,     // Octaves fBm (ex: 6)
    pub persistence: f64,   // Persistence (ex: 0.5)
    pub lacunarity: f64,    // Lacunarity (ex: 2.0)
    pub height_scale: f32,  // Échelle verticale (ex: 50.0)
}
```

---

#### `TerrainHandle`
```rust
#[wasm_bindgen]
pub struct TerrainHandle {
    terrain: TerrainData,
}

#[wasm_bindgen]
impl TerrainHandle {
    #[wasm_bindgen(constructor)]
    pub fn new(config: WasmTerrainConfig) -> Result<TerrainHandle, JsValue>;
    
    #[wasm_bindgen]
    pub fn getMeshData(&self) -> JsValue; // { vertices, colors, faces, heightmap, slope_map, stats }
}
```

**Retour `getMeshData()`** :
```typescript
interface MeshData {
    vertices: Float32Array;  // Positions 3D [x,y,z, x,y,z, ...]
    colors: Float32Array;    // Couleurs RGB [r,g,b, r,g,b, ...]
    faces: Uint32Array;      // Indices triangles [i0,i1,i2, i0,i1,i2, ...]
    heightmap: Float32Array; // Hauteurs brutes [h0, h1, h2, ...]
    slope_map: Float32Array; // Pentes [s0, s1, s2, ...]
    stats: {
        num_vertices: number;
        num_faces: number;
        min_height: number;
        max_height: number;
        avg_height: number;
    };
}
```

---

## 💻 Exemple d'Usage

### Rust (bibliothèque)
```rust
use polylab_terrain::{TerrainData, TerrainConfig, Pipeline};
use polylab_terrain::stages::*;

// Configuration
let config = TerrainConfig {
    width: 128,
    height: 128,
    resolution: 1.0,
    seed: 12345,
};

// Créer le terrain
let mut terrain = TerrainData::new(config);

// Construire le pipeline
let mut pipeline = Pipeline::new();
pipeline.add_stage(Box::new(NoiseGenerationStage::default()));
pipeline.add_stage(Box::new(SlopeCalculationStage));
pipeline.add_stage(Box::new(MeshBuildingStage::default()));

// Exécuter
pipeline.execute(&mut terrain).unwrap();

// Accéder aux données
let heightmap = terrain.heightmap();
let slope_map = terrain.slope_map().unwrap();
let mesh = terrain.mesh().unwrap();
```

---

### TypeScript (WASM)
```typescript
import { WasmTerrainConfig, TerrainHandle } from './wasm/polylab_terrain';

// Configuration
const config = new WasmTerrainConfig();
config.width = 256;
config.height = 256;
config.seed = 42;
config.frequency = 0.05;
config.octaves = 6;

// Générer
const terrain = new TerrainHandle(config);

// Récupérer les données
const meshData = terrain.getMeshData();
console.log(`Vertices: ${meshData.stats.num_vertices}`);
console.log(`Faces: ${meshData.stats.num_faces}`);
```

---

## 🎬 Visualisation Multi-Vues (PerlinProject)

### Système de Layout (Option 3 : Mode Switcher)

**Modes disponibles** :
1. ✅ **3D View** : Mesh terrain avec WebGPU (rotation, zoom)
2. ✅ **Heightmap** : Carte des hauteurs avec colormap terrain
3. ✅ **Slope Map** : Carte des pentes en niveaux de gris
4. ⏳ **Flow Map** : Direction d'écoulement (Phase 2)
5. ⏳ **Material Map** : Répartition des matériaux (Phase 3)

**Interface** : Toolbar avec boutons pour switcher entre modes

```
┌───────────────────────────────────────────────────────────────────┐
│  [🎬 3D] [🗺️ Heightmap] [📐 Slope] [💧 Flow] [🎨 Material]      │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│                     VUE ACTIVE (plein écran)                       │
│                   - Stats overlay (top-left)                       │
│                   - Colormap legend (bottom)                       │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

### Nouveaux Fichiers UI

#### `code/app/web/src/utils/mapRenderer.ts` (~230 lignes)
**Rôle** : Utilitaires génériques de rendu 2D

**Fonctionnalités** :
- ✅ Colormaps prédéfinis : TERRAIN, GRAYSCALE, HEATMAP, VIRIDIS
- ✅ Interpolation couleurs : `getColorFromMap(value, colormap)`
- ✅ Rendu canvas 2D : `renderScalarMap(canvas, data, width, height, colormap)`
- ✅ Statistiques : `computeMapStats(data)` → min, max, mean, stdDev
- ✅ Overlays : `renderStatsOverlay()` affiche stats sur canvas
- ✅ Légendes : `renderColormapLegend()` affiche barre gradient

**Réutilisabilité** : ✅ 100% générique, utilisable par n'importe quel projet

---

#### `code/app/web/src/utils/terrainLayouts.ts` (~200 lignes)
**Rôle** : Layouts de vues pour visualisation terrain

**Types** :
```typescript
interface TerrainMapData {
    heightmap: Float32Array | null;
    slopeMap: Float32Array | null;
    flowMap: Float32Array | null;
    width: number;
    height: number;
}
```

**Fonctions de layout** :
- ✅ `setupHeightmapView(container, mapData)` : Rendu heightmap
- ✅ `setupSlopeMapView(container, mapData)` : Rendu slope map
- ✅ `setupFlowMapView(container, mapData)` : Placeholder Phase 2
- ✅ `setupMaterialMapView(container, mapData)` : Placeholder Phase 3

---

### Modifications PerlinProject.ts

**Propriétés ajoutées** :
```typescript
private layoutManager: LayoutManager | null = null;
private currentViewMode: string = 'scene';

private terrainMapData: TerrainMapData = {
    heightmap: null,
    slopeMap: null,
    flowMap: null,
    width: 0,
    height: 0
};
```

**Méthodes ajoutées** :
- `registerLayouts()` : Enregistre 4 layouts dans LayoutManager
- `switchViewMode(mode)` : Bascule entre modes avec validation

**Toolbar boutons** :
- [🎬 3D] [🗺️ Heightmap] [📐 Slope] [💧 Flow] [🎨 Material]

---

## 📅 Prochaines Étapes

### Phase 2 : Érosion et Hydrologie (2-3 semaines)

1. **Érosion Thermique**
   - [ ] Algorithme de stabilisation des pentes
   - [ ] Déplacement de sédiments selon pente

2. **Flow Direction** (Algorithme D8)
   - [ ] Calcul direction écoulement chaque cellule
   - [ ] Gestion sinks (dépressions locales)

3. **Flow Accumulation**
   - [ ] Calcul accumulation flux (nombre cellules drainées)
   - [ ] Visualisation rivières et bassins versants

4. **Érosion Hydraulique**
   - [ ] Simulation droplets (particules d'eau)
   - [ ] Érosion vallées et ravines
   - [ ] Dépôt de sédiments

---

### Phase 3 : Matériaux et Visualisation (1-2 semaines)

1. **Classification Matériaux**
   - [ ] Règles selon hauteur, pente, humidité
   - [ ] Splat maps multi-matériaux

2. **Visualisation Avancée**
   - [ ] Panel debug avec aperçus cartes
   - [ ] Export RGBA pour textures
   - [ ] Picture-in-Picture (miniatures overlay)

3. **Optimisations**
   - [ ] Génération en tâche de fond (WebWorker)
   - [ ] Streaming LODs
   - [ ] Cache GPU pour cartes 2D

---

## ✅ Critères de Succès Phase 1

- ✅ Crate `polylab-terrain` compilé sans erreurs
- ✅ Structure `TerrainData` utilisable dans tout PolyLab
- ✅ Pipeline minimal fonctionnel (bruit → pente → mesh)
- ✅ Bindings WASM testés et validés
- ✅ Mesh 3D affiché dans PerlinProject
- ✅ Multi-vues implémenté (3D + Heightmap + Slope)
- ✅ Colormaps et stats fonctionnels

---

**Dernière mise à jour** : Documentation consolidée depuis terrain_generation_phase1_complete.md, terrain_layout_proposals.md, terrain_layout_implementation.md
