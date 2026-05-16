# Système de modes de vue - Implémentation

Ce document décrit l'implémentation du système de modes de vue dans le projet Rover.

## Architecture

### Composants

#### RoverProject (`RoverProject.ts`)
- **Rôle** : Projet principal qui orchestre les modes
- **Menu View** : Les modes sont accessibles via des entrées de menu directes
- **Méthodes clés** :
  - `switchViewMode(mode)` : Change le mode et reconfigure le layout
  - `setupSceneLayout()` : Configuration du Mode Scene Explorer
  - `setupStereoLayout()` : Configuration du Mode Stereo Vision
  - `setupDepthLayout()` : Configuration du Mode Depth Analysis
  - `setupFullGridLayout()` : Configuration du Mode Full Grid (désactivé)
  - `setupPointCloudLayout()` : Configuration du Mode Point Cloud (désactivé)

### Flux de données

```
Menu View (UI)
      ↓ (clic sur entrée)
   action callback
      ↓
RoverProject.switchViewMode()
      ↓
setupXXXLayout() (selon le mode)
      ↓
Modification du DOM (canvas-container)
```

## Modes implémentés

### ✅ Phase 1 - Modes essentiels

#### Mode 1 : Scene Explorer
- **Status** : ✅ Fonctionnel
- **Layout** : Canvas unique plein écran
- **Usage** : Navigation libre dans la scène 3D

#### Mode 2 : Stereo Vision
- **Status** : 🚧 Placeholder (grille 2 colonnes)
- **Layout** : Deux zones côte à côte pour caméras gauche/droite
- **TODO** : Implémenter les renderers pour chaque caméra

#### Mode 3 : Depth Analysis
- **Status** : 🚧 Placeholder (grille 2x2 avec fusion)
- **Layout** : Stereo pair (gauche), Depth map (haut droit), Histogramme (bas droit)
- **TODO** : Implémenter la visualisation de la profondeur

### 📅 Phase 2 - Modes avancés (désactivés)

#### Mode 4 : Full Grid
- **Status** : ⏸️ Désactivé (bouton grisé)
- **Layout** : Grille 2x2 avec Scene 3D, Camera L, Point Cloud, Depth Map

#### Mode 5 : Point Cloud
- **Status** : ⏸️ Désactivé (entrée de menu grisée)
- **Layout** : Canvas unique optimisé pour le rendu de points

## Interface utilisateur

Les modes sont accessibles via le **menu View** du header :

```
View ▾
├─ 🎬 Scene Explorer      ← Mode actif
├─ 👁️ Stereo Vision
├─ 🔬 Depth Analysis
├─ ──────────────────
├─ 🎯 Full Analysis Grid  (désactivé)
└─ 🎨 Point Cloud Focus   (désactivé)
```

**Avantages** :
- N'occupe pas d'espace dans la zone de visualisation
- Regroupement logique avec séparateurs
- Cohérent avec les autres actions du projet

## Prochaines étapes

### Court terme
1. **Implémenter le Mode Stereo Vision**
   - Créer deux renderers WebGPU distincts
   - Positionner les caméras selon le baseline (0.3m)
   - Synchroniser les orientations

2. **Implémenter le Mode Depth Analysis**
   - Afficher les images stéréo dans la zone gauche
   - Créer un renderer pour la depth map (colorisée)
   - Ajouter un histogramme de distribution de profondeur

### Moyen terme
3. **Algorithme de stereo matching**
   - Implémentation d'un algorithme de matching (Block Matching ou SGM)
   - Calcul de la carte de disparité
   - Conversion disparité → profondeur

4. **Génération du point cloud**
   - Triangulation des points 3D à partir de la depth map
   - Colorisation depuis les images caméras
   - Ajout au renderer 3D

### Long terme
5. **Modes avancés**
   - Activer Full Grid (4 renderers simultanés)
   - Activer Point Cloud Focus (rendu optimisé)

6. **Améliorations UX**
   - Raccourcis clavier (touches 1-5)
   - Picture-in-Picture flottant
   - Sauvegarde du mode préféré

## Notes techniques

### Performance
- **Mode Scene** : 1 renderer → léger
- **Mode Stereo** : 2 renderers → moyen
- **Mode Depth** : 3 renderers (stereo + depth + histogram) → moyen-élevé
- **Mode Full Grid** : 4 renderers → élevé (attention à la charge GPU)

### Gestion du DOM
- Le container `canvas-container` est reconfiguré à chaque changement de mode
- Les placeholders utilisent `innerHTML` pour afficher des messages temporaires
- À terme, chaque mode devra gérer ses propres canvas WebGPU

### État
- L'état actuel est stocké dans `RoverProject.currentViewMode`
- La toolbar se synchronise automatiquement via le callback
- Le changement de mode met à jour la status bar

## Ressources

- **Documentation des modes** : `/docs/rover/VIEW_MODES.md`
- **Code source** :
  - Projet : `/code/app/web/src/projects/RoverProject.ts`
