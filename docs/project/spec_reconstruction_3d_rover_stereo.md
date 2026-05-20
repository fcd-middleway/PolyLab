# Spécification technique — Reconstruction 3D progressive par rover stéréoscopique

## 1. Objectif

L’objectif est d’ajouter à un viewer 3D un mode rover capable de reconstruire progressivement une scène 3D à partir de deux caméras embarquées, placées comme deux yeux.

Le rover possède :

- une caméra gauche ;
- une caméra droite ;
- une pose connue dans la scène 3D ;
- deux flux images synchronisés, capturés à chaque pas de simulation ou à intervalle régulier.

À partir des images gauche/droite, le système doit produire :

1. une carte de disparité ;
2. une carte de profondeur ;
3. un nuage de points local, exprimé dans le repère de la caméra gauche ;
4. un nuage de points global, accumulé au fil du déplacement du rover ;
5. éventuellement, à terme, un maillage reconstruit.

La recommandation principale est de ne pas commencer par un SLAM complet, mais par une pipeline stéréo classique avec pose connue. Dans un viewer 3D simulé, la pose du rover et des caméras est normalement déjà disponible. Cela simplifie énormément le problème : il n’est pas nécessaire d’estimer le déplacement du rover à partir des images, contrairement à un vrai robot qui doit faire de l’odométrie visuelle ou du SLAM.

---

## 2. Décision d’architecture recommandée

### Approche recommandée pour le premier prototype

Utiliser la pipeline suivante :

```text
Caméra gauche + caméra droite
        ↓
Synchronisation des images
        ↓
Rectification ou hypothèse de caméras déjà alignées
        ↓
Calcul de disparité dense
        ↓
Conversion disparité → profondeur
        ↓
Reprojection profondeur → points 3D locaux
        ↓
Transformation caméra → rover → monde
        ↓
Filtrage + accumulation dans un voxel map
        ↓
Affichage du nuage de points reconstruit
```

Cette approche est suffisante pour obtenir une reconstruction visible, progressive et explicable.

### Pourquoi cette approche

Elle est adaptée parce que :

- elle utilise des méthodes classiques, éprouvées et documentées ;
- elle ne nécessite pas de modèle IA ;
- elle peut fonctionner avec des images de résolution modérée ;
- elle est débogable étape par étape ;
- elle est compatible avec un viewer 3D Web/WASM ;
- elle évite la complexité d’un SLAM complet ;
- elle exploite un avantage fort de votre contexte : la pose exacte du rover est déjà connue par le moteur 3D.

---

## 3. Glossaire utile

### Stéréoscopie

La stéréoscopie consiste à observer la même scène depuis deux points de vue légèrement décalés. La différence de position apparente d’un même point entre l’image gauche et l’image droite permet d’estimer sa profondeur.

### Point caractéristique / point d’intérêt / keypoint

Un point caractéristique est un point visuel identifiable dans une image : coin, texture locale, contraste fort, contour, détail stable. Des algorithmes comme ORB, SIFT ou FAST peuvent détecter ce type de points.

Dans votre cas, il existe deux familles possibles :

- reconstruction dense : on essaie d’estimer une profondeur pour beaucoup de pixels ;
- reconstruction sparse : on estime uniquement des points caractéristiques.

Pour un rendu visuel de reconstruction, il faut privilégier une approche dense ou semi-dense.

### Disparité

La disparité est le décalage horizontal d’un même point entre l’image gauche et l’image droite, après rectification.

```text
disparité = x_gauche - x_droite
```

Plus un objet est proche, plus la disparité est grande. Plus un objet est loin, plus la disparité est faible.

### Carte de disparité

Image en niveaux de gris ou en valeurs flottantes où chaque pixel contient une disparité estimée.

### Carte de profondeur

Image où chaque pixel contient une distance estimée par rapport à la caméra.

### Nuage de points

Collection de points 3D, généralement sous la forme :

```ts
type Point3D = {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
  confidence?: number;
};
```

### SLAM

SLAM signifie Simultaneous Localization And Mapping. Le système estime à la fois sa position et la carte de l’environnement. Dans votre cas, le SLAM n’est pas indispensable au départ parce que la pose du rover est connue dans la scène 3D.

### Visual odometry

L’odométrie visuelle estime le mouvement de la caméra entre deux images successives. Elle devient utile si la pose du rover n’est pas connue ou si l’on veut simuler un rover “réel” sans accès à la vérité terrain du moteur 3D.

### Multi-View Stereo

La Multi-View Stereo reconstruit une scène à partir d’un grand nombre d’images et de poses caméra. C’est une approche souvent plus qualitative, mais généralement plus lourde et plutôt offline.

---

## 4. Hypothèses techniques à poser dans le projet

Pour maximiser les chances de réussite, le prototype doit poser explicitement les hypothèses suivantes.

### Hypothèse 1 — Les caméras sont rigides

La caméra gauche et la caméra droite sont fixées au rover. Leur position relative ne change jamais.

Le paramètre le plus important est la baseline, c’est-à-dire la distance entre les deux caméras.

Exemple :

```ts
const stereoBaselineMeters = 0.20; // 20 cm
```

### Hypothèse 2 — Les images sont synchronisées

Pour une reconstruction correcte, l’image gauche et l’image droite doivent correspondre au même instant logique de simulation.

Il faut éviter :

```text
image gauche à t
image droite à t + Δ
```

Sinon, un objet ou le rover peut avoir bougé entre les deux captures, ce qui dégrade fortement la disparité.

### Hypothèse 3 — Les caméras sont idéalement parallèles

Pour un premier prototype, il faut configurer les deux caméras avec :

- même FOV ;
- même résolution ;
- même near/far plane ;
- même orientation ;
- même axe optique ;
- seulement une translation horizontale entre elles.

Cela permet de simplifier la géométrie et de limiter le besoin de rectification.

### Hypothèse 4 — Le moteur 3D fournit la pose exacte

À chaque frame retenue, le moteur doit fournir :

- la matrice monde du rover ;
- la matrice monde de la caméra gauche ;
- la matrice monde de la caméra droite ;
- la matrice de projection des caméras ;
- idéalement la matrice inverse de vue/projection si elle est déjà disponible.

Cette information permet de replacer chaque point reconstruit dans le repère monde.

---

## 5. Principe mathématique minimal

### Formule de profondeur

Dans le cas simple de deux caméras parallèles et rectifiées :

```text
Z = fx * B / d
```

Où :

- `Z` est la profondeur du point ;
- `fx` est la focale horizontale en pixels ;
- `B` est la baseline entre les caméras, dans l’unité monde choisie ;
- `d` est la disparité en pixels.

Ensuite, pour convertir un pixel en point 3D dans le repère caméra :

```text
X = (u - cx) * Z / fx
Y = (v - cy) * Z / fy
Z = Z
```

Où :

- `u`, `v` sont les coordonnées du pixel ;
- `cx`, `cy` sont les coordonnées du centre optique ;
- `fx`, `fy` sont les focales en pixels.

### Conversion FOV → focale en pixels

Si la caméra est définie avec un FOV vertical :

```text
fy = imageHeight / (2 * tan(fovY / 2))
fx = fy * aspectRatio
```

Si la caméra est définie avec un FOV horizontal :

```text
fx = imageWidth / (2 * tan(fovX / 2))
fy = fx / aspectRatio
```

Il faut être très strict sur les unités. Si la baseline est en mètres, alors les profondeurs seront en mètres. Si le moteur 3D utilise une unité arbitraire, il faut documenter la correspondance.

---

## 6. Pipeline détaillée

## 6.1 Capture des deux images

Le viewer doit capturer les rendus des deux caméras dans deux buffers image.

Résolution recommandée pour le prototype :

```text
320 x 240 ou 640 x 480
```

Ne commencez pas en Full HD. La disparité dense coûte cher.

Structure suggérée :

```ts
type StereoImagePair = {
  frameId: number;
  timestamp: number;
  left: ImageData;
  right: ImageData;
  width: number;
  height: number;
  roverPoseWorld: Matrix4;
  leftCameraPoseWorld: Matrix4;
  rightCameraPoseWorld: Matrix4;
};
```

Points importants :

- capturer les deux caméras dans le même tick de simulation ;
- conserver les poses caméra correspondant exactement aux images ;
- ne pas mélanger les images et les poses de frames différentes.

---

## 6.2 Prétraitement

Le prétraitement minimal :

1. convertir RGBA → grayscale ;
2. éventuellement réduire la résolution ;
3. éventuellement appliquer un léger blur ;
4. éventuellement augmenter le contraste.

Pour un moteur 3D, il est utile d’ajouter de la texture aux surfaces. Les surfaces parfaitement unies posent problème aux algorithmes de stéréo passive.

Exemple de structure :

```ts
type PreprocessedStereoPair = {
  frameId: number;
  leftGray: Uint8Array;
  rightGray: Uint8Array;
  width: number;
  height: number;
  calibration: StereoCalibration;
  leftCameraPoseWorld: Matrix4;
};
```

---

## 6.3 Rectification

### Cas idéal : caméras déjà rectifiées

Si les deux caméras sont strictement parallèles, même focale, même résolution, même orientation, décalées uniquement sur l’axe X, les lignes épipolaires sont déjà horizontales. Dans ce cas, la recherche d’un point correspondant peut se faire sur la même ligne `y`.

C’est le cas à viser dans le prototype.

### Cas général : rectification nécessaire

Si les caméras ne sont pas parfaitement alignées, il faut rectifier les images. La rectification transforme les deux images pour que les points correspondants soient sur les mêmes lignes horizontales.

Dans OpenCV, cette étape s’appuie typiquement sur :

- paramètres intrinsèques de chaque caméra ;
- distorsion ;
- rotation relative ;
- translation relative ;
- `stereoRectify`;
- `initUndistortRectifyMap`;
- `remap`.

Dans un moteur 3D sans distorsion optique, la rectification peut être évitée si la configuration des caméras est propre.

---

## 6.4 Calcul de la disparité

### Option A — Block Matching simple

Le block matching cherche, pour chaque pixel de l’image gauche, le bloc le plus ressemblant dans l’image droite, sur la même ligne horizontale.

Principe :

```text
Pour chaque pixel (x, y) de l'image gauche :
  Pour chaque disparité candidate d :
    comparer le patch gauche autour de (x, y)
    avec le patch droit autour de (x - d, y)
  garder la disparité qui minimise l'erreur
```

Mesures possibles :

- SAD : Sum of Absolute Differences ;
- SSD : Sum of Squared Differences ;
- NCC : Normalized Cross Correlation.

Avantage :

- très simple à comprendre ;
- implémentable directement en Rust/WASM ;
- bon pour un prototype pédagogique.

Inconvénient :

- bruité ;
- mauvais sur surfaces uniformes ;
- mauvais aux contours ;
- sensible aux reflets, ombres, textures répétitives.

### Option B — StereoBM / StereoSGBM

Approche recommandée si OpenCV est disponible.

- `StereoBM` : plus simple, rapide, mais qualité inférieure.
- `StereoSGBM` : meilleure qualité, plus stable, souvent meilleur compromis.

Pour votre projet, `StereoSGBM` est le meilleur choix pragmatique.

Paramètres typiques de départ :

```ts
type StereoSgbmParameters = {
  minDisparity: number;        // 0 au début
  numDisparities: number;      // multiple de 16, ex: 64, 96, 128
  blockSize: number;           // impair, ex: 5, 7, 9
  uniquenessRatio: number;     // ex: 5 à 15
  speckleWindowSize: number;   // ex: 50 à 200
  speckleRange: number;        // ex: 1 à 3
  disp12MaxDiff: number;       // ex: 1
};
```

Valeurs de départ :

```ts
const defaultSgbm: StereoSgbmParameters = {
  minDisparity: 0,
  numDisparities: 96,
  blockSize: 7,
  uniquenessRatio: 10,
  speckleWindowSize: 100,
  speckleRange: 2,
  disp12MaxDiff: 1
};
```

### Détermination de `numDisparities`

Il faut choisir `numDisparities` selon la profondeur minimale que l’on veut détecter.

Formule :

```text
d = fx * B / Z
```

Si :

```text
fx = 500 px
B = 0.20 m
Zmin = 0.50 m
```

Alors :

```text
dmax = 500 * 0.20 / 0.50 = 200 px
```

Dans ce cas, `numDisparities = 96` serait insuffisant pour les objets très proches. Il faudrait plutôt 208 ou 224, en respectant le multiple de 16 selon l’implémentation OpenCV.

Pour démarrer, il vaut mieux éviter les objets trop proches et travailler sur une profondeur minimale raisonnable.

---

## 6.5 Filtrage de la disparité

La carte de disparité brute doit être filtrée avant de générer des points 3D.

Filtres minimaux recommandés :

1. supprimer les disparités nulles ou négatives ;
2. supprimer les profondeurs trop proches ;
3. supprimer les profondeurs trop lointaines ;
4. supprimer les points dont la confiance est faible ;
5. optionnel : supprimer les petits composants isolés ;
6. optionnel : appliquer un filtre de type WLS si disponible.

Exemple :

```ts
type DepthFilterSettings = {
  minDepth: number;       // ex: 0.20
  maxDepth: number;       // ex: 20.0
  minDisparity: number;   // ex: 1.0
  sampleStep: number;     // ex: 2 ou 4 pour sous-échantillonner
};
```

---

## 6.6 Conversion disparité → profondeur

Pour chaque pixel valide :

```ts
const z = fx * baseline / disparity;
const x = (u - cx) * z / fx;
const y = (v - cy) * z / fy;
```

Attention à l’axe Y. En image, `v` augmente vers le bas. Dans un monde 3D, l’axe vertical peut être orienté différemment. Il faudra peut-être inverser `Y`.

Variante fréquente :

```ts
const y = -(v - cy) * z / fy;
```

Cela dépend du repère choisi dans le viewer.

---

## 6.7 Génération du nuage de points local

Chaque point est créé dans le repère de la caméra gauche.

```ts
type LocalPoint = {
  positionCamera: Vec3;
  color: Vec3;
  confidence: number;
};
```

Pour coloriser le point, on prend la couleur du pixel correspondant dans l’image gauche.

```ts
const color = getRgb(leftImage, u, v);
```

Il est conseillé de sous-échantillonner :

```text
sampleStep = 2 → 1 pixel sur 4
sampleStep = 4 → 1 pixel sur 16
```

Au début, `sampleStep = 4` est raisonnable.

---

## 6.8 Transformation vers le monde

Chaque point local doit être transformé vers le repère global.

```text
P_world = T_world_leftCamera * P_camera
```

Si le point est exprimé dans le repère caméra gauche, il ne faut pas repasser par le rover si la matrice monde de la caméra gauche est déjà disponible.

Sinon :

```text
P_world = T_world_rover * T_rover_leftCamera * P_camera
```

Structure recommandée :

```ts
type WorldPoint = {
  positionWorld: Vec3;
  color: Vec3;
  confidence: number;
  frameId: number;
};
```

---

## 6.9 Accumulation progressive

Ne pas conserver naïvement tous les points de toutes les frames. Le nombre de points explose très vite.

Utiliser une carte de voxels.

Principe :

```text
voxelKey = floor(x / voxelSize), floor(y / voxelSize), floor(z / voxelSize)
```

Chaque voxel conserve :

- une position moyenne ;
- une couleur moyenne ;
- un nombre d’observations ;
- une confiance moyenne ;
- éventuellement la dernière date d’observation.

Structure :

```ts
type VoxelKey = string;

type VoxelCell = {
  positionSum: Vec3;
  colorSum: Vec3;
  confidenceSum: number;
  observationCount: number;
  lastFrameId: number;
};

type VoxelMap = Map<VoxelKey, VoxelCell>;
```

Insertion :

```ts
function integratePoint(map: VoxelMap, point: WorldPoint, voxelSize: number): void {
  const key = computeVoxelKey(point.positionWorld, voxelSize);
  const cell = map.get(key);

  if (!cell) {
    map.set(key, {
      positionSum: point.positionWorld,
      colorSum: point.color,
      confidenceSum: point.confidence,
      observationCount: 1,
      lastFrameId: point.frameId
    });
    return;
  }

  cell.positionSum = add(cell.positionSum, point.positionWorld);
  cell.colorSum = add(cell.colorSum, point.color);
  cell.confidenceSum += point.confidence;
  cell.observationCount += 1;
  cell.lastFrameId = point.frameId;
}
```

Pour l’affichage :

```ts
position = positionSum / observationCount
color = colorSum / observationCount
confidence = confidenceSum / observationCount
```

Paramètre de départ :

```ts
const voxelSize = 0.05; // 5 cm si l'unité monde est le mètre
```

---

## 6.10 Sélection des keyframes

Il ne faut pas intégrer toutes les frames. Il faut intégrer uniquement des keyframes.

Critères simples :

```text
nouvelle keyframe si :
  translation du rover > 0.10 m
  OU rotation du rover > 5°
  OU temps depuis dernière keyframe > 500 ms
```

Exemple :

```ts
type KeyframePolicy = {
  minTranslation: number;
  minRotationDegrees: number;
  minElapsedMs: number;
};
```

Valeurs de départ :

```ts
const keyframePolicy: KeyframePolicy = {
  minTranslation: 0.10,
  minRotationDegrees: 5,
  minElapsedMs: 500
};
```

---

## 7. Architecture logicielle proposée

## 7.1 Découpage des modules

Structure de dossiers suggérée :

```text
src/
  rover/
    RoverController.ts
    RoverCameraRig.ts
    RoverMode.ts

  reconstruction/
    StereoCalibration.ts
    StereoFrameCapture.ts
    StereoPreprocessor.ts
    StereoDisparity.ts
    DepthReprojection.ts
    PointCloudBuilder.ts
    VoxelMap.ts
    KeyframeSelector.ts
    ReconstructionPipeline.ts

  rendering/
    PointCloudRenderer.ts
    DebugTextureRenderer.ts
    ReconstructionDebugPanel.ts

  math/
    Matrix4.ts
    Vec3.ts
    CameraIntrinsics.ts
```

Si la partie computer vision est en Rust/WASM :

```text
rust/
  stereo_reconstruction/
    src/
      lib.rs
      calibration.rs
      preprocessing.rs
      block_matching.rs
      depth.rs
      point_cloud.rs
      voxel_map.rs
```

---

## 7.2 Interfaces TypeScript recommandées

### Calibration

```ts
export type CameraIntrinsics = {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
};

export type StereoCalibration = {
  left: CameraIntrinsics;
  right: CameraIntrinsics;
  baseline: number;
  leftToRight?: Matrix4;
  isRectified: boolean;
};
```

### Frame stéréo

```ts
export type StereoFrame = {
  frameId: number;
  timestamp: number;
  leftImage: ImageData;
  rightImage: ImageData;
  leftCameraWorld: Matrix4;
  rightCameraWorld: Matrix4;
  calibration: StereoCalibration;
};
```

### Disparité

```ts
export type DisparityMap = {
  width: number;
  height: number;
  data: Float32Array;
  minDisparity: number;
  maxDisparity: number;
};
```

### Carte de profondeur

```ts
export type DepthMap = {
  width: number;
  height: number;
  data: Float32Array;
};
```

### Nuage de points

```ts
export type PointCloud = {
  positions: Float32Array; // x,y,z,x,y,z...
  colors: Uint8Array;     // r,g,b,r,g,b...
  confidence?: Float32Array;
  count: number;
};
```

---

## 8. Pseudo-code complet de la pipeline

```ts
class ReconstructionPipeline {
  constructor(
    private readonly capture: StereoFrameCapture,
    private readonly preprocessor: StereoPreprocessor,
    private readonly disparityEstimator: StereoDisparityEstimator,
    private readonly pointCloudBuilder: PointCloudBuilder,
    private readonly voxelMap: VoxelMap,
    private readonly keyframeSelector: KeyframeSelector
  ) {}

  update(): void {
    const frame = this.capture.captureCurrentStereoFrame();

    if (!this.keyframeSelector.shouldAccept(frame)) {
      return;
    }

    const pair = this.preprocessor.preprocess(frame);

    const disparity = this.disparityEstimator.compute(pair.leftGray, pair.rightGray, {
      width: pair.width,
      height: pair.height,
      calibration: frame.calibration
    });

    const localCloud = this.pointCloudBuilder.fromDisparity({
      disparity,
      leftImage: frame.leftImage,
      calibration: frame.calibration,
      sampleStep: 4,
      minDepth: 0.2,
      maxDepth: 20.0
    });

    const worldCloud = transformPointCloud(localCloud, frame.leftCameraWorld);

    this.voxelMap.integrate(worldCloud);

    this.keyframeSelector.markAccepted(frame);
  }
}
```

---

## 9. Implémentation de départ sans OpenCV

Si vous ne voulez pas intégrer OpenCV dès le départ, vous pouvez implémenter un block matching simple.

### Principe

Pour chaque pixel de l’image gauche :

1. prendre une fenêtre carrée autour du pixel ;
2. chercher la fenêtre la plus similaire dans l’image droite ;
3. limiter la recherche aux pixels situés sur la même ligne ;
4. retourner la disparité qui minimise l’erreur.

### Pseudo-code

```ts
function computeDisparitySAD(
  left: Uint8Array,
  right: Uint8Array,
  width: number,
  height: number,
  maxDisparity: number,
  blockRadius: number
): Float32Array {
  const disparity = new Float32Array(width * height);

  for (let y = blockRadius; y < height - blockRadius; y++) {
    for (let x = blockRadius + maxDisparity; x < width - blockRadius; x++) {
      let bestD = 0;
      let bestCost = Number.POSITIVE_INFINITY;

      for (let d = 0; d < maxDisparity; d++) {
        let cost = 0;

        for (let wy = -blockRadius; wy <= blockRadius; wy++) {
          for (let wx = -blockRadius; wx <= blockRadius; wx++) {
            const leftValue = left[(y + wy) * width + (x + wx)];
            const rightValue = right[(y + wy) * width + (x + wx - d)];
            cost += Math.abs(leftValue - rightValue);
          }
        }

        if (cost < bestCost) {
          bestCost = cost;
          bestD = d;
        }
      }

      disparity[y * width + x] = bestD;
    }
  }

  return disparity;
}
```

Cette version est volontairement simple. Elle permettra de valider :

- la capture gauche/droite ;
- la baseline ;
- la formule de profondeur ;
- la transformation en points 3D ;
- l’accumulation dans le monde.

Ensuite, il faudra probablement remplacer cette méthode par SGBM.

---

## 10. Implémentation avec OpenCV / OpenCV.js

Si vous utilisez OpenCV.js ou une compilation WASM d’OpenCV, la partie disparité peut être déléguée à `StereoBM` ou `StereoSGBM`.

Pipeline OpenCV typique :

```text
ImageData gauche/droite
  → cv.Mat RGBA
  → cv.cvtColor(..., COLOR_RGBA2GRAY)
  → cv.StereoSGBM.create(...)
  → matcher.compute(leftGray, rightGray, disparity16)
  → disparity32 = disparity16 / 16.0
  → reprojectImageTo3D ou conversion manuelle
```

Attention : selon l’environnement OpenCV.js utilisé, toutes les classes ne sont pas nécessairement exposées. Il peut être nécessaire de construire une version personnalisée d’OpenCV.js avec les modules nécessaires.

### Recommandation d’intégration

Pour éviter de bloquer le rendu WebGL/WebGPU :

- exécuter la reconstruction dans un Web Worker ;
- envoyer les images via `ImageBitmap`, `ImageData` ou buffers transférables ;
- limiter la fréquence de reconstruction à 2–5 Hz au début ;
- afficher le dernier nuage de points disponible dans la scène principale.

---

## 11. Visualisation et debug

Il faut absolument prévoir des vues de debug. Sans cela, le projet sera difficile à corriger.

### Vues recommandées

1. image caméra gauche ;
2. image caméra droite ;
3. image gauche rectifiée ;
4. image droite rectifiée ;
5. carte de disparité brute ;
6. carte de disparité filtrée ;
7. carte de profondeur ;
8. nuage de points de la frame courante ;
9. nuage de points accumulé ;
10. voxels retenus ;
11. pose du rover et frustums des caméras.

### Debug de la rectification

Afficher des lignes horizontales superposées aux deux images. Si les caméras sont bien rectifiées, un même point physique doit se trouver sur la même ligne horizontale dans les deux images.

### Debug de la profondeur

Placer dans la scène des objets à distance connue :

- plan à 1 m ;
- cube à 2 m ;
- mur à 5 m.

Comparer la profondeur reconstruite avec la profondeur attendue.

---

## 12. Scénario de validation minimal

Créer une scène de test contrôlée :

```text
- sol texturé
- mur texturé à 5 m
- cube texturé à 2 m
- sphère texturée à 3 m
- éclairage stable
- pas de transparence
- pas de reflets
```

Configurer le rover :

```text
baseline = 0.20 m
résolution = 640 x 480
FOV vertical = 60°
sampleStep = 4
voxelSize = 0.05 m
```

Tests à réaliser :

1. Le cube à 2 m est-il reconstruit autour de 2 m ?
2. Le mur à 5 m est-il reconstruit autour de 5 m ?
3. Le nuage de points se place-t-il correctement dans le monde ?
4. Le nuage reste-t-il stable quand le rover avance ?
5. Les nouvelles observations enrichissent-elles la carte au lieu de créer des doubles fantômes ?
6. Les points incohérents sont-ils filtrés ?

---

## 13. Gestion des erreurs fréquentes

### Problème : la carte de disparité est presque noire

Causes possibles :

- baseline trop faible ;
- objets trop loin ;
- `numDisparities` trop faible ;
- images non texturées ;
- images gauche/droite inversées ;
- caméras non synchronisées.

### Problème : profondeur complètement fausse

Causes possibles :

- mauvaise focale en pixels ;
- baseline dans une mauvaise unité ;
- confusion FOV horizontal / vertical ;
- disparité non divisée par 16 si sortie OpenCV en entier fixé ;
- mauvaise convention d’axe.

### Problème : nuage miroir ou inversé

Causes possibles :

- axe X inversé ;
- axe Y image non converti ;
- matrice caméra monde utilisée à l’envers ;
- confusion entre matrice view et matrice world.

### Problème : beaucoup de bruit autour des contours

Causes possibles :

- occlusions entre caméra gauche et droite ;
- block size trop petit ;
- filtrage insuffisant ;
- surfaces fines ;
- discontinuités de profondeur.

### Problème : doubles surfaces dans la reconstruction accumulée

Causes possibles :

- poses non synchronisées avec les images ;
- erreur dans la transformation caméra → monde ;
- voxel trop petit ;
- points trop bruités ;
- intégration de trop de frames quasi identiques.

---

## 14. Améliorations progressives

## 14.1 Étape 1 — Prototype dense simple

Objectif :

- calculer une carte de disparité ;
- générer un nuage local ;
- afficher ce nuage dans la scène.

Pas encore d’accumulation.

## 14.2 Étape 2 — Accumulation avec pose connue

Objectif :

- transformer chaque nuage local dans le monde ;
- intégrer les points dans une voxel map ;
- afficher le nuage accumulé.

## 14.3 Étape 3 — Filtrage avancé

Ajouter :

- filtrage profondeur min/max ;
- suppression des speckles ;
- sous-échantillonnage ;
- left-right consistency check ;
- pondération par confiance ;
- seuil sur le nombre minimal d’observations par voxel.

## 14.4 Étape 4 — Surface reconstruction simple

À partir du voxel map :

- soit garder un nuage de points ;
- soit générer des splats ;
- soit générer un mesh approximatif ;
- soit exporter vers PLY/OBJ pour traitement externe.

Pour un prototype Web, le nuage de points est largement suffisant.

## 14.5 Étape 5 — Reconstruction volumétrique TSDF

La TSDF fusionne des cartes de profondeur successives dans un volume 3D. C’est plus propre qu’un simple nuage de points, mais plus complexe.

À envisager plus tard si :

- la reconstruction par points fonctionne ;
- la pose est stable ;
- la performance est acceptable ;
- vous voulez obtenir une surface plus continue.

## 14.6 Étape 6 — Visual odometry / SLAM

À envisager uniquement si vous voulez que le rover n’utilise plus la pose fournie par le moteur 3D.

Dans ce cas, il faut estimer la pose entre frames via :

- détection de features ;
- matching temporel ;
- triangulation ;
- PnP + RANSAC ;
- optimisation locale ;
- boucle de fermeture éventuelle.

C’est nettement plus complexe et pas nécessaire pour le premier objectif.

---

## 15. Comparaison des méthodes possibles

| Méthode | Utilité | Complexité | Qualité | Recommandation |
|---|---:|---:|---:|---|
| Block Matching maison | Prototype pédagogique | Faible | Faible à moyenne | Bien pour valider la chaîne |
| OpenCV StereoBM | Disparité rapide | Faible | Moyenne | Correct pour commencer |
| OpenCV StereoSGBM | Disparité dense robuste | Moyenne | Bonne | Recommandé |
| Feature matching + triangulation | Carte sparse | Moyenne | Sparse | Utile pour debug ou odométrie |
| ORB-SLAM3 | SLAM complet | Élevée | Très bonne pose, carte sparse | Trop lourd pour le début |
| RTAB-Map | Robotique / ROS / mapping | Élevée | Bonne | Pertinent hors viewer web |
| COLMAP | Reconstruction offline | Élevée | Très bonne | Très utile comme référence offline |
| OpenMVS | Dense cloud / mesh / texture | Élevée | Très bonne | Utile après export offline |
| TSDF / KinectFusion-like | Fusion dense temps réel | Élevée | Bonne surface | Étape avancée |

---

## 16. Choix recommandé pour votre cas

### Court terme

Implémenter :

```text
Stereo pair → disparity → depth → point cloud → world transform → voxel map
```

Avec :

- caméras parallèles ;
- baseline connue ;
- pose moteur connue ;
- block matching simple ou SGBM ;
- nuage de points affiché directement.

### Moyen terme

Ajouter :

- OpenCV StereoSGBM ;
- filtrage WLS si disponible ;
- keyframes ;
- voxel map robuste ;
- export PLY ;
- panneau de debug.

### Long terme

Explorer :

- TSDF ;
- mesh reconstruction ;
- pipeline offline COLMAP/OpenMVS ;
- visual odometry si pose moteur indisponible ;
- SLAM si vous voulez un comportement robotique plus réaliste.

---

## 17. Exemple de tâches à donner à GitHub Copilot

### Tâche 1 — Créer les types de calibration stéréo

Créer les fichiers :

```text
src/reconstruction/StereoCalibration.ts
src/math/CameraIntrinsics.ts
```

Implémenter :

- `CameraIntrinsics`
- `StereoCalibration`
- fonction `intrinsicsFromPerspectiveCamera(...)`
- calcul de `fx`, `fy`, `cx`, `cy` depuis FOV, résolution et aspect ratio.

Critères d’acceptation :

- les focales sont en pixels ;
- le centre optique est au centre de l’image ;
- les unités sont documentées.

---

### Tâche 2 — Capturer une paire d’images synchronisée

Créer :

```text
src/reconstruction/StereoFrameCapture.ts
```

Implémenter :

- rendu caméra gauche vers render target ;
- rendu caméra droite vers render target ;
- extraction `ImageData` ;
- stockage des matrices monde des deux caméras ;
- `frameId` incrémental.

Critères d’acceptation :

- les images gauche/droite ont même résolution ;
- les poses correspondent au même instant ;
- un panneau debug permet d’afficher les deux images.

---

### Tâche 3 — Prétraitement grayscale

Créer :

```text
src/reconstruction/StereoPreprocessor.ts
```

Implémenter :

- conversion RGBA vers grayscale ;
- option de downscale ;
- option de blur simple ;
- retour de buffers `Uint8Array`.

Critères d’acceptation :

- sortie stable ;
- aucune allocation excessive par frame ;
- possibilité de réutiliser les buffers.

---

### Tâche 4 — Disparité simple SAD

Créer :

```text
src/reconstruction/StereoDisparitySAD.ts
```

Implémenter :

- block matching SAD ;
- paramètres `maxDisparity`, `blockRadius`, `step`;
- retour `Float32Array`.

Critères d’acceptation :

- fonctionne sur une scène simple texturée ;
- produit une carte de disparité visualisable ;
- ne bloque pas le rendu principal si exécuté en worker.

---

### Tâche 5 — Reprojection en nuage de points

Créer :

```text
src/reconstruction/DepthReprojection.ts
src/reconstruction/PointCloudBuilder.ts
```

Implémenter :

- conversion disparité → profondeur ;
- conversion pixel → point caméra ;
- filtrage minDepth/maxDepth ;
- colorisation depuis image gauche ;
- sous-échantillonnage.

Critères d’acceptation :

- un plan à distance connue est reconstruit à une distance cohérente ;
- les points invalides sont ignorés ;
- le résultat peut être affiché dans le viewer.

---

### Tâche 6 — Transformation monde

Créer :

```text
src/reconstruction/PointCloudTransform.ts
```

Implémenter :

- transformation des points caméra vers monde ;
- gestion explicite des conventions d’axes ;
- tests avec une matrice identité, translation simple, rotation simple.

Critères d’acceptation :

- pas d’inversion miroir ;
- les points suivent correctement le rover ;
- le nuage local se place au bon endroit dans la scène globale.

---

### Tâche 7 — Voxel map

Créer :

```text
src/reconstruction/VoxelMap.ts
```

Implémenter :

- calcul de clé voxel ;
- intégration de points ;
- moyenne position/couleur/confiance ;
- extraction d’un nuage affichable ;
- seuil minimal d’observations.

Critères d’acceptation :

- le nombre de points reste borné ;
- les surfaces se stabilisent au fil des observations ;
- les points isolés peuvent être masqués.

---

### Tâche 8 — Keyframe selector

Créer :

```text
src/reconstruction/KeyframeSelector.ts
```

Implémenter :

- seuil de translation ;
- seuil de rotation ;
- seuil de temps ;
- décision `shouldAccept(frame)`.

Critères d’acceptation :

- le système n’intègre pas toutes les frames ;
- la reconstruction progresse quand le rover bouge ;
- les performances restent stables.

---

### Tâche 9 — Debug panel

Créer :

```text
src/rendering/ReconstructionDebugPanel.ts
```

Afficher :

- paramètres stéréo ;
- nombre de points frame courante ;
- nombre de voxels ;
- nombre de keyframes ;
- min/max profondeur ;
- toggle des vues debug.

Critères d’acceptation :

- possibilité de visualiser la disparité ;
- possibilité de visualiser la profondeur ;
- possibilité d’activer/désactiver le nuage accumulé.

---

## 18. Paramètres de départ recommandés

```ts
export const defaultReconstructionSettings = {
  imageWidth: 640,
  imageHeight: 480,

  baseline: 0.20,

  minDepth: 0.30,
  maxDepth: 15.0,

  maxDisparity: 128,
  blockRadius: 3,
  sampleStep: 4,

  voxelSize: 0.05,
  minVoxelObservations: 2,

  keyframeMinTranslation: 0.10,
  keyframeMinRotationDegrees: 5,
  keyframeMinElapsedMs: 500
};
```

---

## 19. Critères de réussite du MVP

Le MVP est réussi si :

1. le rover capture correctement deux images gauche/droite ;
2. une carte de disparité est visible ;
3. les objets proches ont une disparité plus forte que les objets lointains ;
4. la carte de profondeur donne des valeurs cohérentes ;
5. un nuage de points local est généré ;
6. le nuage est transformé correctement dans le monde ;
7. les points s’accumulent progressivement quand le rover avance ;
8. le nombre de points reste maîtrisé grâce au voxel map ;
9. une scène simple peut être reconstruite de façon reconnaissable.

---

## 20. Points d’attention spécifiques à un viewer 3D

### Textures

La stéréo passive a besoin de texture. Une surface blanche uniforme sera mal reconstruite.

Pour tester, utiliser :

- damiers ;
- bruit léger ;
- matériaux texturés ;
- contours nets ;
- objets avec détails.

### Lumière

Éviter au début :

- reflets forts ;
- transparence ;
- surfaces métalliques ;
- ombres très marquées ;
- effets post-processing différents entre les deux caméras.

### Post-processing

Les deux caméras doivent avoir exactement les mêmes effets visuels. Une différence de tone mapping, d’exposition ou d’anti-aliasing peut perturber la correspondance.

### Résolution

Commencer bas :

```text
320 x 240
```

Puis monter :

```text
640 x 480
```

Éviter le 1080p au début.

### Performance

La reconstruction ne doit pas tourner à 60 FPS. Elle peut tourner à 2–5 FPS au début.

Le viewer peut rester fluide en affichant le dernier résultat connu.

---

## 21. Références utiles

### OpenCV

- Camera calibration and 3D reconstruction: https://docs.opencv.org/4.x/
- `stereoRectify`
- `reprojectImageTo3D`
- `StereoBM`
- `StereoSGBM`
- `ximgproc::DisparityWLSFilter`

### Intel RealSense — Depth from Stereo

- https://github.com/IntelRealSense/librealsense/blob/master/doc/depth-from-stereo.md

### ORB-SLAM3

- https://github.com/UZ-SLAMLab/ORB_SLAM3

### RTAB-Map

- https://introlab.github.io/rtabmap/
- https://arxiv.org/abs/2403.06341

### COLMAP

- https://colmap.github.io/
- https://github.com/colmap/colmap

### OpenMVS

- https://github.com/cdcseacave/openMVS
- https://cdcseacave.github.io/openMVS/

### KinectFusion / TSDF

- KinectFusion paper: Real-Time Dense Surface Mapping and Tracking
- TSDF volumetric fusion as an advanced option for later stages

### Datasets de validation

- Middlebury Stereo Dataset: https://vision.middlebury.edu/stereo/
- KITTI Vision Benchmark Suite: https://www.cvlibs.net/datasets/kitti/

---

## 22. Conclusion

La bonne stratégie est de séparer clairement deux problèmes :

1. reconstruire de la profondeur à partir d’une paire stéréo ;
2. accumuler cette profondeur dans le monde au fil du déplacement.

Dans votre contexte, le deuxième problème est fortement simplifié par le fait que le viewer connaît la pose exacte du rover. Il faut donc éviter de commencer par du SLAM complet.

La trajectoire recommandée est :

```text
Prototype pédagogique SAD
  → remplacement par StereoSGBM
  → filtrage
  → voxel map
  → keyframes
  → export point cloud
  → éventuellement TSDF ou mesh
```

Cette approche est réaliste, progressive et suffisamment scientifique pour éviter de bricoler une méthode qui ne fonctionne pas.
