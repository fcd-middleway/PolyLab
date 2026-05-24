# Audit opérationnel — Génération procédurale de terrain crédible

## 1. Objectif du document

Ce document synthétise les principales idées issues du domaine de la génération procédurale de terrain et de la modélisation numérique de paysages, avec un angle volontairement opérationnel.

L’objectif n’est pas de produire un plan d’implémentation détaillé, mais de donner à un agent de développement, par exemple GitHub Copilot, une compréhension claire de ce qu’il est raisonnable de viser dans un projet normal :

- générer un terrain crédible ;
- gérer plusieurs types de matériaux ;
- produire des couches exploitables pour le rendu ;
- ajouter des mécanismes d’érosion simples mais efficaces ;
- garder une architecture progressive, testable et extensible ;
- éviter de partir directement vers des approches de recherche trop lourdes.

Le document part du principe que le projet vise une génération de terrain pour un viewer ou un moteur 3D custom, probablement avec une logique temps réel ou semi temps réel, et non un outil offline ultra-spécialisé de type logiciel professionnel de world building.

---

## 2. Synthèse exécutive

La stratégie recommandée est de ne pas commencer par une simulation géologique complète. Il faut plutôt combiner :

1. une représentation simple du terrain, idéalement une heightmap ;
2. plusieurs cartes scalaires intermédiaires : hauteur, pente, humidité, température, flux d’eau, sédiment, dureté ;
3. un générateur de relief de base par bruit procédural multi-échelle ;
4. des contraintes macro : montagnes, plaines, vallées, côtes, plateaux ;
5. une ou deux passes d’érosion simples ;
6. un système de matériaux basé sur des weight maps ou splat maps ;
7. un rendu chunké avec niveau de détail si le terrain devient grand.

Pipeline recommandé :

```text
Seed
  ↓
Cartes macro : continents / régions / montagnes / bassins
  ↓
Heightmap initiale : bruit cohérent + ridges + warping + contraintes
  ↓
Hydrologie simple : flow direction + flow accumulation + rivières
  ↓
Érosion : thermique + hydraulique simplifiée
  ↓
Cartes dérivées : slope / curvature / wetness / sediment / exposure
  ↓
Classification matériaux : roche / herbe / sable / neige / boue / gravier
  ↓
Weight maps de matériaux
  ↓
Mesh terrain + normals + rendu
  ↓
Décoration procédurale : végétation, rochers, détails
```

Ce qui est raisonnable à implémenter :

- génération heightmap déterministe par seed ;
- bruit Perlin/Simplex/OpenSimplex/fBm ;
- ridged noise pour les chaînes montagneuses ;
- domain warping pour casser les artefacts réguliers ;
- terracing pour plateaux et reliefs stratifiés ;
- érosion thermique simple ;
- érosion hydraulique de type particules ;
- flow accumulation pour rivières ;
- classification de matériaux par hauteur, pente, humidité et sédiment ;
- splat maps multi-matériaux ;
- chunking terrain ;
- debug des cartes intermédiaires.

Ce qui est possible mais plus avancé :

- simulation hydraulique grid-based avec shallow water ;
- stream power law ;
- tectonic uplift ;
- génération de bassins versants très cohérents ;
- volumetric terrain par density field ;
- marching cubes pour grottes et surplombs ;
- LOD avancé type geometry clipmaps ou CDLOD ;
- génération par apprentissage ou style transfer.

Ce qui est déconseillé au début :

- simuler une géologie complète ;
- gérer directement des terrains avec grottes, overhangs et volumes 3D ;
- générer des matériaux PBR complexes avant d’avoir de bonnes cartes de poids ;
- implémenter une érosion physiquement complète ;
- viser une infinité de biomes avant d’avoir un terrain de base crédible.

---

## 3. Audit rapide de l’état de l’art

La littérature classe globalement la modélisation de terrain en trois familles :

1. méthodes procédurales ;
2. simulations physiquement inspirées, notamment érosion et formation de reliefs ;
3. méthodes basées sur des exemples réels, comme des données DEM ou des heightmaps scannées.

Pour un projet personnel ou un prototype avancé, la combinaison la plus efficace est généralement :

```text
procédural contrôlé + érosion simplifiée + matériaux dérivés des cartes physiques
```

Cela permet d’obtenir une bonne crédibilité visuelle sans reproduire toute la complexité des modèles géomorphologiques.

---

## 4. Représentations possibles du terrain

## 4.1 Heightmap

Une heightmap représente le terrain comme une fonction :

```text
height = f(x, z)
```

Chaque position horizontale a une seule hauteur.

Avantages :

- simple ;
- rapide ;
- très bien adaptée au rendu temps réel ;
- facile à chunker ;
- facile à modifier par érosion ;
- facile à exporter ;
- compatible avec des matériaux par weight maps ;
- très bonne base pour un projet raisonnable.

Limites :

- pas de grottes ;
- pas de surplombs ;
- pas de falaises retournées ;
- pas de tunnels naturels en vraie géométrie ;
- forme 2.5D plutôt que 3D complète.

Recommandation :

> Utiliser la heightmap comme représentation principale du premier prototype.

Même beaucoup de moteurs de jeu et d’outils de terrain utilisent cette approche comme cœur de représentation.

---

## 4.2 Density field / voxel / SDF

Un density field représente le terrain par une fonction dans l’espace :

```text
density = f(x, y, z)
```

La surface est extraite là où la densité vaut zéro.

Avantages :

- permet grottes ;
- permet surplombs ;
- permet arches naturelles ;
- permet des volumes plus organiques ;
- peut être polygonisé par marching cubes.

Limites :

- plus coûteux ;
- structure de données plus complexe ;
- rendu et collision plus difficiles ;
- matériaux plus compliqués ;
- érosion plus difficile à appliquer de manière intuitive.

Recommandation :

> À garder comme option future, pas comme base du premier système.

Une architecture peut prévoir une abstraction `TerrainRepresentation`, mais le premier moteur de génération doit rester heightmap.

---

## 4.3 Terrain hybride

Un compromis intéressant :

```text
heightmap principale
+ objets géologiques additionnels
+ meshes de falaises
+ grottes locales séparées
+ rochers procéduraux
```

Cela permet de garder la simplicité d’une heightmap tout en enrichissant visuellement le résultat.

Exemples :

- falaises générées comme meshes placés sur fortes pentes ;
- rochers instanciés sur zones exposées ;
- entrées de grottes comme assets ou meshes procéduraux ;
- arches ou formations spéciales comme objets additionnels.

Recommandation :

> C’est probablement le meilleur compromis long terme pour un viewer/générateur normal.

---

## 5. Relief de base par bruit procédural

## 5.1 Bruit cohérent

Les bruits cohérents, comme Perlin, Simplex ou OpenSimplex, sont la base classique de nombreux terrains procéduraux.

Ils permettent de produire une fonction continue :

```text
noise(x, z) → valeur entre -1 et 1
```

Mais un seul bruit produit rarement un terrain convaincant. Il faut combiner plusieurs échelles.

---

## 5.2 fBm — fractal Brownian motion

Le fBm additionne plusieurs octaves de bruit :

```text
height = noise(x, z)
       + 0.5 * noise(2x, 2z)
       + 0.25 * noise(4x, 4z)
       + ...
```

Paramètres importants :

- `frequency` : taille des formes ;
- `amplitude` : intensité verticale ;
- `octaves` : nombre de niveaux de détail ;
- `lacunarity` : multiplication de fréquence entre octaves ;
- `persistence` : baisse d’amplitude entre octaves.

Usage :

- collines ;
- relief général ;
- variations fines ;
- micro-détails.

Limite :

> Le fBm seul donne souvent un terrain “bruité” mais pas géologiquement crédible.

Il faut ajouter des contraintes et des cartes macro.

---

## 5.3 Ridged noise

Le ridged noise transforme le bruit pour produire des crêtes :

```text
ridge = 1 - abs(noise(x, z))
ridge = ridge * ridge
```

Usage :

- montagnes ;
- chaînes de crêtes ;
- falaises ;
- reliefs cassants.

Recommandation :

> Utiliser le ridged noise pour la structure montagneuse, mais le limiter par des masques macro.

---

## 5.4 Domain warping

Le domain warping déforme les coordonnées avant d’évaluer le bruit :

```text
warpX = noise(x * f, z * f)
warpZ = noise(x * f + offset, z * f + offset)
height = noise(x + warpX * strength, z + warpZ * strength)
```

Intérêt :

- casse l’aspect trop régulier ;
- donne des vallées plus organiques ;
- évite les motifs répétitifs ;
- améliore fortement la crédibilité visuelle.

Recommandation :

> Ajouter tôt le domain warping, mais avec un paramètre contrôlable.

---

## 5.5 Terracing

Le terracing crée des paliers :

```text
height = quantize(height, terraceCount)
height = smoothBetweenTerraces(height)
```

Usage :

- plateaux ;
- canyons ;
- reliefs stratifiés ;
- style low-poly ou stylisé ;
- formations rocheuses.

Recommandation :

> À intégrer comme effet optionnel, contrôlé par un masque de biome ou de région.

---

## 5.6 Cartes macro

Un terrain crédible ne doit pas être uniquement du bruit local. Il faut des cartes macro.

Exemples :

```text
mountainMask(x,z)
continentMask(x,z)
plainMask(x,z)
basinMask(x,z)
coastDistance(x,z)
```

Ces cartes contrôlent où les familles de reliefs apparaissent.

Exemple :

```text
height =
  continentMask * baseElevation
  + mountainMask * ridgedMountains
  + plainMask * lowFrequencyHills
  - basinMask * depression
```

Recommandation :

> Construire le terrain comme une combinaison de couches, pas comme une seule fonction de bruit.

---

## 6. Hydrologie

L’hydrologie est un des éléments qui rend un terrain crédible.

Même sans simuler l’eau physiquement, il est très utile de calculer :

- direction d’écoulement ;
- accumulation de flux ;
- bassins versants ;
- humidité ;
- zones de dépôt ;
- lits de rivières ;
- lacs potentiels.

---

## 6.1 Flow direction

Pour chaque cellule de la heightmap, on cherche le voisin le plus bas.

```text
flowDirection[cell] = lowestNeighbor(cell)
```

La méthode simple est appelée D8 dans les SIG : chaque cellule s’écoule vers un des 8 voisins.

Usage :

- calculer les rivières ;
- calculer l’accumulation ;
- détecter les bassins ;
- guider l’érosion.

---

## 6.2 Flow accumulation

L’accumulation représente la quantité de surface qui s’écoule vers une cellule.

```text
flowAccumulation[cell] = 1 + somme des cellules amont
```

Plus l’accumulation est élevée, plus la cellule est susceptible d’être un ruisseau, une rivière ou un fleuve.

Usage :

- générer des rivières ;
- creuser les vallées ;
- placer de la végétation ;
- augmenter l’humidité ;
- placer du limon, de la boue ou du sable.

---

## 6.3 Dépressions et lacs

Les heightmaps procédurales contiennent souvent des cuvettes fermées. Dans un vrai modèle hydrologique, il faut décider si elles deviennent :

- des lacs ;
- des marais ;
- des zones de dépôt ;
- ou si elles sont “remplies” pour permettre à l’eau de s’écouler.

Approches raisonnables :

1. garder les bassins comme lacs ;
2. appliquer une correction de type pit filling ;
3. creuser une sortie artificielle ;
4. faire un mélange selon la taille du bassin.

Recommandation :

> Pour un projet visuel, conserver certains bassins comme lacs est souvent plus intéressant que tout corriger.

---

## 6.4 Rivières procédurales

Pipeline simple :

```text
heightmap
  ↓
flow direction
  ↓
flow accumulation
  ↓
threshold rivière
  ↓
carving du lit de rivière
  ↓
wetness map
  ↓
matériaux associés
```

La rivière peut être représentée par :

- une simple ligne sur la heightmap ;
- un mesh ribbon ;
- une texture projetée ;
- une spline générée depuis le flow path ;
- un plan d’eau local.

Recommandation :

> Générer d’abord une carte rivière, puis seulement ensuite un rendu d’eau.

---

## 7. Érosion

L’érosion est utile pour transformer un terrain “bruité” en paysage crédible.

Il ne faut pas forcément chercher une simulation parfaite. Quelques passes bien choisies suffisent à améliorer fortement le rendu.

---

## 7.1 Érosion thermique

L’érosion thermique simule l’effondrement de matière sur les pentes trop fortes.

Principe :

```text
pour chaque cellule :
  comparer avec les voisins
  si la différence de hauteur dépasse un angle de talus :
    déplacer une partie de la matière vers les voisins plus bas
```

Effets visuels :

- adoucit les pentes irréalistes ;
- crée des talus ;
- stabilise les falaises ;
- réduit le bruit excessif ;
- produit des cônes de dépôt simples.

Paramètres :

```text
talusAngle
erosionStrength
iterationCount
```

Avantages :

- simple ;
- stable ;
- rapide ;
- facile à implémenter ;
- très utile dès le début.

Limites :

- ne génère pas de réseaux de rivières ;
- ne crée pas de vallées fluviales réalistes ;
- trop d’itérations peuvent lisser excessivement le terrain.

Recommandation :

> Première érosion à implémenter.

---

## 7.2 Érosion hydraulique par particules

L’érosion hydraulique par particules simule des gouttes d’eau.

Chaque particule a :

```text
position
velocity
water
sediment
direction
```

À chaque étape :

1. la particule suit la pente ;
2. elle érode si sa capacité de transport augmente ;
3. elle dépose si sa capacité diminue ;
4. elle perd de l’eau par évaporation ;
5. elle s’arrête après un nombre maximum de pas.

Effets visuels :

- creuse des rigoles ;
- crée des vallées ;
- dépose du sédiment ;
- rend le terrain beaucoup plus naturel.

Avantages :

- relativement simple ;
- très bon rapport qualité / complexité ;
- facile à exécuter offline ou en tâche de génération ;
- très populaire dans les projets personnels.

Limites :

- paramètres sensibles ;
- peut créer des artefacts si mal bornée ;
- pas trivial à paralléliser parfaitement ;
- demande un bon debug.

Paramètres typiques :

```text
dropletCount
maxLifetime
inertia
capacity
minSlope
depositRate
erodeRate
evaporateRate
gravity
```

Recommandation :

> C’est probablement le meilleur deuxième mécanisme d’érosion à implémenter après l’érosion thermique.

---

## 7.3 Érosion hydraulique grid-based

Une érosion grid-based simule l’eau sur chaque cellule.

État par cellule :

```text
height
water
sediment
flowOut
velocity
```

À chaque itération :

1. ajouter de la pluie ;
2. calculer les flux vers les voisins ;
3. déplacer l’eau ;
4. calculer capacité de transport ;
5. éroder ou déposer ;
6. déplacer les sédiments ;
7. évaporer l’eau.

Effets visuels :

- rivières plus cohérentes ;
- dépôts plus naturels ;
- simulation plus globale ;
- meilleure cohérence hydrologique.

Avantages :

- très bon potentiel ;
- parallélisable GPU ;
- proche des approches de recherche.

Limites :

- plus complexe ;
- plus de buffers ;
- plus difficile à stabiliser ;
- demande beaucoup de debug ;
- dépend fortement du pas de temps.

Recommandation :

> À envisager lorsque la version particulaire fonctionne.

---

## 7.4 Érosion fluviale et stream power

Les modèles fluviaux basés sur la stream power law cherchent à modéliser l’incision des rivières selon le flux et la pente.

Forme conceptuelle :

```text
erosion ∝ drainageArea^m * slope^n
```

Usage :

- grands paysages ;
- réseaux dendritiques ;
- bassins versants ;
- vallées cohérentes ;
- montagnes à grande échelle.

Avantages :

- cohérence géomorphologique ;
- contrôle à grande échelle ;
- très bon pour produire des vallées crédibles.

Limites :

- plus théorique ;
- demande de bons calculs hydrologiques ;
- moins immédiat qu’une érosion par particules ;
- peut être trop ambitieux pour un premier prototype.

Recommandation :

> À considérer comme inspiration ou évolution, pas comme MVP.

---

## 7.5 Érosion analytique récente

Certaines recherches récentes cherchent à combiner les avantages des méthodes procédurales et des méthodes physiquement fondées en rendant l’érosion plus directement contrôlable, sans milliers d’itérations.

Idée intéressante :

```text
temps géologique = paramètre contrôlable
```

Au lieu de simuler pas à pas l’histoire complète du paysage, on utilise un paramètre pour contrôler le vieillissement du terrain.

Recommandation :

> Très intéressant conceptuellement, mais probablement trop avancé pour le premier projet. À garder comme inspiration pour un futur mode “aging slider”.

---

## 8. Matériaux et couches

Le terrain doit être vu comme un ensemble de cartes superposées.

Il y a deux notions différentes :

1. les couches physiques du terrain ;
2. les couches de rendu ou matériaux.

Elles peuvent être liées, mais il ne faut pas les confondre.

---

## 8.1 Couches physiques

Couches physiques possibles :

```text
bedrockHeight
soilDepth
sedimentAmount
waterAmount
moisture
hardness
temperature
vegetationPotential
```

Ces cartes ne sont pas forcément affichées directement. Elles servent à décider :

- où le terrain s’érode ;
- où les matériaux apparaissent ;
- où les rivières passent ;
- où la végétation pousse ;
- où les rochers sont exposés.

Exemple :

```text
finalHeight = bedrockHeight + soilDepth + sedimentAmount
```

---

## 8.2 Matériaux de surface

Matériaux typiques :

```text
rock
grass
sand
snow
mud
gravel
soil
cliff
riverbed
underwater
```

Chaque matériau peut avoir :

```text
albedo
normal
roughness
height
ao
tilingScale
triplanarEnabled
```

Le moteur ne doit pas choisir un seul matériau par point. Il doit générer des poids.

---

## 8.3 Weight maps / splat maps

Une splat map est une texture où chaque canal représente le poids d’un matériau.

Exemple RGBA :

```text
R = grass
G = rock
B = sand
A = snow
```

Si plus de 4 matériaux sont nécessaires, utiliser plusieurs textures de poids.

Exemple :

```text
splat0.r = grass
splat0.g = rock
splat0.b = sand
splat0.a = snow

splat1.r = mud
splat1.g = gravel
splat1.b = riverbed
splat1.a = moss
```

Règle utile :

```text
somme des poids = 1.0
```

Avantages :

- rendu GPU efficace ;
- compatible avec les shaders terrain ;
- facile à visualiser ;
- facile à exporter ;
- permet les transitions progressives.

Recommandation :

> Utiliser les splat maps comme représentation principale des matériaux.

---

## 8.4 Classification simple des matériaux

Le poids des matériaux peut être calculé à partir des cartes dérivées.

Exemple :

```text
if height > snowLine and slope < maxSnowSlope:
  snow += ...
if slope > cliffSlope:
  rock += ...
if wetness > threshold and slope < smallSlope:
  mud += ...
if distanceToWater < threshold:
  sand += ...
if sediment > threshold:
  soil += ...
```

Mais il faut éviter les transitions dures. Utiliser des fonctions smoothstep.

```text
weight = smoothstep(min, max, value)
```

Exemple :

```text
rockWeight = smoothstep(0.55, 0.85, slope)
snowWeight = smoothstep(snowLine - 50, snowLine + 100, height)
mudWeight = smoothstep(0.4, 0.8, wetness)
```

Ensuite :

```text
normalizeWeights()
```

---

## 8.5 Matériaux guidés par l’érosion

Les cartes produites par l’érosion doivent influencer les matériaux.

Exemples :

- sédiments déposés → sable, boue, sol ;
- forte pente → roche exposée ;
- forte accumulation d’eau → lit de rivière ;
- humidité persistante → mousse, herbe dense ;
- zones lavées → gravier ;
- zones hautes et froides → neige.

C’est un point important : l’érosion ne doit pas seulement modifier la géométrie. Elle doit enrichir la lecture visuelle du terrain.

---

## 8.6 Height blending

Pour éviter que les matériaux se mélangent comme une simple interpolation floue, utiliser du height blending.

Principe :

- chaque texture de matériau possède une height map locale ;
- lors de la transition, la height map influence quel matériau passe au-dessus ;
- cela permet à la terre d’apparaître dans les creux de la roche, ou à la neige de s’accumuler dans les creux.

Effet :

- transitions plus naturelles ;
- rendu moins “peint” ;
- meilleure crédibilité sans modifier la géométrie.

Recommandation :

> Prévoir le système de poids dès le départ, puis ajouter le height blending dans le shader plus tard.

---

## 8.7 Triplanar mapping pour les falaises

Sur les pentes fortes, un mapping UV classique peut étirer les textures.

Le triplanar mapping projette la texture depuis plusieurs axes et mélange selon la normale.

Usage :

- falaises ;
- rochers ;
- surfaces verticales ;
- terrains sans UV explicites.

Recommandation :

> Utiliser le triplanar mapping uniquement pour certains matériaux, notamment roche/falaise.

---

## 9. Biomes

Un biome est une combinaison cohérente de :

- relief ;
- température ;
- humidité ;
- matériaux ;
- végétation ;
- objets ;
- couleur d’ambiance.

Exemples :

```text
forest
desert
alpine
snow
swamp
grassland
rocky
coastal
volcanic
```

---

## 9.1 Cartes de température et humidité

Créer deux cartes globales :

```text
temperature(x,z)
moisture(x,z)
```

La température peut dépendre de :

- latitude ;
- altitude ;
- bruit basse fréquence ;
- proximité de l’eau.

L’humidité peut dépendre de :

- proximité de l’eau ;
- flow accumulation ;
- altitude ;
- exposition ;
- bruit basse fréquence.

Ensuite, les biomes peuvent être déduits :

```text
biome = classify(temperature, moisture, height)
```

---

## 9.2 Mélange de biomes

Il faut éviter une classification dure.

Au lieu de :

```text
un point = un biome
```

utiliser :

```text
un point = poids de plusieurs biomes
```

Exemple :

```text
forestWeight = ...
grasslandWeight = ...
rockyWeight = ...
snowWeight = ...
```

Chaque biome fournit ensuite :

- ses matériaux ;
- ses paramètres de relief ;
- ses règles de végétation ;
- sa couleur ;
- ses objets.

---

## 9.3 Biome comme couche de contrôle, pas comme rendu direct

Le biome ne devrait pas être directement un matériau. Il doit influencer les cartes.

Exemple :

```text
desert biome → augmente sandWeight, baisse moisture, réduit vegetation
alpine biome → augmente rockWeight, snowWeight, slope contrast
swamp biome → augmente water, mud, vegetationDensity
```

Recommandation :

> Construire les biomes comme des ensembles de règles, pas comme de simples couleurs.

---

## 10. Décoration procédurale

Une fois le terrain et les matériaux générés, il devient possible de placer des détails.

Objets possibles :

- arbres ;
- herbe ;
- rochers ;
- buissons ;
- branches ;
- fleurs ;
- cailloux ;
- neige accumulée ;
- flaques ;
- troncs.

Critères de placement :

```text
height
slope
materialWeights
moisture
temperature
distanceToRiver
curvature
exposure
randomNoise
```

Exemple :

```text
placer des arbres si :
  grassWeight > 0.5
  slope < 0.35
  moisture entre 0.3 et 0.8
  temperature entre 0.2 et 0.9
  noise > threshold
```

Recommandation :

> Ne pas placer la décoration avant d’avoir stabilisé les matériaux. Les matériaux doivent guider la décoration, pas l’inverse.

---

## 11. Rendu du terrain

## 11.1 Mesh heightmap simple

Créer une grille :

```text
N x N vertices
2 triangles par cellule
y = heightmap[x,z]
```

Calculer :

- normales ;
- tangentes si nécessaire ;
- UV terrain ;
- poids matériaux ;
- LOD éventuel.

Pour un premier prototype :

```text
257 x 257 ou 513 x 513
```

---

## 11.2 Chunking

Pour les grands terrains, découper en chunks.

Exemple :

```text
terrain/
  chunks/
    chunk_0_0
    chunk_0_1
    chunk_1_0
```

Chaque chunk contient :

```text
height data
normal data
material weights
mesh buffer
bounds
dirty flag
```

Avantages :

- génération progressive ;
- rechargement local ;
- LOD ;
- culling ;
- streaming ;
- recalcul partiel.

---

## 11.3 LOD

Options de LOD :

1. pas de LOD au début ;
2. grille réduite par chunk selon la distance ;
3. quadtree ;
4. CDLOD ;
5. geometry clipmaps.

Recommandation :

> Commencer sans LOD ou avec un LOD très simple. Le LOD ne doit pas bloquer la génération.

Si le projet doit afficher de très grands terrains, CDLOD ou geometry clipmaps deviennent intéressants.

---

## 11.4 Normales

Les normales doivent être recalculées à partir de la heightmap.

Méthode simple :

```text
normal = normalize(cross(dHeight/dx, dHeight/dz))
```

Les normales sont importantes pour :

- éclairage ;
- pente ;
- classification matériau ;
- placement d’objets ;
- détection de falaises.

---

## 12. Données intermédiaires recommandées

Le cœur du système devrait produire plusieurs cartes.

```ts
type TerrainMaps = {
  height: Float32Array;
  baseHeight: Float32Array;
  slope: Float32Array;
  curvature: Float32Array;
  flowDirection: Int8Array;
  flowAccumulation: Float32Array;
  moisture: Float32Array;
  temperature: Float32Array;
  sediment: Float32Array;
  hardness: Float32Array;
  materialWeights: Float32Array;
};
```

Chaque carte doit être visualisable.

Debug obligatoire :

- heightmap ;
- slope ;
- flow accumulation ;
- moisture ;
- sediment ;
- material dominant ;
- material weights ;
- river mask ;
- erosion delta.

---

## 13. Modèle mental recommandé

Penser le terrain comme un système de données, pas comme un simple mesh.

```text
Terrain = cartes scalaires + règles + rendu
```

Le mesh est seulement une vue de ces cartes.

---

## 14. Architecture conceptuelle possible

```text
TerrainGenerator
  ├── MacroMapGenerator
  ├── NoiseHeightGenerator
  ├── HydrologyAnalyzer
  ├── ThermalErosion
  ├── HydraulicDropletErosion
  ├── TerrainDerivedMaps
  ├── MaterialClassifier
  ├── TerrainMeshBuilder
  ├── TerrainRenderer
  └── TerrainDebugView
```

Cette architecture n’est pas un plan strict, mais elle indique les responsabilités logiques à séparer.

---

## 15. Paramètres de génération à prévoir

```ts
type TerrainGenerationSettings = {
  seed: number;

  width: number;
  height: number;
  cellSize: number;
  verticalScale: number;

  baseFrequency: number;
  baseAmplitude: number;
  octaves: number;
  lacunarity: number;
  persistence: number;

  mountainStrength: number;
  ridgeStrength: number;
  warpStrength: number;

  thermalErosionIterations: number;
  thermalTalusAngle: number;
  thermalStrength: number;

  hydraulicDropletCount: number;
  hydraulicMaxLifetime: number;
  hydraulicErodeRate: number;
  hydraulicDepositRate: number;
  hydraulicEvaporationRate: number;

  riverThreshold: number;

  snowLine: number;
  cliffSlope: number;
  beachHeight: number;
};
```

---

## 16. Approches classées par difficulté

| Approche | Intérêt | Complexité | Recommandation |
|---|---:|---:|---|
| Heightmap + fBm | Base terrain | Faible | À faire |
| Ridged noise | Montagnes | Faible | À faire |
| Domain warping | Relief organique | Faible à moyenne | À faire |
| Cartes macro | Contrôle global | Moyenne | À faire |
| Érosion thermique | Stabilisation pentes | Faible | À faire |
| Érosion hydraulique par particules | Vallées/ravines | Moyenne | À faire |
| Flow accumulation | Rivières | Moyenne | À faire |
| Splat maps | Matériaux | Faible à moyenne | À faire |
| Height blending | Transitions réalistes | Moyenne | À faire plus tard |
| Triplanar mapping | Falaises | Moyenne | À faire plus tard |
| Grid hydraulic erosion | Simulation eau/sédiment | Élevée | Plus tard |
| Stream power law | Relief géologique | Élevée | Inspiration |
| Tectonic uplift | Grandes chaînes | Élevée | Inspiration |
| Density field + marching cubes | Grottes/surplombs | Élevée | Plus tard |
| Geometry clipmaps | Très grands terrains | Élevée | Plus tard |
| IA / GAN / style transfer | Terrain depuis exemples | Élevée | Non prioritaire |

---

## 17. Proposition de cible raisonnable

La cible réaliste du projet pourrait être :

```text
Un générateur déterministe de heightmap chunkée,
capable de produire un terrain crédible avec montagnes, plaines, rivières,
quelques effets d’érosion, et plusieurs matériaux mélangés via splat maps.
```

Ce résultat est déjà suffisamment ambitieux et démonstratif.

Fonctionnalités attendues :

- génération par seed ;
- taille configurable ;
- relief multi-échelle ;
- montagnes avec crêtes ;
- vallées ;
- érosion thermique ;
- érosion hydraulique par particules ;
- rivières ou lits de rivières ;
- matériaux : roche, herbe, sable, neige, boue, gravier ;
- cartes de debug ;
- export heightmap et splat maps ;
- rendu mesh dans le viewer ;
- possibilité de regénérer à partir des mêmes paramètres.

---

## 18. Ce que l’agent Copilot doit comprendre

Le projet ne doit pas être pensé comme :

```text
generateMesh()
```

Mais comme :

```text
generateTerrainData()
derivePhysicalMaps()
deriveMaterialMaps()
buildRenderableMesh()
```

La donnée centrale est la heightmap enrichie.

Le rendu n’est qu’une projection de cette donnée.

---

## 19. Invariants importants

## 19.1 Déterminisme

À seed identique et paramètres identiques :

```text
même terrain
mêmes matériaux
mêmes rivières
mêmes objets
```

Important pour debug, sauvegarde, tests et reproductibilité.

---

## 19.2 Visualisation des étapes

Chaque étape doit pouvoir être affichée :

- avant érosion ;
- après érosion ;
- delta d’érosion ;
- carte des pentes ;
- carte de flux ;
- carte des matériaux ;
- carte d’humidité.

Sans cela, les problèmes seront difficiles à diagnostiquer.

---

## 19.3 Séparation génération / rendu

La génération ne doit pas dépendre directement du renderer.

```text
TerrainData → TerrainMesh
TerrainData → TerrainMaterialMaps
TerrainData → DebugTextures
```

---

## 19.4 Unités cohérentes

Définir explicitement :

```text
1 cellule = combien de mètres ?
1 unité verticale = combien de mètres ?
taille du terrain ?
échelle des bruits ?
```

Les paramètres d’érosion et de pente deviennent incompréhensibles si les unités sont floues.

---

## 19.5 Éviter les transitions dures

Partout où une classification est faite, préférer :

```text
smoothstep
noise modulation
normalisation des poids
```

plutôt que des `if` binaires.

---

## 20. Idées à intégrer mais pas immédiatement

## 20.1 Stamps

Un stamp est une forme préconstruite appliquée au terrain :

- cratère ;
- montagne ;
- canyon ;
- vallée ;
- dune ;
- falaise.

Les stamps peuvent être :

- procéduraux ;
- dessinés ;
- importés depuis une heightmap ;
- combinés avec des masques.

C’est très utile pour donner un contrôle artistique.

---

## 20.2 Courbes de contrôle

Permettre à l’utilisateur de dessiner :

- une rivière ;
- une chaîne de montagnes ;
- une route ;
- une faille ;
- une côte.

Puis le système adapte le terrain autour.

Très utile pour rendre le générateur contrôlable.

---

## 20.3 Données réelles

Importer une vraie heightmap DEM peut servir :

- de référence ;
- de base de terrain ;
- de benchmark ;
- de source d’inspiration.

Il ne faut pas forcément commencer par là, mais c’est une bonne extension.

---

## 20.4 Style transfer / exemple-based

Des recherches récentes utilisent des exemples réels ou du style transfer pour rendre les terrains plus proches de paysages existants.

Intérêt :

- reproduire un style de relief ;
- s’inspirer de données réelles ;
- générer des terrains moins artificiels.

Limite :

- nécessite des datasets ;
- plus difficile à contrôler ;
- moins nécessaire pour un premier projet.

---

## 20.5 Érosion comme outil interactif

Au lieu d’appliquer une érosion fixe, exposer des paramètres :

```text
age
rainfall
rockHardness
sedimentTransport
thermalRelaxation
```

Cela permettrait un mode “vieillissement du terrain”.

---

## 21. Critères de qualité

Un terrain crédible doit avoir :

- des formes à plusieurs échelles ;
- des crêtes lisibles ;
- des vallées cohérentes ;
- peu de bruit inutile ;
- des matériaux liés à la géométrie ;
- des rivières qui suivent la pente ;
- des dépôts dans les zones basses ;
- de la roche sur les fortes pentes ;
- de la neige en altitude ;
- des transitions progressives.

---

## 22. Critères techniques de réussite

Le projet est sur une bonne trajectoire si :

1. les mêmes paramètres produisent toujours le même terrain ;
2. les cartes intermédiaires sont visualisables ;
3. l’érosion modifie réellement les pentes et vallées ;
4. les matériaux sont cohérents avec la géométrie ;
5. le terrain peut être généré à plusieurs résolutions ;
6. les performances restent acceptables ;
7. les chunks peuvent être régénérés indépendamment ;
8. le système peut exporter heightmap, normal map et splat maps.

---

## 23. Pièges classiques

## 23.1 Terrain trop bruité

Cause :

- trop d’octaves ;
- amplitude haute fréquence trop forte ;
- pas assez de cartes macro ;
- pas d’érosion.

Correction :

- réduire les hautes fréquences ;
- lisser certains masques ;
- ajouter thermal erosion ;
- séparer macro relief et micro relief.

---

## 23.2 Montagnes sans vallées

Cause :

- ridged noise utilisé seul ;
- pas de flow accumulation ;
- pas d’érosion hydraulique.

Correction :

- calculer rivières ;
- creuser les vallées ;
- ajouter domain warping ;
- utiliser des masques de bassins.

---

## 23.3 Matériaux incohérents

Cause :

- classification uniquement par hauteur ;
- pas de prise en compte de pente/humidité/sédiment.

Correction :

- roche = pente forte ;
- sable = proche eau ou sédiment ;
- neige = altitude + pente faible ;
- boue = humidité + faible pente ;
- herbe = humidité moyenne + pente faible.

---

## 23.4 Rivières impossibles

Cause :

- heightmap pleine de cuvettes ;
- pas de correction hydrologique ;
- seuil trop bas ou trop haut.

Correction :

- pit filling partiel ;
- garder certains bassins comme lacs ;
- lisser flow accumulation ;
- creuser les lits.

---

## 23.5 Rendu trop répétitif

Cause :

- textures trop visibles ;
- tiling évident ;
- matériaux trop uniformes.

Correction :

- variation de couleur par bruit ;
- triplanar mapping ;
- macro texture ;
- mélange de matériaux ;
- decals ou détails procéduraux.

---

## 24. Résumé pour Copilot

Le projet doit être compris comme une chaîne de génération de données terrain.

Le cœur du système est une heightmap enrichie par des cartes dérivées.

L’objectif n’est pas de générer une géologie scientifiquement exacte, mais un terrain visuellement crédible, déterministe, contrôlable et extensible.

Les idées principales à retenir :

- utiliser une heightmap pour commencer ;
- générer le relief par combinaison de bruits et de masques macro ;
- utiliser l’érosion thermique pour stabiliser les pentes ;
- utiliser l’érosion hydraulique par particules pour obtenir des ravines et vallées ;
- calculer flow direction et flow accumulation pour les rivières ;
- générer les matériaux par weight maps ;
- lier les matériaux à la géométrie et aux cartes physiques ;
- séparer strictement génération, données, rendu et debug ;
- exposer toutes les cartes intermédiaires.

---

## 25. Sources et références consultées

### Synthèses terrain

- Galin, Guérin, Peytavie, Cordonnier, Cani, Benes, Gain — *A Review of Digital Terrain Modeling*, Computer Graphics Forum, 2019.
  - URL : https://researchportal.ip-paris.fr/fr/publications/a-review-of-digital-terrain-modeling/
  - DOI : https://doi.org/10.1111/cgf.13657

### Bruit procédural

- Perlin — *Improving Noise*, ACM Transactions on Graphics, 2002.
  - DOI : https://doi.org/10.1145/566654.566636
- Ebert, Musgrave, Peachey, Perlin, Worley — *Texturing & Modeling: A Procedural Approach*.
  - URL : https://engineering.purdue.edu/~ebertd/book2e.html
- McEwan, Sheets, Gustavson, Richardson — *Efficient computational noise in GLSL*, 2012.
  - URL : https://arxiv.org/abs/1204.1461

### Érosion et formation de terrain

- Mei, Decaudin, Hu — *Fast Hydraulic Erosion Simulation and Visualization on GPU*, Pacific Graphics, 2007.
  - URL : https://cir.nii.ac.jp/crid/1360016868826599808
- Kelley, Malin, Nielson — *Terrain simulation using a model of stream erosion*, SIGGRAPH, 1988.
  - URL : https://cir.nii.ac.jp/crid/1362544420432987520
- Cordonnier, Braun, Cani, Benes, Galin, Peytavie, Guérin — *Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion*, Computer Graphics Forum, 2016.
  - URL : https://researchportal.ip-paris.fr/en/publications/large-scale-terrain-generation-from-tectonic-uplift-and-fluvial-e/
  - DOI : https://doi.org/10.1111/cgf.12820
- Tzathas, Gailleton, Steer, Cordonnier — *Physically-based analytical erosion for fast terrain generation*, Computer Graphics Forum / Eurographics, 2024.
  - URL : https://www-sop.inria.fr/reves/Basilic/2024/TGSC24/

### Terrain volumétrique et rendu GPU

- Geiss — *Generating Complex Procedural Terrains Using the GPU*, GPU Gems 3, NVIDIA.
  - URL : https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu

### LOD terrain

- Losasso, Hoppe — *Geometry Clipmaps: Terrain Rendering Using Nested Regular Grids*, SIGGRAPH / ACM TOG, 2004.
  - URL : https://hhoppe.com/proj/geomclipmap/
- Asirvatham, Hoppe — *Terrain Rendering Using GPU-Based Geometry Clipmaps*, GPU Gems 2, 2005.
  - URL : https://hhoppe.com/proj/gpugcm/
- Strugar — *Continuous Distance-Dependent Level of Detail for Rendering Heightmaps*, Journal of Graphics, GPU, and Game Tools, 2009.
  - URL : https://www.tandfonline.com/doi/abs/10.1080/2151237X.2009.10129287

### Matériaux de terrain et couches

- Unreal Engine Documentation — *Landscape Materials*.
  - URL : https://dev.epicgames.com/documentation/unreal-engine/landscape-materials-in-unreal-engine
- Unreal Engine Documentation — *Landscape Paint Mode*.
  - URL : https://dev.epicgames.com/documentation/unreal-engine/landscape-paint-mode-in-unreal-engine

---

## 26. Positionnement final

Pour un projet raisonnable, la meilleure trajectoire est :

```text
Heightmap déterministe
  → relief multi-échelle
  → hydrologie simple
  → érosion thermique
  → érosion hydraulique par particules
  → cartes physiques dérivées
  → splat maps matériaux
  → rendu chunké
  → décoration procédurale
```

Cette approche est suffisamment solide pour produire des résultats crédibles, suffisamment simple pour être implémentée progressivement, et suffisamment extensible pour accueillir ensuite des mécanismes plus avancés comme le LOD, les density fields, les simulations hydrauliques GPU ou les workflows inspirés de données réelles.
