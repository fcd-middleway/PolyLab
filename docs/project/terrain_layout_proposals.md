# Propositions de Layout Multi-Vues pour le Terrain

## Contexte

Pour le projet Perlin (génération de terrain), on a besoin de visualiser :
- 🏔️ **Vue 3D** : Mesh terrain principal (vue WebGPU)
- 🗺️ **Heightmap** : Carte des hauteurs (2D)
- 📐 **Slope Map** : Carte des pentes (2D)
- 💧 **Flow Map** (futur) : Direction et accumulation d'eau (2D)
- 🎨 **Material Map** (futur) : Répartition des matériaux (2D)

L'objectif : **pouvoir visualiser le terrain 3D ET les cartes dérivées** pour le debug et la vérification.

---

## 🎯 Option 1 : Split Vertical avec Tabs

**Layout** : Vue 3D à gauche (principale), panneau de cartes à droite avec onglets.

```
┌─────────────────────────────────────────────────┬──────────────────────┐
│                                                 │  ┌─────────────────┐ │
│                                                 │  │ [3D] Heightmap  │ │
│                                                 │  │  Slope  Flow    │ │
│                                                 │  └─────────────────┘ │
│                                                 │                      │
│         VUE 3D DU TERRAIN                       │   ┌──────────────┐  │
│         (Canvas WebGPU)                         │   │              │  │
│         Rotation / Zoom                         │   │  Heightmap   │  │
│                                                 │   │   (Canvas)   │  │
│                                                 │   │              │  │
│                                                 │   │              │  │
│                                                 │   └──────────────┘  │
│                                                 │                      │
│                                                 │   Stats:             │
│                                                 │   Min: 0.0           │
│                                                 │   Max: 50.0          │
│                                                 │   Avg: 25.3          │
└─────────────────────────────────────────────────┴──────────────────────┘
         70% de largeur                                  30%
```

### ✅ Avantages
- Vue 3D toujours visible (focus principal)
- Cartes accessibles via tabs (pas de surcharge visuelle)
- Simple à implémenter (extension du layout actuel)
- Largeur ajustable avec splitter

### ❌ Inconvénients
- Les cartes 2D sont petites (~30% largeur)
- Une seule carte visible à la fois
- Nécessite de cliquer sur les tabs pour changer

### 🛠️ Implémentation
- Ajouter un `<div class="terrain-maps-panel">` à droite
- Tabs cliquables pour switcher entre heightmap/slope/flow
- Canvas 2D pour chaque carte (rendu avec `getImageData()` + colormap)
- Stats sous la carte active

---

## 🎯 Option 2 : Grid avec Miniatures (Picture-in-Picture)

**Layout** : Vue 3D principale + 3 miniatures en overlay (coins de l'écran).

```
┌───────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                          ┌──────────┐   │
│  │Heightmap │                                          │  Slope   │   │
│  │  (mini)  │                                          │  (mini)  │   │
│  └──────────┘                                          └──────────┘   │
│                                                                        │
│                                                                        │
│                    VUE 3D DU TERRAIN                                   │
│                    (Canvas WebGPU)                                     │
│                    Rotation / Zoom                                     │
│                                                                        │
│                                                                        │
│                                                                        │
│  ┌──────────┐                                          ┌──────────┐   │
│  │   Flow   │                                          │ Material │   │
│  │  (mini)  │                                          │  (mini)  │   │
│  └──────────┘                                          └──────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

**Interaction** :
- Clic sur une miniature → **swap** avec la vue principale
- La vue 3D va dans la miniature cliquée
- Double-clic sur miniature → fullscreen de cette carte

### ✅ Avantages
- **Toutes les cartes visibles simultanément** (aperçu global)
- Vue 3D reste dominante
- Interaction intuitive (clic pour swap)
- Bon pour comparer rapidement les cartes

### ❌ Inconvénients
- Miniatures très petites (difficile de voir les détails)
- Overlay peut gêner la vue 3D
- Plus complexe à implémenter (gestion du swap)
- Pas idéal si >4 cartes

### 🛠️ Implémentation
- 4 canvas en position `absolute` (3 mini + 1 grande)
- Système de swap : échanger les tailles et positions au clic
- Bordure colorée pour indiquer la carte active
- Possibilité de cacher les miniatures (toggle)

---

## 🎯 Option 3 : Mode Switcher (inspiré RoverProject)

**Layout** : Un seul grand canvas, boutons pour changer de mode de visualisation.

```
┌───────────────────────────────────────────────────────────────────────┐
│  Toolbar:  [🏔️ 3D] [🗺️ Heightmap] [📐 Slope] [💧 Flow] [🎨 Material]  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                                                                        │
│                                                                        │
│                     VUE ACTIVE (plein écran)                           │
│                                                                        │
│               - 3D : Canvas WebGPU avec terrain                        │
│               - Heightmap : Canvas 2D avec colormap                    │
│               - Slope : Canvas 2D avec gradient                        │
│               - Flow : Canvas 2D avec flèches                          │
│                                                                        │
│                                                                        │
│                                                                        │
│  Stats de la vue active:                                               │
│  Min: 0.0  |  Max: 50.0  |  Avg: 25.3                                 │
└───────────────────────────────────────────────────────────────────────┘
```

**Modes disponibles** :
1. **3D View** : Terrain mesh avec WebGPU (rotation, zoom)
2. **Heightmap** : Carte des hauteurs (bleu → vert → jaune → rouge)
3. **Slope** : Carte des pentes (noir → blanc, zones plates vs raides)
4. **Flow** : Direction d'écoulement (flèches + accumulation)
5. **Material** : Répartition des matériaux (RGB = 3 matériaux)

### ✅ Avantages
- **Chaque vue est grande** (plein écran = détails visibles)
- Utilise le système de LayoutManager existant (comme RoverProject)
- Simple conceptuellement (un seul canvas actif)
- Performance optimale (une seule vue à rendre)
- Facile d'ajouter de nouveaux modes

### ❌ Inconvénients
- **Une seule vue à la fois** (pas de comparaison simultanée)
- Nécessite de cliquer pour switcher entre les vues
- Perte de contexte 3D quand on regarde une carte 2D

### 🛠️ Implémentation
- Réutiliser `LayoutManager` (déjà existant dans RoverProject)
- Chaque mode = une fonction de layout :
  - `scene3DLayout()` : canvas WebGPU standard
  - `heightmapLayout()` : canvas 2D + rendu heightmap
  - `slopeLayout()` : canvas 2D + rendu slope
  - etc.
- Boutons de toolbar pour `switchViewMode(mode)`
- Stats contextuelles selon le mode actif

---

## 📊 Comparaison

| Critère                    | Option 1<br>Split+Tabs | Option 2<br>PiP Grid | Option 3<br>Switcher |
|----------------------------|:----------------------:|:--------------------:|:--------------------:|
| **Visibilité 3D**          | ⭐⭐⭐                  | ⭐⭐⭐                | ⭐⭐⭐                |
| **Visibilité cartes**      | ⭐⭐                    | ⭐⭐                  | ⭐⭐⭐                |
| **Comparaison simultanée** | ❌ (tabs)              | ⭐⭐⭐                | ❌ (switch)          |
| **Détails des cartes**     | ⭐⭐                    | ⭐                    | ⭐⭐⭐                |
| **Simplicité UI**          | ⭐⭐⭐                  | ⭐⭐                  | ⭐⭐⭐                |
| **Complexité code**        | ⭐⭐                    | ⭐                    | ⭐⭐⭐                |
| **Extensibilité**          | ⭐⭐                    | ⭐                    | ⭐⭐⭐                |
| **Performance**            | ⭐⭐                    | ⭐                    | ⭐⭐⭐                |

---

## 🎯 Recommandation personnelle

**Option 3 (Switcher)** pour commencer, car :
- ✅ Réutilise le code existant (LayoutManager)
- ✅ Simple à implémenter
- ✅ Chaque vue est grande et détaillée
- ✅ Performance optimale
- ✅ Facile d'ajouter des vues futures (érosion, flow, etc.)

**Si besoin de comparaison simultanée plus tard** :
- On peut combiner Option 3 + mini-overlay de Option 2
- Ou ajouter un mode "Split" dans l'Option 3

---

## 🚀 Prochaines étapes (selon l'option choisie)

### Si Option 1 (Split+Tabs)
1. Créer `TerrainMapsPanel` component
2. Ajouter canvas 2D pour chaque carte
3. Implémenter colormap pour heightmap/slope
4. Ajouter tabs clickables

### Si Option 2 (PiP Grid)
1. Créer système de mini-canvas en overlay
2. Implémenter swap logic (clic pour échanger)
3. Gestion du resize des miniatures
4. Bordures/légendes pour chaque mini-vue

### Si Option 3 (Switcher)
1. Créer `TerrainLayoutManager` (réutilise LayoutManager)
2. Implémenter layouts pour chaque mode :
   - `heightmapLayout()` : rendu 2D heightmap
   - `slopeLayout()` : rendu 2D slope
3. Ajouter boutons de mode dans toolbar
4. Colormap utils (height → couleur, slope → intensité)

---

## 💡 Bonus : Hybride (Option 3 + mini-preview)

Combiner le meilleur des deux mondes :

```
┌───────────────────────────────────────────────────────────────────────┐
│  [🏔️ 3D] [🗺️ Heightmap] [📐 Slope]        Mini-preview: ☑ Show      │
├───────────────────────────────────────────────┬───────────────────────┤
│                                               │ ┌─────────────┐       │
│                                               │ │ Heightmap   │       │
│                                               │ │  (preview)  │       │
│                                               │ └─────────────┘       │
│         VUE PRINCIPALE ACTIVE                 │ ┌─────────────┐       │
│         (3D, Heightmap, ou Slope)             │ │   Slope     │       │
│                                               │ │  (preview)  │       │
│                                               │ └─────────────┘       │
│                                               │ ┌─────────────┐       │
│                                               │ │    Flow     │       │
│                                               │ │  (preview)  │       │
│                                               │ └─────────────┘       │
└───────────────────────────────────────────────┴───────────────────────┘
         Vue active 70-80%                            Preview 20-30%
```

- Mode principal = switcher (Option 3)
- Colonne de droite = mini-previews des autres cartes (cachable)
- Toggle pour afficher/cacher les previews

---

**À toi de choisir !** 🎨
