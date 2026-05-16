# Rover Vision - Modes d'affichage

Ce document décrit les différents modes de visualisation disponibles dans le projet Rover Vision.

## Vue d'ensemble

Le système de modes permet d'adapter l'interface selon la tâche en cours, évitant la surcharge visuelle tout en offrant une flexibilité maximale.

## Modes disponibles

### 📐 Mode 1 : Scene Explorer

**Layout** : Vue unique plein écran
```
┌─────────────────────────────────┐
│                                 │
│        Scène 3D complète        │
│      (navigation libre)         │
│                                 │
└─────────────────────────────────┘
```

**Usage** :
- Positionner le rover dans la scène
- Placer et déplacer les cibles
- Navigation générale dans l'environnement 3D
- Configuration initiale de la scène

**Implémentation** : ✅ Phase 1

---

### 👁️ Mode 2 : Stereo Vision

**Layout** : Split horizontal 50/50
```
┌───────────────┬─────────────────┐
│   Caméra      │    Caméra       │
│   Gauche      │    Droite       │
│               │                 │
└───────────────┴─────────────────┘
```

**Usage** :
- Visualiser les images stéréo simultanément
- Calibration des caméras (baseline, FOV)
- Capture de paires d'images stéréo
- Validation de l'alignement des vues

**Détails techniques** :
- Deux renderers WebGPU distincts
- Caméras positionnées selon le baseline configuré (défaut 0.3m)
- Synchronisation des paramètres de vue (orientation, FOV)

**Implémentation** : ✅ Phase 1

---

### 🔬 Mode 3 : Depth Analysis

**Layout** : Split avec 3 zones
```
┌────────────────┬───────────────┐
│                │   Depth Map   │
│  Stereo Pair   │   (colorée)   │
│  (L + R)       ├───────────────┤
│                │   Histogramme │
└────────────────┴───────────────┘
```

**Usage** :
- Analyser la carte de profondeur générée
- Valider la qualité de la reconstruction
- Identifier les zones problématiques (occlusions, texture faible)
- Ajuster les paramètres de l'algorithme de matching

**Détails techniques** :
- Stereo Pair : les deux images source côte à côte (zone gauche)
- Depth Map : visualisation colorée de la profondeur (zone supérieure droite)
  - Proche = chaud (rouge, jaune)
  - Loin = froid (bleu, violet)
- Histogramme : distribution des valeurs de profondeur (zone inférieure droite)

**Implémentation** : ✅ Phase 1

---

### 🎯 Mode 4 : Full Analysis

**Layout** : Grid 2×2
```
┌────────────┬───────────────┐
│  Scène 3D  │  Caméra L     │
├────────────┼───────────────┤
│ Point Cloud│  Depth Map    │
└────────────┴───────────────┘
```

**Usage** :
- Vue d'ensemble complète pour debugging
- Comparaison directe entre différentes représentations
- Validation croisée (scène réelle vs reconstruction)
- Présentation des résultats

**Détails techniques** :
- 4 renderers WebGPU simultanés
- Synchronisation optionnelle des caméras (scène 3D ↔ point cloud)
- Performance : peut nécessiter une optimisation GPU

**Implémentation** : 📅 Phase 2

---

### 🎨 Mode 5 : Point Cloud Focus

**Layout** : Vue unique plein écran
```
┌─────────────────────────────────┐
│                                 │
│      Point Cloud 3D             │
│   (rotation, zoom, filtres)     │
│                                 │
└─────────────────────────────────┘
```

**Usage** :
- Explorer le nuage de points reconstruit en détail
- Appliquer des filtres (distance, confiance, outliers)
- Mesurer des distances dans la reconstruction
- Exporter le point cloud

**Détails techniques** :
- Rendu optimisé pour grand nombre de points (>100k)
- Filtres en temps réel (sliders de distance min/max)
- Colorisation selon profondeur ou confiance
- Export au format PLY ou XYZ

**Implémentation** : 📅 Phase 2

---

## 💡 Bonus : Vue Picture-in-Picture (PiP)

**Concept** : Mini-vue flottante superposée au mode actuel
```
┌─────────────────────────────────┐
│                                 │
│        Vue principale           │
│                          ┌──────┤
│                          │ PiP  │
└──────────────────────────┴──────┘
```

**Exemples d'usage** :
- En mode Scene Explorer : mini-vue de la caméra gauche dans un coin
- En mode Point Cloud : mini-vue de la depth map
- En mode Stereo : mini-vue de la scène 3D pour le contexte

**Détails techniques** :
- Fenêtre flottante draggable
- Taille ajustable (petit/moyen/grand)
- Toggle on/off depuis n'importe quel mode
- Choix du contenu de la PiP (dropdown)

**Implémentation** : 📅 Phase 3 (optionnel)

---

## Navigation entre modes

### Menu View

Interface principale : **menu View** avec entrées directes

```
View ▾
├─ 🎬 Scene Explorer
├─ 👁️ Stereo Vision
├─ 🔬 Depth Analysis
├─ ──────────────────
├─ 🎯 Full Analysis Grid (désactivé)
└─ 🎨 Point Cloud Focus (désactivé)
```

**Caractéristiques** :
- Entrées de menu avec icônes et labels clairs
- Mode actif indiqué visuellement (à implémenter)
- Séparateur entre modes essentiels et modes avancés
- Entrées désactivées grisées
- Un seul clic pour basculer

**Position** : Menu principal dans le header de l'application

**Avantages** :
- ✅ N'occupe pas d'espace dans la zone de visualisation
- ✅ Organisation hiérarchique claire
- ✅ Regroupement logique des modes
- ✅ Cohérent avec les autres actions du projet (Rover menu, etc.)

---

## Feuille de route

### ✅ Phase 1 - Modes essentiels (Implémentation immédiate)
1. Mode 1 : Scene Explorer (déjà fonctionnel)
2. Mode 2 : Stereo Vision
3. Mode 3 : Depth Analysis

### 📅 Phase 2 - Modes avancés
4. Mode 4 : Full Analysis (grid 2×2)
5. Mode 5 : Point Cloud Focus

### 📅 Phase 3 - Améliorations (optionnel)
- Picture-in-Picture flottant
- Raccourcis clavier (touches 1-5)
- Sauvegarde du mode préféré
- Layouts personnalisables

---

## Notes techniques

### Architecture
- Chaque mode = configuration de layout définie en TypeScript
- Un ou plusieurs canvas WebGPU selon le mode
- Gestion du resize automatique par mode
- State management pour conserver les paramètres entre modes

### Performance
- Mode 1-3 : un seul renderer actif à la fois → léger
- Mode 4 : 4 renderers simultanés → plus gourmand
- Mode 5 : rendu optimisé points → instancing ou compute shaders

### Extensibilité
- Facile d'ajouter de nouveaux modes
- Configuration déclarative (JSON-like)
- Système de plugins pour modes personnalisés (future)
