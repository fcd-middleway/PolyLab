# Plan d'implémentation — Génération de terrain procédurale

## Métadonnées

- **Date de création** : 24 mai 2026
- **Projet** : PolyLab — Terrain Generation System
- **Objectif** : Système complet de génération de terrain procédural crédible
- **Base existante** : PerlinProject actuel (fBm multi-octaves)
- **Architecture cible** : Structure de données centrale + Pipeline d'étapes + Visualisation multi-cartes

---

## Vision globale

### Principes directeurs

1. **Progressif** : Partir de l'existant, améliorer par itérations
2. **Modulaire** : Pipeline d'étapes indépendantes et composables
3. **Déterministe** : Même seed = même terrain à chaque fois
4. **Visualisable** : Toutes les cartes intermédiaires doivent être affichables
5. **Performant** : Génération côté Rust/WASM, optimisée pour temps réel

### Architecture en trois piliers

```text
┌─────────────────────────────────────────────────────────────┐
│                    TERRAIN GENERATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. STRUCTURE DE DONNÉES CENTRALE                            │
│     ├── TerrainData (heightmap + cartes dérivées)           │
│     ├── Stockage optimisé (voxels, layers, metadata)        │
│     └── API uniforme pour accès/modification                 │
│                                                               │
│  2. PIPELINE D'ÉTAPES                                        │
│     ├── Étapes configurables (on/off, paramètres)           │
│     ├── Ordre d'exécution défini                            │
│     └── Chaque étape = transformation de TerrainData        │
│                                                               │
│  3. INTERFACE & VISUALISATION                                │
│     ├── Layout multi-vues OU superposition 3D               │
│     ├── Cartes dérivées affichables (slope, flow, etc.)     │
│     └── Contrôles du pipeline dans l'UI                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1 : Fondations (Structure de données + Pipeline minimal)

### Objectif
Créer la **structure de données centrale** et un **pipeline minimal** fonctionnel avec les étapes de base déjà existantes.

### 1.1 Structure de données TerrainData (Rust)

**Emplacement** : `code/crates/polylab-terrain/` (nouveau crate)

**Inspiration** : Structure similaire à AIF (`polylab-compression`) mais pour le terrain

**Structure proposée** :

```rust
// code/crates/polylab-terrain/src/lib.rs

/// Structure de données centrale pour le terrain
pub struct TerrainData {
    // Métadonnées
    pub metadata: TerrainMetadata,
    
    // Cartes principales
    pub heightmap: HeightMap,
    
    // Cartes dérivées (optionnelles selon pipeline)
    pub slope_map: Option<ScalarMap>,
    pub curvature_map: Option<ScalarMap>,
    pub flow_direction: Option<FlowDirectionMap>,
    pub flow_accumulation: Option<ScalarMap>,
    pub moisture_map: Option<ScalarMap>,
    pub temperature_map: Option<ScalarMap>,
    pub sediment_map: Option<ScalarMap>,
    pub hardness_map: Option<ScalarMap>,
    
    // Matériaux (weight maps)
    pub material_weights: Option<MaterialWeightMaps>,
    
    // Mesh généré (cache)
    pub mesh_cache: Option<TerrainMesh>,
}

/// Métadonnées du terrain
pub struct TerrainMetadata {
    pub seed: u64,
    pub width: u32,        // Nombre de cellules en X
    pub depth: u32,        // Nombre de cellules en Z
    pub cell_size: f32,    // Taille d'une cellule en mètres
    pub vertical_scale: f32, // Échelle verticale
    pub generation_time: std::time::Duration,
    pub pipeline_config: PipelineConfig,
}

/// Carte de hauteur (représentation principale)
pub struct HeightMap {
    pub width: u32,
    pub depth: u32,
    pub data: Vec<f32>, // Stockage row-major: data[z * width + x]
}

/// Carte scalaire générique
pub struct ScalarMap {
    pub width: u32,
    pub depth: u32,
    pub data: Vec<f32>,
    pub min_value: f32,
    pub max_value: f32,
}

/// Directions de flux (8 directions D8)
pub struct FlowDirectionMap {
    pub width: u32,
    pub depth: u32,
    pub data: Vec<FlowDirection>, // Enum : N, NE, E, SE, S, SW, W, NW, None
}

/// Poids des matériaux (splat maps)
pub struct MaterialWeightMaps {
    pub width: u32,
    pub depth: u32,
    pub materials: Vec<MaterialLayer>, // Vec de layers (rock, grass, sand, snow, etc.)
}

pub struct MaterialLayer {
    pub material_id: MaterialId,
    pub weights: Vec<f32>, // Poids normalisés [0..1]
}

pub enum MaterialId {
    Rock,
    Grass,
    Sand,
    Snow,
    Mud,
    Gravel,
    Soil,
    RiverBed,
}

/// Mesh terrain (cache pour le rendu)
pub struct TerrainMesh {
    pub vertices: Vec<Vertex>,
    pub indices: Vec<u32>,
    pub bounds: AABB,
}
```

**API principale** :

```rust
impl TerrainData {
    /// Créer un terrain vide
    pub fn new(width: u32, depth: u32, cell_size: f32) -> Self;
    
    /// Accès sécurisé à une cellule
    pub fn get_height(&self, x: u32, z: u32) -> Option<f32>;
    pub fn set_height(&mut self, x: u32, z: u32, height: f32);
    
    /// Calculer les dérivées
    pub fn compute_slope(&mut self);
    pub fn compute_curvature(&mut self);
    pub fn compute_normals(&self) -> Vec<[f32; 3]>;
    
    /// Générer le mesh
    pub fn generate_mesh(&mut self) -> &TerrainMesh;
    
    /// Export pour visualisation
    pub fn export_map_as_texture(&self, map_type: MapType) -> Vec<u8>;
}

pub enum MapType {
    Height,
    Slope,
    Curvature,
    FlowAccumulation,
    Moisture,
    Temperature,
    Sediment,
    MaterialDominant,
}
```

**Organisation du crate** :

```
polylab-terrain/
├── Cargo.toml
└── src/
    ├── lib.rs               (exports publics)
    ├── data/
    │   ├── terrain_data.rs  (TerrainData)
    │   ├── heightmap.rs     (HeightMap)
    │   ├── scalar_map.rs    (ScalarMap)
    │   ├── flow_map.rs      (FlowDirectionMap)
    │   └── material_map.rs  (MaterialWeightMaps)
    ├── pipeline/
    │   ├── mod.rs           (Pipeline trait)
    │   ├── config.rs        (PipelineConfig)
    │   └── stage.rs         (PipelineStage trait)
    ├── stages/
    │   ├── mod.rs
    │   ├── mesh_generation.rs
    │   ├── noise_generation.rs
    │   ├── erosion_thermal.rs
    │   ├── erosion_hydraulic.rs
    │   ├── hydrologie.rs
    │   └── material_classification.rs
    └── utils/
        ├── noise.rs         (Bruit Perlin/Simplex)
        ├── interpolation.rs
        └── math.rs
```

### 1.2 Pipeline d'étapes

**Design pattern** : Chain of Responsibility / Pipeline

```rust
// code/crates/polylab-terrain/src/pipeline/mod.rs

/// Configuration du pipeline
pub struct PipelineConfig {
    pub stages: Vec<StageConfig>,
}

pub struct StageConfig {
    pub stage_type: StageType,
    pub enabled: bool,
    pub parameters: StageParameters,
}

pub enum StageType {
    MeshGeneration,
    NoiseGeneration,
    ThermalErosion,
    HydraulicErosion,
    FlowCalculation,
    MaterialClassification,
}

/// Paramètres spécifiques à chaque étape (enum ou trait object)
pub enum StageParameters {
    NoiseParams(NoiseParameters),
    ThermalParams(ThermalErosionParameters),
    HydraulicParams(HydraulicErosionParameters),
    // ... etc
}

/// Trait pour une étape du pipeline
pub trait PipelineStage {
    fn name(&self) -> &str;
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError>;
}

/// Exécuteur du pipeline
pub struct TerrainPipeline {
    stages: Vec<Box<dyn PipelineStage>>,
}

impl TerrainPipeline {
    pub fn from_config(config: PipelineConfig) -> Self {
        let mut stages: Vec<Box<dyn PipelineStage>> = Vec::new();
        
        for stage_config in config.stages {
            if !stage_config.enabled {
                continue;
            }
            
            let stage: Box<dyn PipelineStage> = match stage_config.stage_type {
                StageType::MeshGeneration => Box::new(MeshGenerationStage::new()),
                StageType::NoiseGeneration => Box::new(NoiseGenerationStage::from_params(/* ... */)),
                StageType::ThermalErosion => Box::new(ThermalErosionStage::from_params(/* ... */)),
                // ... etc
            };
            
            stages.push(stage);
        }
        
        Self { stages }
    }
    
    pub fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        for stage in &self.stages {
            println!("Executing stage: {}", stage.name());
            stage.execute(terrain)?;
        }
        Ok(())
    }
}
```

### 1.3 Étapes du pipeline (Phase 1)

**Étapes à implémenter en priorité** :

1. **MeshGeneration** : Générer la grille planaire (width × depth)
2. **NoiseGeneration** : Appliquer fBm multi-octaves (reprendre le code existant de PerlinProject)
3. **SlopeCalculation** : Calculer la carte des pentes
4. **MeshBuilding** : Générer le mesh 3D final

**Exemple d'étape** :

```rust
// code/crates/polylab-terrain/src/stages/noise_generation.rs

pub struct NoiseGenerationStage {
    params: NoiseParameters,
}

pub struct NoiseParameters {
    pub seed: u64,
    pub octaves: u32,
    pub persistence: f32,
    pub lacunarity: f32,
    pub scale: f32,
    pub amplitude: f32,
}

impl PipelineStage for NoiseGenerationStage {
    fn name(&self) -> &str {
        "Noise Generation (fBm)"
    }
    
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let width = terrain.heightmap.width;
        let depth = terrain.heightmap.depth;
        let cell_size = terrain.metadata.cell_size;
        
        for z in 0..depth {
            for x in 0..width {
                let world_x = x as f32 * cell_size;
                let world_z = z as f32 * cell_size;
                
                // Calcul fBm (reprendre la logique actuelle)
                let height = self.compute_fbm(world_x, world_z);
                
                terrain.set_height(x, z, height);
            }
        }
        
        Ok(())
    }
}

impl NoiseGenerationStage {
    fn compute_fbm(&self, x: f32, z: f32) -> f32 {
        let mut total = 0.0;
        let mut frequency = 1.0 / self.params.scale;
        let mut amplitude = self.params.amplitude;
        
        for _ in 0..self.params.octaves {
            total += amplitude * noise::perlin_2d(
                x * frequency, 
                z * frequency, 
                self.params.seed
            );
            
            frequency *= self.params.lacunarity;
            amplitude *= self.params.persistence;
        }
        
        total
    }
}
```

### 1.4 Intégration WASM

**Binding WASM** (`polylab-viewer` ou nouveau `polylab-terrain-wasm`) :

```rust
// code/crates/polylab-viewer/src/lib.rs

#[wasm_bindgen]
pub struct TerrainGenerator {
    terrain: TerrainData,
    pipeline: TerrainPipeline,
}

#[wasm_bindgen]
impl TerrainGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, depth: u32, cell_size: f32) -> Self {
        let terrain = TerrainData::new(width, depth, cell_size);
        let pipeline = TerrainPipeline::default(); // Configuration par défaut
        Self { terrain, pipeline }
    }
    
    /// Générer le terrain avec le pipeline configuré
    #[wasm_bindgen]
    pub fn generate(&mut self, seed: u64) -> Result<(), JsValue> {
        self.terrain.metadata.seed = seed;
        self.pipeline.execute(&mut self.terrain)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    /// Récupérer le mesh pour le rendu
    #[wasm_bindgen]
    pub fn get_mesh_data(&self) -> Vec<f32> {
        // Export vertices + normals + UVs
        todo!()
    }
    
    /// Export d'une carte pour debug
    #[wasm_bindgen]
    pub fn export_map(&self, map_type: String) -> Vec<u8> {
        // Retourner une texture 2D
        todo!()
    }
}
```

### 1.5 Modifications côté TypeScript

**Mise à jour de PerlinProject** :

```typescript
// code/app/web/src/projects/PerlinProject.ts

export class PerlinProject extends BaseProject {
    private terrainGenerator: any; // TerrainGenerator from WASM
    
    async init(viewer: any): Promise<void> {
        // Créer le générateur
        this.terrainGenerator = new viewer.TerrainGenerator(
            this.params.widthSegments,
            this.params.depthSegments,
            this.params.width / this.params.widthSegments
        );
        
        // ... reste du code
    }
    
    private generateTerrain(): void {
        // Appeler le pipeline WASM
        this.terrainGenerator.generate(this.params.seed);
        
        // Récupérer le mesh
        const meshData = this.terrainGenerator.get_mesh_data();
        
        // Afficher dans le viewer (à adapter selon l'API)
        // ...
    }
}
```

### Livrables Phase 1

✅ **Code** :
- [ ] Nouveau crate `polylab-terrain` avec structure `TerrainData`
- [ ] Pipeline minimal (4 étapes : mesh, noise, slope, mesh building)
- [ ] Bindings WASM
- [ ] Migration de `PerlinProject` pour utiliser le nouveau système

✅ **Documentation** :
- [ ] README du crate `polylab-terrain`
- [ ] Documentation inline (rustdoc)

✅ **Tests** :
- [ ] Tests unitaires des structures de données
- [ ] Test de génération déterministe (même seed = même résultat)

---

## Phase 2 : Érosion et hydrologie

### Objectif
Ajouter les **étapes d'érosion** (thermique + hydraulique) et les **calculs hydrologiques** (flow direction, accumulation, rivières).

### 2.1 Nouvelles étapes du pipeline

**Étapes à ajouter** :

1. **ThermalErosion** : Érosion thermique (stabilisation des pentes)
2. **FlowCalculation** : Direction d'écoulement (D8) + accumulation
3. **HydraulicErosion** : Érosion hydraulique par particules
4. **RiverCarving** : Creuser les lits de rivières

### 2.2 Érosion thermique

```rust
// code/crates/polylab-terrain/src/stages/erosion_thermal.rs

pub struct ThermalErosionStage {
    params: ThermalErosionParameters,
}

pub struct ThermalErosionParameters {
    pub iterations: u32,
    pub talus_angle: f32,      // Angle de repos en radians
    pub erosion_strength: f32, // [0..1]
}

impl PipelineStage for ThermalErosionStage {
    fn name(&self) -> &str {
        "Thermal Erosion"
    }
    
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        for _ in 0..self.params.iterations {
            self.erode_iteration(terrain);
        }
        Ok(())
    }
}

impl ThermalErosionStage {
    fn erode_iteration(&self, terrain: &mut TerrainData) {
        let width = terrain.heightmap.width;
        let depth = terrain.heightmap.depth;
        let mut delta = vec![0.0; (width * depth) as usize];
        
        for z in 0..depth {
            for x in 0..width {
                let height = terrain.get_height(x, z).unwrap();
                let max_diff = self.params.talus_angle.tan();
                
                // Comparer avec les 8 voisins
                for (dx, dz) in Self::neighbors() {
                    let nx = x as i32 + dx;
                    let nz = z as i32 + dz;
                    
                    if let Some(neighbor_height) = terrain.get_height(nx as u32, nz as u32) {
                        let diff = height - neighbor_height;
                        
                        if diff > max_diff {
                            let excess = (diff - max_diff) * self.params.erosion_strength;
                            delta[(z * width + x) as usize] -= excess / 2.0;
                            delta[(nz as u32 * width + nx as u32) as usize] += excess / 2.0;
                        }
                    }
                }
            }
        }
        
        // Appliquer les deltas
        for z in 0..depth {
            for x in 0..width {
                let idx = (z * width + x) as usize;
                let current = terrain.get_height(x, z).unwrap();
                terrain.set_height(x, z, current + delta[idx]);
            }
        }
    }
    
    fn neighbors() -> [(i32, i32); 8] {
        [(-1, -1), (0, -1), (1, -1),
         (-1,  0),          (1,  0),
         (-1,  1), (0,  1), (1,  1)]
    }
}
```

### 2.3 Hydrologie

**Flow direction (D8)** :

```rust
// code/crates/polylab-terrain/src/stages/hydrologie.rs

pub struct FlowCalculationStage;

impl PipelineStage for FlowCalculationStage {
    fn name(&self) -> &str {
        "Flow Calculation (D8)"
    }
    
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        // 1. Calculer flow direction
        let flow_dir = self.compute_flow_direction(&terrain.heightmap);
        terrain.flow_direction = Some(flow_dir);
        
        // 2. Calculer flow accumulation
        let flow_acc = self.compute_flow_accumulation(&terrain);
        terrain.flow_accumulation = Some(flow_acc);
        
        Ok(())
    }
}

impl FlowCalculationStage {
    fn compute_flow_direction(&self, heightmap: &HeightMap) -> FlowDirectionMap {
        let width = heightmap.width;
        let depth = heightmap.depth;
        let mut data = vec![FlowDirection::None; (width * depth) as usize];
        
        for z in 0..depth {
            for x in 0..width {
                let height = heightmap.get(x, z);
                let mut lowest_neighbor = None;
                let mut lowest_height = height;
                
                // Trouver le voisin le plus bas
                for (direction, (dx, dz)) in Self::neighbors_d8() {
                    let nx = x as i32 + dx;
                    let nz = z as i32 + dz;
                    
                    if let Some(neighbor_height) = heightmap.get_safe(nx, nz) {
                        if neighbor_height < lowest_height {
                            lowest_height = neighbor_height;
                            lowest_neighbor = Some(direction);
                        }
                    }
                }
                
                data[(z * width + x) as usize] = lowest_neighbor.unwrap_or(FlowDirection::None);
            }
        }
        
        FlowDirectionMap { width, depth, data }
    }
    
    fn compute_flow_accumulation(&self, terrain: &TerrainData) -> ScalarMap {
        // Algorithme : parcourir les cellules par hauteur décroissante
        // et accumuler les contributions
        todo!()
    }
}

pub enum FlowDirection {
    N, NE, E, SE, S, SW, W, NW, None
}
```

### 2.4 Érosion hydraulique par particules

```rust
// code/crates/polylab-terrain/src/stages/erosion_hydraulic.rs

pub struct HydraulicErosionStage {
    params: HydraulicErosionParameters,
}

pub struct HydraulicErosionParameters {
    pub droplet_count: u32,
    pub max_lifetime: u32,
    pub inertia: f32,
    pub capacity: f32,
    pub min_slope: f32,
    pub erode_rate: f32,
    pub deposit_rate: f32,
    pub evaporate_rate: f32,
    pub gravity: f32,
}

struct Droplet {
    pos_x: f32,
    pos_z: f32,
    dir_x: f32,
    dir_z: f32,
    velocity: f32,
    water: f32,
    sediment: f32,
}

impl PipelineStage for HydraulicErosionStage {
    fn name(&self) -> &str {
        "Hydraulic Erosion (Droplets)"
    }
    
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let mut rng = StdRng::seed_from_u64(terrain.metadata.seed);
        
        for _ in 0..self.params.droplet_count {
            let droplet = self.create_random_droplet(&mut rng, terrain);
            self.simulate_droplet(droplet, terrain);
        }
        
        Ok(())
    }
}

impl HydraulicErosionStage {
    fn simulate_droplet(&self, mut droplet: Droplet, terrain: &mut TerrainData) {
        for _ in 0..self.params.max_lifetime {
            // 1. Interpoler la hauteur et le gradient à la position courante
            let (height, gradient_x, gradient_z) = terrain.heightmap.interpolate_gradient(
                droplet.pos_x, 
                droplet.pos_z
            );
            
            // 2. Calculer la direction de déplacement
            droplet.dir_x = droplet.dir_x * self.params.inertia - gradient_x * (1.0 - self.params.inertia);
            droplet.dir_z = droplet.dir_z * self.params.inertia - gradient_z * (1.0 - self.params.inertia);
            
            // Normaliser
            let len = (droplet.dir_x * droplet.dir_x + droplet.dir_z * droplet.dir_z).sqrt();
            if len > 0.0 {
                droplet.dir_x /= len;
                droplet.dir_z /= len;
            }
            
            // 3. Déplacer la particule
            droplet.pos_x += droplet.dir_x;
            droplet.pos_z += droplet.dir_z;
            
            // Vérifier les limites
            if !terrain.heightmap.is_valid(droplet.pos_x, droplet.pos_z) {
                break;
            }
            
            // 4. Calculer la nouvelle hauteur
            let new_height = terrain.heightmap.interpolate(droplet.pos_x, droplet.pos_z);
            let delta_height = new_height - height;
            
            // 5. Calculer la capacité de transport
            let capacity = (droplet.velocity * droplet.water * self.params.capacity).max(self.params.min_slope);
            
            // 6. Éroder ou déposer
            if droplet.sediment > capacity || delta_height > 0.0 {
                // Déposer
                let amount_to_deposit = if delta_height > 0.0 {
                    (delta_height).min(droplet.sediment)
                } else {
                    (droplet.sediment - capacity) * self.params.deposit_rate
                };
                
                droplet.sediment -= amount_to_deposit;
                terrain.heightmap.deposit(droplet.pos_x, droplet.pos_z, amount_to_deposit);
            } else {
                // Éroder
                let amount_to_erode = (capacity - droplet.sediment).min(-delta_height) * self.params.erode_rate;
                terrain.heightmap.erode(droplet.pos_x, droplet.pos_z, amount_to_erode);
                droplet.sediment += amount_to_erode;
            }
            
            // 7. Mettre à jour la vitesse et l'eau
            droplet.velocity = (droplet.velocity * droplet.velocity + delta_height * self.params.gravity).sqrt().max(0.0);
            droplet.water *= 1.0 - self.params.evaporate_rate;
        }
    }
}
```

### Livrables Phase 2

✅ **Code** :
- [ ] Étape `ThermalErosion`
- [ ] Étape `FlowCalculation` (direction + accumulation)
- [ ] Étape `HydraulicErosion` (particules)
- [ ] Carte `sediment_map` dans `TerrainData`

✅ **Tests** :
- [ ] Test érosion thermique (pentes s'adoucissent)
- [ ] Test flow accumulation (rivières détectées)
- [ ] Test érosion hydraulique (vallées creusées)

---

## Phase 3 : Matériaux et visualisation

### Objectif
Générer les **weight maps** des matériaux et implémenter la **visualisation multi-cartes** dans l'interface.

### 3.1 Classification des matériaux

**Étape du pipeline** :

```rust
// code/crates/polylab-terrain/src/stages/material_classification.rs

pub struct MaterialClassificationStage {
    params: MaterialClassificationParameters,
}

pub struct MaterialClassificationParameters {
    pub snow_line: f32,
    pub cliff_slope: f32,
    pub beach_height: f32,
    pub river_threshold: f32, // Flow accumulation
}

impl PipelineStage for MaterialClassificationStage {
    fn name(&self) -> &str {
        "Material Classification"
    }
    
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        let width = terrain.heightmap.width;
        let depth = terrain.heightmap.depth;
        
        let mut material_weights = MaterialWeightMaps::new(width, depth);
        
        for z in 0..depth {
            for x in 0..width {
                let height = terrain.get_height(x, z).unwrap();
                let slope = terrain.slope_map.as_ref().unwrap().get(x, z);
                let flow = terrain.flow_accumulation.as_ref()
                    .map(|m| m.get(x, z))
                    .unwrap_or(0.0);
                
                // Calculer les poids
                let mut weights = [0.0; 8]; // 8 matériaux
                
                // Rock : pentes fortes
                weights[MaterialId::Rock as usize] = smoothstep(0.55, 0.85, slope);
                
                // Snow : altitude élevée + pente faible
                let snow_factor = smoothstep(self.params.snow_line - 50.0, self.params.snow_line + 100.0, height);
                let snow_slope = 1.0 - smoothstep(0.3, 0.6, slope);
                weights[MaterialId::Snow as usize] = snow_factor * snow_slope;
                
                // Sand : proche de l'eau ou sédiment
                // TODO : nécessite moisture_map
                
                // Grass : défaut pour zones plates et moyennes altitudes
                let grass_slope = smoothstep(0.7, 0.3, slope);
                let grass_height = 1.0 - smoothstep(self.params.snow_line - 200.0, self.params.snow_line, height);
                weights[MaterialId::Grass as usize] = grass_slope * grass_height;
                
                // RiverBed : forte accumulation
                if flow > self.params.river_threshold {
                    weights[MaterialId::RiverBed as usize] = smoothstep(
                        self.params.river_threshold, 
                        self.params.river_threshold * 2.0, 
                        flow
                    );
                }
                
                // Normaliser les poids
                let total: f32 = weights.iter().sum();
                if total > 0.0 {
                    for w in &mut weights {
                        *w /= total;
                    }
                }
                
                material_weights.set_weights(x, z, &weights);
            }
        }
        
        terrain.material_weights = Some(material_weights);
        Ok(())
    }
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
```

### 3.2 Interface de visualisation

**Options de layout** :

#### Option A : Superposition 3D (layers verticaux)

```
┌─────────────────────────────────┐
│     Scene Viewer (3D)           │
│                                 │
│  Altitude +500m: Moisture Map   │ ← Couche flottante
│  Altitude +300m: Slope Map      │ ← Couche flottante
│  Altitude +100m: Flow Map       │ ← Couche flottante
│  Altitude 0:     Terrain        │ ← Mesh principal
│                                 │
└─────────────────────────────────┘

Contrôles:
[x] Show Moisture Map
[x] Show Slope Map
[ ] Show Flow Map
```

**Implémentation** : Générer des meshes planaires additionnels avec textures projetées.

#### Option B : Layout multi-vues (grid)

```
┌──────────────────┬──────────────┬──────────────┐
│                  │  Slope Map   │  Flow Map    │
│   Scene Viewer   │              │              │
│   (3D terrain)   │  [2D view]   │  [2D view]   │
│                  │              │              │
├──────────────────┼──────────────┼──────────────┤
│  Material Weights│  Moisture    │  Temperature │
│  [2D view]       │  [2D view]   │  [2D view]   │
└──────────────────┴──────────────┴──────────────┘

Contrôles:
- Clic sur une vue → enlarge
- Dropdown pour choisir quelle carte afficher
```

**Implémentation** : Utiliser `LayoutManager` existant + Canvas 2D séparés.

#### Option C : Layout hybride (recommandé)

```
┌────────────────────────────────────────┐
│           Scene Viewer (3D)            │
│                                        │
│           [Terrain principal]          │
│                                        │
│  Toggle maps:                          │
│  [Height] [Slope] [Flow] [Materials]  │
└────────────────────────────────────────┘
┌──────────┬──────────┬──────────┬──────────┐
│ Slope    │ Flow Acc │ Moisture │ Sediment │
│ [preview]│ [preview]│ [preview]│ [preview]│
└──────────┴──────────┴──────────┴──────────┘
```

**Fonctionnalités** :
- Vue 3D principale
- Barre de toggles pour superposer les cartes (comme overlays colorés avec transparence)
- Miniatures 2D en bas pour aperçu rapide

### 3.3 Modifications TypeScript

**Nouveau component** : `TerrainDebugPanel`

```typescript
// code/app/web/src/components/TerrainDebugPanel.ts

export class TerrainDebugPanel implements UIComponent {
    element: HTMLElement;
    private terrainGenerator: any; // WASM
    private canvases: Map<MapType, HTMLCanvasElement>;
    
    constructor() {
        this.element = this.createElement();
        this.canvases = new Map();
        this.setupCanvases();
    }
    
    private createElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'terrain-debug-panel';
        
        panel.innerHTML = `
            <div class="panel-header">
                <h3>🗺️ Terrain Maps</h3>
            </div>
            <div class="panel-content">
                <div class="map-grid">
                    <div class="map-item">
                        <label>Height</label>
                        <canvas id="map-height"></canvas>
                    </div>
                    <div class="map-item">
                        <label>Slope</label>
                        <canvas id="map-slope"></canvas>
                    </div>
                    <div class="map-item">
                        <label>Flow Accumulation</label>
                        <canvas id="map-flow"></canvas>
                    </div>
                    <div class="map-item">
                        <label>Moisture</label>
                        <canvas id="map-moisture"></canvas>
                    </div>
                    <div class="map-item">
                        <label>Materials</label>
                        <canvas id="map-materials"></canvas>
                    </div>
                    <div class="map-item">
                        <label>Sediment</label>
                        <canvas id="map-sediment"></canvas>
                    </div>
                </div>
            </div>
        `;
        
        return panel;
    }
    
    public setTerrainGenerator(generator: any): void {
        this.terrainGenerator = generator;
        this.updateAllMaps();
    }
    
    private updateAllMaps(): void {
        const mapTypes = ['height', 'slope', 'flow', 'moisture', 'materials', 'sediment'];
        
        for (const mapType of mapTypes) {
            const imageData = this.terrainGenerator.export_map(mapType);
            this.renderMap(mapType, imageData);
        }
    }
    
    private renderMap(mapType: string, imageData: Uint8Array): void {
        const canvas = this.element.querySelector(`#map-${mapType}`) as HTMLCanvasElement;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Assuming imageData is RGBA format
        const width = Math.sqrt(imageData.length / 4);
        const height = width;
        
        canvas.width = width;
        canvas.height = height;
        
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(imageData);
        ctx.putImageData(imgData, 0, 0);
    }
}
```

**Intégration dans PerlinProject** :

```typescript
// code/app/web/src/projects/PerlinProject.ts

export class PerlinProject extends BaseProject {
    private debugPanel: TerrainDebugPanel | null = null;
    
    getConfig(): ProjectConfig {
        return {
            // ... config existante ...
            
            panels: [
                // ... panels existants ...
                {
                    id: 'terrain-debug',
                    title: 'Terrain Maps',
                    position: 'bottom', // Nouveau position
                    component: null
                }
            ]
        };
    }
    
    async init(viewer: any): Promise<void> {
        // ... init existant ...
        
        // Créer le debug panel
        this.debugPanel = new TerrainDebugPanel();
        this.debugPanel.setTerrainGenerator(this.terrainGenerator);
    }
    
    private generateTerrain(): void {
        // Générer
        this.terrainGenerator.generate(this.params.seed);
        
        // Mettre à jour le debug panel
        if (this.debugPanel) {
            this.debugPanel.setTerrainGenerator(this.terrainGenerator);
        }
    }
}
```

### Livrables Phase 3

✅ **Code** :
- [ ] Étape `MaterialClassification`
- [ ] Export des cartes en tant que textures (RGBA)
- [ ] Component `TerrainDebugPanel` (TypeScript)
- [ ] Layout pour afficher les miniatures

✅ **UI** :
- [ ] Miniatures 2D des cartes
- [ ] Toggles pour superposer les cartes en 3D (optionnel)

---

## Phase 4 : Améliorations du relief

### Objectif
Ajouter les techniques avancées de génération de relief : **ridged noise**, **domain warping**, **terracing**, **cartes macro**.

### 4.1 Nouvelles étapes

1. **MacroMapGeneration** : Générer des masques de régions (montagnes, plaines, bassins)
2. **RidgedNoiseGeneration** : Ajouter des crêtes montagneuses
3. **DomainWarping** : Déformer le terrain pour casser la régularité
4. **Terracing** : Créer des plateaux

### 4.2 Ridged Noise

```rust
// code/crates/polylab-terrain/src/stages/ridged_noise.rs

pub struct RidgedNoiseStage {
    params: RidgedNoiseParameters,
}

pub struct RidgedNoiseParameters {
    pub seed: u64,
    pub octaves: u32,
    pub scale: f32,
    pub amplitude: f32,
    pub mountain_mask: Option<ScalarMap>, // Où appliquer les crêtes
}

impl PipelineStage for RidgedNoiseStage {
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        for z in 0..terrain.heightmap.depth {
            for x in 0..terrain.heightmap.width {
                let world_x = x as f32 * terrain.metadata.cell_size;
                let world_z = z as f32 * terrain.metadata.cell_size;
                
                let ridge = self.compute_ridged(world_x, world_z);
                
                // Appliquer le masque si fourni
                let mask = self.params.mountain_mask
                    .as_ref()
                    .map(|m| m.get(x, z))
                    .unwrap_or(1.0);
                
                let current = terrain.get_height(x, z).unwrap();
                terrain.set_height(x, z, current + ridge * mask);
            }
        }
        Ok(())
    }
}

impl RidgedNoiseStage {
    fn compute_ridged(&self, x: f32, z: f32) -> f32 {
        let mut total = 0.0;
        let mut frequency = 1.0 / self.params.scale;
        let mut amplitude = self.params.amplitude;
        
        for _ in 0..self.params.octaves {
            let noise = noise::perlin_2d(x * frequency, z * frequency, self.params.seed);
            let ridge = 1.0 - noise.abs(); // Transformation en crête
            let ridge = ridge * ridge;     // Accentuer
            
            total += amplitude * ridge;
            
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        
        total
    }
}
```

### 4.3 Domain Warping

```rust
// code/crates/polylab-terrain/src/stages/domain_warping.rs

pub struct DomainWarpingStage {
    params: DomainWarpingParameters,
}

pub struct DomainWarpingParameters {
    pub seed: u64,
    pub warp_frequency: f32,
    pub warp_strength: f32,
}

impl PipelineStage for DomainWarpingStage {
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        // Créer une copie de la heightmap
        let original = terrain.heightmap.clone();
        
        for z in 0..terrain.heightmap.depth {
            for x in 0..terrain.heightmap.width {
                let world_x = x as f32 * terrain.metadata.cell_size;
                let world_z = z as f32 * terrain.metadata.cell_size;
                
                // Calculer le décalage
                let warp_x = noise::perlin_2d(
                    world_x * self.params.warp_frequency, 
                    world_z * self.params.warp_frequency,
                    self.params.seed
                ) * self.params.warp_strength;
                
                let warp_z = noise::perlin_2d(
                    world_x * self.params.warp_frequency + 1000.0, 
                    world_z * self.params.warp_frequency + 1000.0,
                    self.params.seed
                ) * self.params.warp_strength;
                
                // Échantillonner la heightmap originale aux coordonnées déformées
                let warped_x = world_x + warp_x;
                let warped_z = world_z + warp_z;
                
                let warped_height = original.interpolate(warped_x, warped_z);
                terrain.set_height(x, z, warped_height);
            }
        }
        
        Ok(())
    }
}
```

### 4.4 Cartes macro

```rust
// code/crates/polylab-terrain/src/stages/macro_maps.rs

pub struct MacroMapGenerationStage {
    params: MacroMapParameters,
}

pub struct MacroMapParameters {
    pub seed: u64,
    pub continent_frequency: f32,
    pub mountain_frequency: f32,
}

impl PipelineStage for MacroMapGenerationStage {
    fn execute(&self, terrain: &mut TerrainData) -> Result<(), TerrainError> {
        // Générer des cartes macro pour contrôler le relief à grande échelle
        
        // 1. Carte des continents (basse fréquence)
        let continent_map = self.generate_continent_map(terrain);
        
        // 2. Carte des montagnes (zones où appliquer ridged noise)
        let mountain_map = self.generate_mountain_map(terrain);
        
        // 3. Carte des plaines
        let plain_map = self.generate_plain_map(&continent_map, &mountain_map);
        
        // Stocker dans metadata ou autre structure
        // Ces cartes seront utilisées par les étapes suivantes
        
        Ok(())
    }
}
```

### Livrables Phase 4

✅ **Code** :
- [ ] Étape `RidgedNoise`
- [ ] Étape `DomainWarping`
- [ ] Étape `MacroMapGeneration`
- [ ] Étape `Terracing` (optionnel)

✅ **Tests** :
- [ ] Terrain avec crêtes montagneuses
- [ ] Terrain sans artefacts de grille (grâce au warping)

---

## Phase 5 : Optimisation et features avancées

### Objectif
Optimiser les performances, ajouter le **chunking**, le **LOD**, et les **biomes**.

### 5.1 Chunking

**Découper le terrain en chunks** :

```rust
pub struct ChunkedTerrain {
    pub chunks: HashMap<(i32, i32), TerrainChunk>,
    pub chunk_size: u32,
}

pub struct TerrainChunk {
    pub chunk_x: i32,
    pub chunk_z: i32,
    pub terrain_data: TerrainData,
    pub mesh: Option<TerrainMesh>,
    pub dirty: bool,
}
```

**Avantages** :
- Génération progressive
- Streaming
- Rechargement partiel
- Meilleures performances

### 5.2 LOD (Level of Detail)

**Options** :
1. LOD simple : Grille réduite selon distance caméra
2. Quadtree
3. CDLOD (Continuous Distance-Dependent LOD)
4. Geometry clipmaps

**Recommandation Phase 5** : LOD simple (grille réduite)

### 5.3 Biomes

**Cartes de température et humidité** :

```rust
pub struct BiomeSystem {
    temperature_map: ScalarMap,
    moisture_map: ScalarMap,
}

impl BiomeSystem {
    pub fn classify_biome(&self, x: u32, z: u32) -> BiomeWeights {
        let temp = self.temperature_map.get(x, z);
        let moisture = self.moisture_map.get(x, z);
        
        // Classification basée sur temp/moisture
        // Retourner des poids de biomes
        todo!()
    }
}

pub struct BiomeWeights {
    pub forest: f32,
    pub desert: f32,
    pub alpine: f32,
    pub snow: f32,
    pub grassland: f32,
    pub swamp: f32,
}
```

### Livrables Phase 5

✅ **Code** :
- [ ] Système de chunking
- [ ] LOD simple
- [ ] Cartes de température et humidité
- [ ] Classification des biomes

✅ **Performance** :
- [ ] Benchmark de génération
- [ ] Optimisations identifiées

---

## Roadmap temporelle (estimation)

| Phase | Durée estimée | Livrables clés |
|-------|---------------|----------------|
| **Phase 1** | 2-3 semaines | Structure `TerrainData` + Pipeline minimal |
| **Phase 2** | 2-3 semaines | Érosion thermique + hydraulique + hydrologie |
| **Phase 3** | 1-2 semaines | Matériaux + Visualisation multi-cartes |
| **Phase 4** | 1-2 semaines | Ridged noise + Domain warping + Cartes macro |
| **Phase 5** | 2-4 semaines | Chunking + LOD + Biomes |

**Total** : ~8-14 semaines pour un système complet

---

## Architecture finale envisagée

```
polylab-terrain/
├── src/
│   ├── data/                    (structures de données)
│   ├── pipeline/                (système de pipeline)
│   ├── stages/                  (étapes du pipeline)
│   │   ├── mesh_generation.rs
│   │   ├── noise_generation.rs
│   │   ├── ridged_noise.rs
│   │   ├── domain_warping.rs
│   │   ├── macro_maps.rs
│   │   ├── erosion_thermal.rs
│   │   ├── erosion_hydraulic.rs
│   │   ├── hydrologie.rs
│   │   ├── material_classification.rs
│   │   └── biomes.rs
│   └── utils/                   (utilitaires)

polylab-viewer/                  (bindings WASM)
└── src/
    └── terrain_bindings.rs

code/app/web/
└── src/
    ├── projects/
    │   └── PerlinProject.ts     (utilise le système)
    └── components/
        └── TerrainDebugPanel.ts (visualisation)
```

---

## Critères de succès

### Technique
✅ **Déterminisme** : Même seed → même terrain  
✅ **Performance** : Génération < 1s pour 512×512  
✅ **Extensibilité** : Facile d'ajouter de nouvelles étapes  
✅ **Visualisation** : Toutes les cartes affichables  

### Visuel
✅ **Crédibilité** : Terrain visuellement convaincant  
✅ **Variété** : Différents types de reliefs possibles  
✅ **Détails** : Relief multi-échelle (macro → micro)  

### Utilisabilité
✅ **Contrôles** : Paramètres intuitifs et réactifs  
✅ **Debug** : Inspection facile des cartes intermédiaires  
✅ **Export** : Heightmap + splat maps exportables  

---

## Prochaines étapes immédiates

1. **Valider cette proposition de plan** avec toi
2. **Démarrer Phase 1** :
   - Créer le crate `polylab-terrain`
   - Définir `TerrainData` et les structures de base
   - Implémenter le pipeline minimal (4 étapes)
   - Migrer le code existant de `PerlinProject`

Qu'en penses-tu ? On commence par Phase 1 ou tu veux ajuster certains points ? 🎯
