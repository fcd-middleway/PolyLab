# Implémentation du Layout Multi-Vues pour le Terrain

**Date** : 24 mai 2026  
**Type** : Feature - Option 3 (Mode Switcher)  
**Statut** : ✅ **Implémenté et compilé avec succès**

---

## 📋 Vue d'ensemble

Implémentation de l'**Option 3** (Mode Switcher) pour la visualisation multi-vues du terrain dans PerlinProject. Le système permet de basculer entre :
- 🎬 **Vue 3D** : Mesh terrain avec WebGPU
- 🗺️ **Heightmap** : Carte des hauteurs avec colormap terrain
- 📐 **Slope Map** : Carte des pentes en niveaux de gris
- 💧 **Flow Map** : Carte de flux (placeholder Phase 2)
- 🎨 **Material Map** : Carte des matériaux (placeholder Phase 3)

---

## 🎯 Objectifs de conception

### Généricité et Réutilisabilité
✅ **Système de layout générique** :
- `mapRenderer.ts` : Utilitaires de rendu 2D réutilisables (colormaps, stats, légendes)
- `terrainLayouts.ts` : Layouts de vues génériques (heightmap, slope, flow, material)
- `LayoutManager` : Orchestration de layouts existante, réutilisée de RoverProject

### Spécificité PerlinProject
✅ **Configuration et données spécifiques** :
- `TerrainMapData` : Container de données terrain (heightmap, slopeMap, flowMap, dimensions)
- Enregistrement des layouts dans `registerLayouts()`
- Boutons de toolbar pour switcher entre les vues
- Stockage des données après génération de terrain

---

## 📦 Nouveaux fichiers créés

### 1. `code/app/web/src/utils/mapRenderer.ts` (~230 lignes)
**Rôle** : Utilitaires génériques de rendu 2D de cartes scalaires

**Fonctionnalités** :
- ✅ **Colormaps prédéfinis** : TERRAIN, GRAYSCALE, HEATMAP, VIRIDIS
- ✅ **Interpolation de couleurs** : `getColorFromMap(value, colormap)`
- ✅ **Rendu canvas 2D** : `renderScalarMap(canvas, data, width, height, colormap)`
- ✅ **Statistiques** : `computeMapStats(data)` → min, max, mean, stdDev
- ✅ **Overlays** : `renderStatsOverlay()` affiche les stats sur le canvas
- ✅ **Légendes** : `renderColormapLegend()` affiche la barre de gradient
- ✅ **Helpers** : `createMapCanvas()` pour créer des canvas stylisés

**Réutilisabilité** : ✅ 100% générique, peut être utilisé par n'importe quel projet

**Exemple d'usage** :
```typescript
import { renderScalarMap, COLORMAPS, computeMapStats } from '../utils/mapRenderer';

const canvas = document.getElementById('my-canvas') as HTMLCanvasElement;
const data: Float32Array = ...; // données scalaires
const stats = computeMapStats(data);

renderScalarMap(canvas, data, width, height, {
    ...COLORMAPS.TERRAIN,
    min: stats.min,
    max: stats.max
});
```

---

### 2. `code/app/web/src/utils/terrainLayouts.ts` (~200 lignes)
**Rôle** : Layouts de vues pour la visualisation de terrain

**Types** :
- `TerrainMapData` : Container de données terrain (heightmap, slopeMap, flowMap, dimensions)

**Fonctions de layout** :
- ✅ `setupHeightmapView(container, mapData)` : Rendu heightmap avec colormap terrain
- ✅ `setupSlopeMapView(container, mapData)` : Rendu slope map en niveaux de gris
- ✅ `setupFlowMapView(container, mapData)` : Placeholder "Phase 2: Hydrology"
- ✅ `setupMaterialMapView(container, mapData)` : Placeholder "Phase 3: Materials"

**Réutilisabilité** : 
- ⚠️ Layouts génériques mais structurés pour les données terrain
- ✅ Peut être adapté pour d'autres projets avec des cartes 2D (CompressionProject, heatmaps, etc.)

**Structure de vue** :
```
┌─────────────────────────────────────┐
│  Title Bar (gradient background)   │
├─────────────────────────────────────┤
│                                     │
│     Canvas (centered, responsive)   │
│     - Stats overlay (top-left)      │
│     - Colormap legend (bottom)      │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔧 Modifications de fichiers existants

### 3. `code/app/web/src/projects/PerlinProject.ts`

#### Imports ajoutés
```typescript
import { LayoutManager } from '../core/LayoutManager';
import {
    setupHeightmapView,
    setupSlopeMapView,
    setupFlowMapView,
    setupMaterialMapView,
    type TerrainMapData
} from '../utils/terrainLayouts';
```

#### Propriétés ajoutées
```typescript
private layoutManager: LayoutManager | null = null;
private currentViewMode: string = 'scene'; // Default: 3D scene

// Terrain map data for visualization
private terrainMapData: TerrainMapData = {
    heightmap: null,
    slopeMap: null,
    flowMap: null,
    width: 0,
    height: 0
};
```

#### Méthodes ajoutées

**`registerLayouts()`** (~50 lignes)
- Enregistre 4 layouts : heightmap, slope, flow, material
- Utilise les fonctions de setup de `terrainLayouts.ts`
- Note : 'scene' mode géré par `restoreOriginal()` (pas besoin de layout)

**`switchViewMode(mode: string)`** (~60 lignes)
- Bascule entre les modes : 'scene', 'heightmap', 'slope', 'flow', 'material'
- Vérifie que les données terrain sont disponibles avant de switcher
- Met à jour le status bar avec le nom de la vue active
- Gestion d'erreurs avec logs

#### Modifications de méthodes existantes

**`init()`** : Ajout de l'initialisation du LayoutManager
```typescript
// Initialize layout manager
const container = document.getElementById('viewer-canvas-container');
if (container) {
    this.layoutManager = new LayoutManager(container);
    this.registerLayouts();
    appLogger.info('Layout manager initialized for terrain views');
}
```

**`generateTerrain()`** : Stockage des données de terrain
```typescript
// Store terrain map data for visualization in different views
this.terrainMapData = {
    heightmap: meshData.heightmap ? new Float32Array(meshData.heightmap) : null,
    slopeMap: meshData.slope_map ? new Float32Array(meshData.slope_map) : null,
    flowMap: null, // Phase 2
    width: config.width,
    height: config.height
};
```

**`cleanup()`** : Nettoyage du LayoutManager et des données
```typescript
// Cleanup layout manager
if (this.layoutManager) {
    this.layoutManager.destroy();
    this.layoutManager = null;
}

// Clear terrain map data
this.terrainMapData = {
    heightmap: null,
    slopeMap: null,
    flowMap: null,
    width: 0,
    height: 0
};
```

**`getConfig()`** : Ajout des boutons de toolbar
```typescript
toolbarActions: [
    {
        id: 'generate-terrain',
        icon: '🏔️',
        tooltip: 'Generate Terrain',
        action: () => this.generateTerrain()
    },
    { type: 'divider' },
    {
        id: 'view-scene',
        icon: '🎬',
        tooltip: '3D Scene',
        action: () => this.switchViewMode('scene')
    },
    {
        id: 'view-heightmap',
        icon: '🗺️',
        tooltip: 'Heightmap',
        action: () => this.switchViewMode('heightmap')
    },
    {
        id: 'view-slope',
        icon: '📐',
        tooltip: 'Slope Map',
        action: () => this.switchViewMode('slope')
    },
    {
        id: 'view-flow',
        icon: '💧',
        tooltip: 'Flow Map (WIP)',
        action: () => this.switchViewMode('flow')
    },
    {
        id: 'view-material',
        icon: '🎨',
        tooltip: 'Material Map (WIP)',
        action: () => this.switchViewMode('material')
    }
],

layoutActions: [], // Removed (view switcher now in toolbarActions)
```

---

## 🎨 Design des vues

### Vue Heightmap
**Colormap** : Terrain (6 couleurs)
- 🟦 Deep blue (0, 0, 128) → Eau profonde
- 🔵 Light blue (0, 128, 255) → Eau peu profonde
- 🟢 Green (0, 200, 0) → Plaines
- 🟡 Yellow (200, 200, 0) → Collines
- 🟠 Orange (255, 100, 0) → Montagnes
- ⚪ White (255, 255, 255) → Pics enneigés

**Overlay** :
- Stats box (top-left) : Min, Max, Mean, σ
- Colormap legend (bottom) : Gradient bar + labels

### Vue Slope
**Colormap** : Grayscale (2 couleurs)
- ⚫ Black (0, 0, 0) → Plat (0°)
- ⚪ White (255, 255, 255) → Raide (90°)

**Overlay** :
- Stats box (top-left) : Min, Max, Mean, σ
- Colormap legend (bottom) : Gradient bar + labels (en degrés)

### Vues Flow et Material
**Statut** : Placeholder (Phase 2 et 3)
- Canvas noir avec texte "Not yet implemented"
- Message de phase : "(Phase 2: Hydrology)" ou "(Phase 3: Materials)"

---

## 🧪 Tests et validation

### Compilation TypeScript
```bash
cd code/app/web && npm run build
```
**Résultat** : ✅ **Succès** (0 erreurs, 41 modules transformés, 1.19s)

### Vérification des erreurs
```bash
get_errors()
```
**Résultat** : ✅ **No errors found**

### Build output
```
dist/index.html                                  0.39 kB
dist/assets/polylab_viewer_bg-C2mY6VG_.wasm  3,038.23 kB
dist/assets/index-DESepPDo.css                  18.26 kB
dist/assets/polylab_viewer-DWtJyrAo.js          37.15 kB
dist/assets/polylab_rover-fTHnUolK.js           39.89 kB
dist/assets/polylab_viewer-BWcFnYr4.js          81.64 kB
dist/assets/index--yAz4rQU.js                  140.43 kB
```

---

## 📊 Statistiques

| Métrique                  | Valeur   |
|---------------------------|----------|
| **Nouveaux fichiers**     | 2        |
| **Fichiers modifiés**     | 1        |
| **Lignes ajoutées**       | ~550     |
| **Lignes de code total**  | ~680     |
| **Erreurs TypeScript**    | 0        |
| **Temps de compilation**  | 1.19s    |
| **Layouts disponibles**   | 5        |
| **Colormaps prédéfinis**  | 4        |

---

## 🚀 Utilisation

### 1. Générer un terrain
1. Ouvrir le projet "Perlin Terrain"
2. Configurer les paramètres (seed, octaves, persistence, scale)
3. Cliquer sur "🏔️ Generate Terrain"
4. Le terrain 3D est généré et affiché

### 2. Basculer entre les vues
**Boutons de toolbar** (de gauche à droite) :
- 🎬 **3D Scene** : Vue 3D du terrain (WebGPU)
- 🗺️ **Heightmap** : Carte des hauteurs avec colormap terrain
- 📐 **Slope Map** : Carte des pentes en niveaux de gris
- 💧 **Flow Map** : (WIP) Carte de flux
- 🎨 **Material Map** : (WIP) Carte des matériaux

**Comportement** :
- Si aucun terrain n'est généré → ⚠️ "Generate terrain first"
- Sinon → Vue switched avec stats et colormap legend

### 3. Interpréter les statistiques
**Heightmap** :
- Min/Max : Hauteur minimale/maximale du terrain
- Mean : Hauteur moyenne
- σ (sigma) : Écart-type (variabilité)

**Slope** :
- Min/Max : Pente minimale/maximale (en degrés)
- Mean : Pente moyenne
- σ : Écart-type des pentes

---

## 🔄 Workflow de développement

### Architecture modulaire
```
PerlinProject
    ├─ init()
    │   ├─ initTerrain() (WASM)
    │   ├─ new LayoutManager(container)
    │   └─ registerLayouts()
    │       ├─ heightmap layout
    │       ├─ slope layout
    │       ├─ flow layout
    │       └─ material layout
    │
    ├─ generateTerrain()
    │   ├─ TerrainHandle(config)
    │   ├─ getMeshData()
    │   ├─ load_mesh() (viewer)
    │   └─ Store terrainMapData
    │
    ├─ switchViewMode(mode)
    │   ├─ mode === 'scene' → restoreOriginal()
    │   └─ mode !== 'scene' → switchLayout(mode)
    │       ├─ setupHeightmapView()
    │       ├─ setupSlopeMapView()
    │       ├─ setupFlowMapView()
    │       └─ setupMaterialMapView()
    │
    └─ cleanup()
        ├─ layoutManager.destroy()
        └─ Clear terrainMapData
```

### Flux de données
```
TerrainHandle.getMeshData()
    ↓
meshData.heightmap, meshData.slope_map
    ↓
terrainMapData: TerrainMapData
    ↓
setupHeightmapView(container, terrainMapData)
    ↓
renderScalarMap(canvas, data, width, height, colormap)
    ↓
Canvas 2D avec colormap + stats + legend
```

---

## 🎯 Extension future

### Phase 2 : Hydrology (2-3 semaines)
- ✅ Placeholder déjà en place (`setupFlowMapView`)
- TODO : Implémenter flow direction (D8 algorithm)
- TODO : Implémenter flow accumulation
- TODO : Rendu avec flèches directionnelles + heatmap

### Phase 3 : Materials (1-2 semaines)
- ✅ Placeholder déjà en place (`setupMaterialMapView`)
- TODO : Implémenter material classification
- TODO : Implémenter splat maps (RGB channels)
- TODO : Rendu avec canaux RGB (R=roche, G=herbe, B=sable)

### Autres projets
Le système de layout peut être réutilisé pour :
- **CompressionProject** : Vues avant/après compression, heatmaps d'erreur
- **RoverProject** : Déjà implémenté (stereo, depth, point cloud)
- **ViewerProject** : Vues wireframe/solid/vertices
- **Futurs projets** : Tout projet nécessitant plusieurs vues de données

---

## ✅ Checklist de validation

- [x] Système de colormap générique créé
- [x] Layouts de terrain implémentés
- [x] PerlinProject intégré avec LayoutManager
- [x] Boutons de toolbar ajoutés
- [x] Données terrain stockées après génération
- [x] Méthode switchViewMode() implémentée
- [x] Cleanup et lifecycle gérés
- [x] 0 erreurs TypeScript
- [x] Build réussi (1.19s)
- [x] Placeholders pour Phase 2 et 3
- [x] Documentation complète

---

## 📝 Notes techniques

### LayoutManager (réutilisé)
- Déjà existant dans `core/LayoutManager.ts`
- Utilisé par RoverProject
- Gère le cycle de vie des layouts (setup/cleanup)
- Préserve le canvas original (WebGPU/WASM)

### Canvas 2D vs WebGPU
- **3D Scene** : Canvas WebGPU (même instance préservée)
- **Map views** : Canvas 2D créé dynamiquement
- Switch entre les deux : `restoreOriginal()` vs `switchLayout()`

### Performance
- Rendu 2D : O(width * height) pixels
- Colormap interpolation : O(1) per pixel (lookup + lerp)
- Stats computation : O(n) where n = data.length
- Pas de frame-by-frame updates (static views)

### Memory management
- terrainMapData : Float32Array copiés (pas de référence WASM)
- Cleanup dans `cleanup()` : nullify tous les arrays
- LayoutManager.destroy() : remove event listeners

---

## 🎉 Conclusion

L'**Option 3 (Mode Switcher)** a été implémentée avec succès :
- ✅ Système **100% générique** (mapRenderer, LayoutManager)
- ✅ Layouts **réutilisables** (terrainLayouts)
- ✅ Configuration **spécifique** à PerlinProject
- ✅ **0 erreurs** TypeScript
- ✅ Build **réussi** (1.19s)
- ✅ **Extensible** pour Phase 2 et 3
- ✅ **Prêt pour tests** utilisateur

Le système est prêt à être testé dans l'interface web ! 🚀
