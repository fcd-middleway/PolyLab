# Résumé opérationnel pour agent GitHub Copilot  
## Compression progressive de maillages surfaciques texturés

**Source principale :** thèse *Compression progressive de maillages surfaciques texturés*, Florian Caillaud, Université de Lyon / INSA Lyon, 2017.  
**Objectif du document :** fournir à un agent GitHub Copilot une compréhension opérationnelle de la méthode, de ses concepts et de ses frontières, afin qu’il puisse ensuite proposer un plan d’implémentation progressif.

Ce document n’est pas un plan de développement détaillé. Il sert de socle de connaissance technique. L’agent devra ensuite transformer cette compréhension en architecture logicielle, en étapes de développement, en choix de structures de données, puis en tâches concrètes.

---

# 1. Idée générale

Le projet consiste à reconstruire une méthode de **compression progressive de maillages surfaciques texturés**.

La compression progressive vise à transmettre ou charger un modèle 3D de manière incrémentale. Contrairement à une compression mono-résolution, qui ne devient exploitable qu’une fois tout le fichier reçu, une compression progressive permet d’obtenir très rapidement une version grossière mais globale du modèle, puis de l’améliorer progressivement jusqu’à retrouver le maillage complet.

Le principe général est le suivant :

```text
Maillage original détaillé Mn
        ↓ compression
Suite de paquets progressifs
        ↓ décompression progressive
M0 → M1 → M2 → ... → Mn
```

`M0` est le maillage le plus grossier. `Mn` est le maillage original.

La thèse cherche à aller plus loin que les approches classiques, souvent limitées aux maillages triangulaires 2-variétés, en proposant une méthode capable de traiter de manière générique :

- des maillages surfaciques ;
- des maillages triangulaires ou polygonaux ;
- des maillages 2-variétés ou non-variétés ;
- des maillages texturés ;
- des coutures de texture ;
- une reconstruction progressive sans perte du maillage final.

---

# 2. Problème adressé

Les modèles 3D détaillés peuvent devenir très volumineux, surtout dans un contexte Web ou mobile. Le coût ne concerne pas seulement le stockage : il concerne aussi la transmission réseau, le temps avant affichage, la mémoire disponible, et la capacité du terminal de réception.

Le problème à résoudre est donc :

> Comment transmettre et visualiser efficacement des données 3D distantes, en s’adaptant progressivement aux capacités du périphérique de réception et à l’état d’avancement du transfert ?

La solution proposée est une compression progressive qui donne rapidement un aperçu exploitable du modèle, puis le raffine.

---

# 3. Ce qu’il faut retenir pour le projet

La méthode n’est pas seulement une méthode de simplification de maillage.

Elle combine plusieurs sujets :

1. **Structure de données générique pour maillage surfacique** ;
2. **Pré-traitements et validation topologique** ;
3. **Simplification progressive par contraction d’arêtes** ;
4. **Sélection des arêtes à contracter selon une métrique locale** ;
5. **Regroupement des contractions en vagues de décimation** ;
6. **Encodage des informations nécessaires à la reconstruction** ;
7. **Décodage par expansion de sommets** ;
8. **Compression progressive de la texture image** ;
9. **Compression de la paramétrisation UV** ;
10. **Multiplexage des paquets maillage et texture selon une métrique perceptuelle**.

Le projet doit donc être compris comme un **codec progressif de maillage texturé**, et non comme un simple viewer de niveaux de détail.

---

# 4. Vocabulaire fondamental

## 4.1 Maillage surfacique

Un maillage surfacique est composé d’éléments de dimension 0, 1 et 2 :

```text
sommet → dimension 0
arête  → dimension 1
face   → dimension 2
```

Une face peut être triangulaire, quadrangulaire ou plus généralement polygonale.

Le maillage est défini par :

- sa **connectivité** : relations entre sommets, arêtes et faces ;
- sa **géométrie** : positions des sommets dans l’espace ;
- ses **attributs** : normales, couleurs, coordonnées UV, texture, etc.

## 4.2 Incidence, adjacence et valence

Une relation d’incidence relie deux éléments de dimensions différentes. Exemple : un sommet est incident à une arête, une arête est incidente à une face.

Une relation d’adjacence relie deux éléments de même dimension lorsqu’ils partagent un élément de dimension inférieure ou supérieure selon le cas.

La valence d’un élément correspond au nombre d’éléments de dimension supérieure auxquels il est incident.

Ces notions sont essentielles parce que la méthode manipule directement la topologie locale du maillage.

## 4.3 Maillage 2-variété

Un maillage 2-variété est localement équivalent à un disque autour de chaque sommet. En pratique, une arête normale est généralement incidente à deux faces.

Ces maillages sont plus simples à manipuler. Beaucoup de méthodes existantes de compression progressive reposent sur cette hypothèse.

## 4.4 Maillage non-variété

Un maillage non-variété ne respecte pas les contraintes des surfaces 2-variétés.

Il peut contenir :

- des sommets isolés ;
- des arêtes isolées ;
- des arêtes pendantes ;
- des arêtes complexes, incidentes à plus de deux faces ;
- des faces ou connexions topologiques inhabituelles.

La méthode de la thèse cherche précisément à traiter ces cas sans convertir artificiellement le maillage vers un modèle 2-variété.

## 4.5 Patch

Un patch est un voisinage local autour d’un élément du maillage.

Le patch d’un sommet correspond aux faces incidentes à ce sommet.  
Le patch d’une arête correspond à l’union des faces autour des deux sommets de l’arête.

La méthode raisonne souvent localement sur le patch d’une arête à contracter.

## 4.6 Texture, paramétrisation et coordonnées UV

Une texture est une image 2D appliquée sur un maillage.

La paramétrisation de texture indique comment les faces du maillage correspondent à des régions de cette image. Elle repose sur des coordonnées UV.

Il faut distinguer :

```text
image de texture       → l’image 2D elle-même
paramétrisation UV     → le mapping entre le maillage et l’image
```

Ces deux éléments doivent être compressés progressivement, mais ils ne sont pas de même nature.

## 4.7 Coutures de texture

Une couture de texture est une discontinuité de la paramétrisation UV. Deux faces adjacentes dans le maillage peuvent correspondre à deux régions non adjacentes dans l’image de texture.

Les coutures sont critiques : une simplification naïve peut les déplacer ou les déformer, ce qui crée des artefacts visuels importants.

## 4.8 Corner

Un corner est un couple :

```text
(sommet, face)
```

Il permet d’associer des coordonnées UV non pas seulement à un sommet, mais à l’occurrence d’un sommet dans une face.

C’est essentiel pour gérer les coutures. Un même sommet géométrique peut avoir plusieurs coordonnées UV selon les faces incidentes.

## 4.9 Wedge

Un wedge regroupe plusieurs corners adjacents qui partagent les mêmes coordonnées UV autour d’un sommet.

C’est une factorisation utile, mais la méthode décrite dans la thèse s’appuie surtout conceptuellement sur la notion de corner pour gérer correctement les discontinuités.

---

# 5. Vue globale de la méthode

La pipeline conceptuelle de compression est la suivante :

```text
Import du maillage original
        ↓
Chargement dans une structure de données générique
        ↓
Pré-traitements
        ↓
Quantification de la géométrie et des UV
        ↓
Simplification progressive par vagues
        ↓
À chaque contraction : récupération des informations de reconstruction
        ↓
Encodage géométrie / connectivité / texture
        ↓
Compression entropique
        ↓
Compression progressive de l’image de texture
        ↓
Multiplexage maillage + texture
        ↓
Flux compressé progressif
```

La pipeline conceptuelle de décompression est l’inverse :

```text
Lecture de l’entête
        ↓
Reconstruction de M0
        ↓
Lecture progressive des paquets
        ↓
Si paquet maillage : expansion de sommets
        ↓
Si paquet texture : raffinement de l’image
        ↓
Affichage d’un nouveau LoD
        ↓
Répéter jusqu’à Mn
```

---

# 6. Structure de données attendue

La méthode suppose une structure de données capable de représenter tous les maillages surfaciques, y compris les cas non-variétés et polygonaux.

Une structure de type half-edge classique est très efficace pour les maillages 2-variétés, mais elle devient plus difficile à utiliser pour des topologies non-variétés. La thèse utilise une structure de type **AIF** afin de gérer génériquement les relations entre sommets, arêtes et faces.

Pour un projet moderne, l’important est de concevoir une structure équivalente en capacité, même si elle ne s’appelle pas AIF.

Elle doit permettre :

- d’accéder aux sommets d’une arête ;
- d’accéder aux arêtes d’une face ;
- d’accéder aux faces incidentes à une arête ;
- d’accéder aux faces incidentes à un sommet ;
- de détecter les arêtes isolées, pendantes, normales, de bord ou complexes ;
- de modifier localement la connectivité ;
- de supprimer des faces devenues invalides ;
- de fusionner deux sommets ;
- de résoudre des doublons d’arêtes et de faces ;
- de maintenir les corners UV ;
- de maintenir les composantes connexes ;
- de construire des patchs locaux ;
- de trier de manière déterministe les éléments autour d’un sommet ou d’une arête.

## 6.1 Entités conceptuelles minimales

```text
Mesh
 ├── Vertex[]
 ├── Edge[]
 ├── Face[]
 ├── Corner[]
 ├── ConnectedComponent[]
 └── Attributes
```

### Vertex

Un sommet porte au minimum :

- un identifiant stable ;
- une position 3D quantifiée ou déquantifiée ;
- une liste d’arêtes incidentes ;
- une liste de faces incidentes ;
- éventuellement des attributs comme normale ou couleur.

### Edge

Une arête porte :

- deux sommets incidents ;
- une liste de faces incidentes ;
- un état : isolée, pendante, bord, normale, complexe ;
- un poids de contraction ;
- des flags temporaires pour la décimation.

### Face

Une face porte :

- une liste ordonnée de sommets ;
- une liste ordonnée d’arêtes ;
- une orientation ;
- une liste de corners ;
- un degré ;
- éventuellement des informations de matériau ou de texture.

### Corner

Un corner porte :

- une référence vers un sommet ;
- une référence vers une face ;
- des coordonnées UV ;
- éventuellement une région de texture.

### ConnectedComponent

Une composante connexe regroupe les éléments connectés entre eux par des arêtes.

Elle est importante pour :

- le codage des arbres couvrants ;
- la construction de `M0` ;
- la fusion optionnelle des composantes.

---

# 7. Pré-traitements

## 7.1 Quantification

La géométrie et les coordonnées UV sont quantifiées avant compression.

Objectif :

- convertir des valeurs flottantes en entiers ;
- réduire le bruit inutile des décimales ;
- rendre l’encodage plus efficace ;
- faciliter la compression entropique.

La géométrie est quantifiée sur `QG` bits.  
Les coordonnées UV sont quantifiées sur `QT` bits.

La quantification de la géométrie doit être uniforme sur les trois axes pour ne pas perturber certaines prédictions géométriques.

Le flux doit contenir dans son entête :

- le nombre de bits de quantification de la géométrie ;
- le nombre de bits de quantification des UV ;
- les bornes min/max nécessaires à la déquantification de la géométrie ;
- les informations nécessaires pour reconstruire `M0`.

## 7.2 Intégrité géométrique

Après quantification, deux sommets distincts peuvent se retrouver exactement à la même position.

La méthode impose de fusionner les sommets partageant la même position, afin d’éviter des situations topologiques ambiguës.

Attention : cette fusion n’est pas inversée à la décompression dans la méthode de la thèse. Elle peut modifier légèrement la connectivité, mais pas la qualité visuelle si les sommets fusionnés avaient exactement la même position.

Pour un projet moderne, ce point doit être traité explicitement :

- soit accepter cette fusion comme pré-traitement destructif contrôlé ;
- soit documenter que la reconstruction est sans perte après pré-traitement, mais pas forcément strictement identique au fichier source brut ;
- soit ajouter un mécanisme spécifique pour restaurer les doublons, si la conservation exacte du fichier d’entrée est indispensable.

## 7.3 Fusion optionnelle des composantes connexes

Un maillage peut contenir beaucoup de composantes connexes. Cela pénalise la compression, car il faut gérer un arbre couvrant par composante.

La thèse propose un pré-traitement optionnel :

1. détecter les composantes connexes ;
2. calculer le barycentre de chaque composante ;
3. relier spatialement les composantes proches ;
4. ajouter des arêtes isolées pour former une seule grande composante.

Ces arêtes isolées servent au processus de compression. Elles n’ont pas nécessairement d’intérêt visuel.

Dans un prototype, ce traitement peut être différé, mais l’agent doit comprendre pourquoi il existe : il réduit le coût de codage lié à la multiplicité des composantes.

---

# 8. Simplification progressive

## 8.1 Opérateur principal : contraction d’arête

La simplification repose sur la contraction d’arête.

Une arête `s0s1` est remplacée par un sommet résultant `s`.

```text
Avant :
s0 ---- s1

Après :
   s
```

Dans cette méthode, le sommet résultant `s` est placé au milieu de l’ancienne arête `s0s1`.

Ce choix peut être moins optimal visuellement qu’un placement libre, mais il simplifie fortement l’encodage. Comme `s` est le milieu de `s0` et `s1`, il suffit d’encoder un vecteur relatif pour pouvoir retrouver les deux sommets d’origine lors de l’expansion.

## 8.2 Pourquoi le milieu de l’arête

Si `s` est placé au milieu de `s0s1`, alors :

```text
vecteur(s → s0) = - vecteur(s → s1)
```

Le décodeur peut donc reconstruire `s0` et `s1` à partir d’une seule information vectorielle.

C’est une décision de compression importante.

## 8.3 Contraction dans un maillage non-variété polygonal

La contraction doit fonctionner même si le patch local n’est pas 2-variété et même si les faces ne sont pas toutes triangulaires.

Lors de la contraction :

1. les faces triangulaires incidentes à l’arête contractée peuvent devenir invalides et sont supprimées ;
2. les deux sommets sont fusionnés ;
3. les doublons d’arêtes et de faces créés par la fusion sont résolus ;
4. l’arête contractée est supprimée ;
5. la position du nouveau sommet est calculée ;
6. les informations de texture autour du nouveau sommet sont mises à jour.

## 8.4 Opérateur inverse : expansion de sommet

La décompression repose sur l’opération inverse : l’expansion de sommet.

Un sommet `s` est remplacé par deux sommets `s0` et `s1`, puis le patch local est reconstruit :

```text
Avant :
   s

Après :
s0 ---- s1
```

L’expansion doit restaurer :

- la géométrie ;
- les arêtes ;
- les faces ;
- l’orientation des faces ;
- les corners UV ;
- les coutures de texture.

---

# 9. Gestion des textures pendant la simplification

## 9.1 Problème

Lorsqu’une arête est contractée, les coordonnées UV doivent être mises à jour.

Mais un même sommet peut appartenir à plusieurs régions de texture. Certaines faces adjacentes dans le maillage ne sont pas adjacentes dans l’image de texture. C’est le cas des coutures.

Une contraction naïve peut donc :

- déplacer une couture ;
- interpoler des UV incompatibles ;
- créer un repli de texture ;
- dégrader fortement la qualité visuelle.

## 9.2 Corners appariables et non appariables

La méthode distingue les corners qui peuvent être appariés entre `s0` et `s1` de ceux qui ne le peuvent pas.

Un corner appariable peut être interpolé avec son correspondant.  
Un corner non appariable doit être conservé ou traité explicitement.

Le principe est :

```text
si deux corners appartiennent à une même région cohérente :
    on peut interpoler leurs UV
sinon :
    on ne force pas l’interpolation
```

## 9.3 Régions de texture

La méthode détecte les régions de texture autour du patch local.

Pour chaque face autour de l’arête contractée, il faut savoir à quelle région de texture elle appartient.

Cette notion est ensuite réutilisée lors de l’encodage de la paramétrisation UV, car elle permet d’éviter de transmettre trop de coordonnées explicitement.

## 9.4 Cas particuliers

Certains cas de repli ou de discontinuité de texture ne sont pas gérés naturellement par une interpolation simple.

Le document original signale notamment le cas où deux faces appartiennent à une même région, mais où certains corners liés à un même sommet n’ont pas les mêmes coordonnées UV.

Pour un projet moderne, ce point doit être considéré comme une zone de risque.

---

# 10. Sélection des sites de simplification

La méthode ne contracte pas les arêtes au hasard.

Elle maintient une file de priorité d’arêtes. Chaque arête reçoit un poids `p(a)`. Les arêtes de poids faible sont contractées en priorité.

L’objectif est de minimiser la distorsion visible produite par chaque contraction.

## 10.1 Métriques étudiées

La thèse évoque plusieurs familles de critères.

### Longueur d’arête

Critère simple : contracter d’abord les arêtes les plus courtes.

Avantage :

- facile à calculer.

Limites :

- ne tient pas suffisamment compte de la géométrie locale ;
- ne tient pas compte de la texture ;
- peut dégrader les formes importantes.

### Distance géométrique locale

La méthode utilise une approximation locale de la distance de Hausdorff entre le patch avant et après contraction.

Cette métrique est notée conceptuellement :

```text
phaus(a)
```

Elle vise à mesurer la distorsion géométrique produite par la contraction de l’arête `a`.

Elle tient aussi compte de certaines propriétés topologiques afin d’éviter des contractions défavorables, par exemple celles qui créent des arêtes pendantes.

### Distorsion de texture

La méthode introduit aussi un critère orienté texture :

```text
ptext(a)
```

Il vise à limiter la distorsion de la paramétrisation UV et à préserver les coutures.

### Critère combiné

Le critère principal recommandé est :

```text
pcomb(a) = α × phaus(a) + (1 - α) × ptext(a)
```

Dans la thèse, `α` est fixé à `1/2`, ce qui donne une importance équivalente à la géométrie et à la texture.

```text
pcomb(a) = 0.5 × phaus(a) + 0.5 × ptext(a)
```

Le critère combiné est essentiel : la géométrie seule ne suffit pas à préserver les coutures, et la texture seule ne suffit pas à préserver la forme.

---

# 11. Arêtes non contractables

Certaines arêtes ne doivent pas être contractées à un instant donné.

Les raisons peuvent être :

- contraction topologiquement ambiguë ;
- création de configurations invalides ;
- conflit avec une contraction déjà réalisée dans la même vague ;
- risque de produire des éléments non désirés ;
- dépendance entre deux simplifications voisines.

Une arête non contractable à une vague donnée peut redevenir contractable plus tard, après simplification d’arêtes voisines.

Il est donc important de ne pas supprimer définitivement une arête de la file uniquement parce qu’elle est temporairement non contractable.

---

# 12. Vagues de décimation

## 12.1 Pourquoi des vagues

Coder explicitement l’identifiant du sommet à raffiner à chaque étape est coûteux.

La méthode utilise donc des **vagues de décimation**.

Une vague regroupe plusieurs contractions indépendantes. Elle produit un nouveau LoD :

```text
Mi → Mi-1
```

Pendant la décompression, le décodeur doit pouvoir retrouver implicitement quels sommets doivent être expandus.

## 12.2 Principe

Pour chaque vague :

1. une file de priorité contient les arêtes candidates ;
2. les arêtes sont contractées dans l’ordre des poids ;
3. seules les contractions indépendantes sont autorisées ;
4. la vague s’arrête lorsque le poids courant dépasse un seuil dynamique ;
5. les informations de reconstruction sont stockées pour cette vague.

## 12.3 Contractions indépendantes

Deux contractions dans une même vague ne doivent pas se perturber.

En pratique, deux sommets résultant d’une contraction ne doivent pas être adjacents.

Cette contrainte limite le nombre de contractions par vague, mais elle simplifie le décodage et évite les conflits.

## 12.4 Seuil dynamique

La thèse ne choisit ni une seule contraction par vague, ni toutes les contractions possibles.

Elle utilise un seuil dynamique calculé à partir des poids de la file de priorité.

Idée :

```text
contracter beaucoup d’arêtes si elles produisent peu de distorsion
contracter peu d’arêtes si les prochaines contractions sont coûteuses
```

Ce mécanisme équilibre :

- qualité des premiers LoD ;
- taux de compression ;
- nombre de paquets ;
- contrôle de la distorsion.

---

# 13. Encodage d’une contraction

Avant chaque contraction réelle, le codeur simule ou analyse la contraction pour récupérer les informations nécessaires à l’expansion future.

Pour une arête contractée `s0s1 → s`, il faut produire :

```text
info(s)
 ├── géométrie
 ├── connectivité
 ├── orientation
 └── paramétrisation de texture
```

La thèse décrit l’ordre conceptuel suivant :

```text
géométrie
connectivité / orientation
texture : indices de régions + vecteurs de déplacement UV
```

---

# 14. Encodage de la connectivité

## 14.1 Principe

L’objectif est de permettre au décodeur de redistribuer correctement les arêtes et faces incidentes à `s` vers les deux sommets `s0` et `s1`.

La méthode associe des codes aux configurations locales autour de l’arête contractée.

Pour une arête adjacente à `s` pendant la décompression :

- code `0` : l’arête devient incidente à `s0` ;
- code `1` : l’arête devient incidente à `s1` ;
- d’autres codes décrivent des configurations où l’arête ou la face doit être traitée différemment, notamment pour restaurer l’arête `s0s1` ou des faces supprimées.

Le détail exact des codes dépend du patch polygonal non-variété.

## 14.2 Déduction des codes de faces

Une optimisation importante est que les codes associés aux faces peuvent souvent être déduits des codes associés aux arêtes.

Cela réduit fortement la quantité d’information à transmettre.

Principe :

```text
codes d’arêtes connus
        ↓
configuration des faces déduite
        ↓
moins de codes explicites dans le flux
```

## 14.3 Prédiction géométrique

La méthode exploite une hypothèse simple :

> Dans un maillage régulier, plus deux sommets sont proches, plus ils ont de chances d’être connectés.

Elle utilise donc une prédiction géométrique pour réduire l’entropie des codes de connectivité, notamment pour les codes `0` et `1`.

Le codeur et le décodeur effectuent la même prédiction. Le flux ne transporte alors que l’information nécessaire pour confirmer ou corriger cette prédiction.

## 14.4 Orientation des faces

Dans un maillage non-variété, l’orientation des faces n’est pas toujours globalement consistante.

La méthode doit donc encoder une information permettant de restaurer l’orientation correcte des faces reconstruites.

Ce point est important pour le rendu Web, car une mauvaise orientation peut perturber :

- le back-face culling ;
- les normales ;
- l’éclairage ;
- la visibilité des surfaces.

---

# 15. Encodage de la géométrie

## 15.1 Principe

Au lieu d’encoder les coordonnées absolues de `s0` et `s1`, la méthode encode un vecteur relatif depuis le sommet résultant `s`.

Comme `s` est placé au milieu de `s0s1`, un seul vecteur permet de retrouver les deux sommets.

Conceptuellement :

```text
u = vecteur(s → s0)

s0 = s + u
s1 = s - u
```

Pour éviter des coordonnées non entières après quantification, la méthode utilise un mécanisme déterministe d’arrondi.

## 15.2 Repère de Frenet

Pour améliorer la compression du vecteur géométrique, la méthode peut exprimer le vecteur dans un repère local de Frenet.

L’objectif est de réduire l’entropie des coordonnées du vecteur, surtout sur des surfaces régulières.

Limite importante :

- le repère de Frenet est naturel sur des surfaces 2-variétés ;
- il est moins naturel dans des patchs non-variétés ;
- la méthode l’applique malgré tout, faute de pouvoir savoir sans surcoût si le patch deviendra non-variété lors de l’expansion.

Dans une réimplémentation moderne, cette partie peut être isolée comme optimisation facultative.

---

# 16. Encodage de la paramétrisation UV

## 16.1 Objectif

Lors de l’expansion `s → s0s1`, le décodeur doit reconstruire les coordonnées UV des corners du patch.

Il faut gérer :

- les corners appariables ;
- les corners non appariables ;
- les régions de texture déjà connues ;
- les régions nouvelles pour le décodeur ;
- les coutures ;
- les faces supprimées pendant la contraction.

## 16.2 Régions connues et inconnues

Pour chaque face incidente à l’arête contractée, la méthode encode un indice de région de texture.

Plusieurs cas existent :

1. la région est déjà connue du décodeur ;
2. la région est nouvelle ;
3. la région doit être traitée avec un vecteur spécifique.

Dans le cas courant, un seul vecteur de déplacement peut permettre de reconstruire plusieurs corners d’une même région.

Dans les cas rares de région inconnue, il faut fournir explicitement des coordonnées UV.

## 16.3 Prédiction basée géométrie

La méthode utilise une prédiction des coordonnées UV à partir de la géométrie locale.

Hypothèse :

> La forme des faces dans le maillage 3D et la forme des faces dans l’espace UV sont souvent similaires, surtout si la paramétrisation est relativement conforme.

Le codeur et le décodeur utilisent cette similarité pour prédire le déplacement UV. Le flux transporte alors seulement une erreur ou un vecteur résiduel.

Cette approche contribue fortement à réduire la taille de l’encodage UV.

## 16.4 Importance pour la qualité visuelle

La gestion de la paramétrisation UV n’est pas un détail. Une bonne géométrie avec une mauvaise texture peut donner un mauvais résultat visuel.

La méthode cherche donc à préserver conjointement :

```text
qualité géométrique + qualité de paramétrisation + coutures
```

---

# 17. Encodage d’une vague

## 17.1 Problème

Même si l’on sait encoder une contraction isolée, le décodeur doit savoir **à quel sommet** appliquer chaque information de raffinement.

Coder un identifiant de sommet à chaque fois serait trop coûteux.

## 17.2 Arbres couvrants

La méthode utilise un ou plusieurs arbres couvrants pour parcourir le maillage de manière déterministe.

Pour chaque composante connexe, un arbre couvrant est construit à partir d’un sommet de départ.

Le sommet de départ doit rester présent tout au long de la compression pour que le parcours reste décodable.

## 17.3 Codage binaire du parcours

Pendant le parcours :

- un code `0` indique qu’un sommet n’est pas résultant d’une contraction à raffiner ;
- un code `1` indique qu’un sommet correspond à une contraction et que ses informations `info(s)` doivent être lues.

Grâce aux contraintes d’indépendance, certains `0` peuvent être déduits implicitement. Cela réduit la taille du flux.

---

# 18. Compression entropique

La méthode utilise un codeur arithmétique.

Les informations ne sont pas toutes compressées dans le même contexte, car elles n’ont pas les mêmes distributions.

Exemples de contextes :

- bits de construction des arbres couvrants ;
- géométrie ;
- connectivité ;
- orientation ;
- indices de régions de texture ;
- vecteurs de déplacement UV.

Le but est de réduire l’entropie en exploitant la nature propre de chaque type de donnée.

Pour une réimplémentation progressive, l’agent doit comprendre que le codeur arithmétique est une couche d’optimisation de compression. On peut d’abord reproduire le comportement logique avec un flux non compressé ou moins optimisé, puis ajouter l’entropy coding plus tard.

---

# 19. Organisation du flux compressé

Le flux est composé conceptuellement de deux parties :

```text
Entête
Corps du flux
```

## 19.1 Entête

L’entête contient notamment :

- présence ou absence de texture ;
- paramètres de quantification ;
- bornes de déquantification ;
- informations nécessaires à la reconstruction de `M0` ;
- coordonnées des sommets restants de `M0` ;
- liste des sommets de départ des arbres couvrants.

`M0` est le maillage minimal obtenu après simplification complète. Il ne contient plus d’arêtes ni de faces, seulement des sommets isolés correspondant notamment aux composantes connexes.

## 19.2 Corps

Le corps est une suite de paquets.

Chaque paquet peut être :

- un paquet de raffinement de maillage ;
- un paquet de raffinement de texture.

Pour chaque paquet de maillage, le décodeur reconstruit un nouveau LoD du maillage.

Pour chaque paquet de texture, le décodeur améliore la texture courante.

---

# 20. Compression progressive de l’image de texture

La texture image ne doit pas être envoyée intégralement au début du flux.

Si toute la texture est transmise avant le premier LoD, on perd l’intérêt de la progressivité.

La méthode compresse donc l’image de texture elle-même de manière progressive.

Conceptuellement :

```text
Texture originale Tm
        ↓ compression progressive
T0, T1, T2, ..., Tm
```

`T0` est une version grossière de la texture. Les paquets suivants ajoutent du détail.

La thèse mentionne les approches de compression progressive d’image, notamment de type JPEG 2000 ou JPEG progressif. Pour un projet moderne, l’important n’est pas forcément de reproduire exactement le codec image utilisé historiquement, mais de conserver la propriété suivante :

> La texture doit pouvoir être raffinée par paquets successifs, synchronisés avec les paquets de raffinement du maillage.

---

# 21. Multiplexage maillage + texture

## 21.1 Problème

À chaque instant de la décompression, il faut décider quoi envoyer ensuite :

```text
raffiner le maillage ?
ou
raffiner la texture ?
```

Un maillage très détaillé avec une texture grossière peut être visuellement mauvais.  
Une texture très détaillée sur un maillage trop grossier peut aussi être inefficace.

Il faut donc équilibrer géométrie et texture.

## 21.2 Grille de combinaisons

La méthode considère les combinaisons possibles :

```text
Cij = Mi associé à Tj
```

Où :

- `Mi` est un niveau de détail du maillage ;
- `Tj` est un niveau de détail de texture.

## 21.3 Métrique perceptuelle

Pour choisir le prochain paquet, la méthode évalue la qualité visuelle via une métrique perceptuelle basée image, notamment MS-SSIM.

L’évaluation se fait en rendant plusieurs vues du modèle et en comparant ces images au rendu du modèle original.

## 21.4 Choix du prochain paquet

À partir d’une combinaison courante `Cij`, on compare :

```text
gain visuel / coût du paquet maillage suivant
gain visuel / coût du paquet texture suivant
```

Si le meilleur ratio est côté maillage, on ajoute un paquet maillage.  
Si le meilleur ratio est côté texture, on ajoute un paquet texture.

Ce mécanisme construit un chemin de multiplexage progressif dans la grille des LoD.

## 21.5 Bit de type de paquet

Dans le flux final, il faut indiquer si un paquet est un paquet maillage ou texture.

La thèse ajoute conceptuellement un bit de type :

```text
0 → paquet de maillage
1 → paquet de texture
```

Certains premiers bits peuvent être omis si l’ordre initial est connu et déterministe.

---

# 22. Décompression progressive

La décompression est le miroir de la compression.

## 22.1 Initialisation

Le décodeur lit l’entête.

Il récupère :

- les paramètres de quantification ;
- la présence ou non de texture ;
- les données initiales ;
- `M0` ;
- éventuellement `T0`.

Il peut déjà afficher un premier LoD.

## 22.2 Traitement d’un paquet texture

Si le paquet courant est un paquet texture :

1. le paquet est ajouté au flux de texture progressive ;
2. la texture courante est mise à jour ;
3. le modèle est réaffiché avec une meilleure texture.

## 22.3 Traitement d’un paquet maillage

Si le paquet courant est un paquet maillage :

1. le décodeur reconstruit le ou les arbres couvrants de la vague ;
2. il détermine les sommets à expandre ;
3. pour chaque sommet `s` concerné :
   - il décode le vecteur géométrique ;
   - il reconstruit `s0` et `s1` ;
   - il redistribue les arêtes incidentes ;
   - il reconstruit les faces ;
   - il restaure l’orientation ;
   - il reconstruit les corners UV ;
   - il met à jour les régions de texture ;
4. le nouveau LoD `Mi+1` est disponible.

## 22.4 Affichage intermédiaire

Après chaque paquet, le modèle peut être affiché.

C’est le cœur du caractère progressif :

```text
lecture paquet
    ↓
raffinement
    ↓
affichage
```

---

# 23. Résultats et enseignements de la thèse

## 23.1 Métrique de sélection d’arêtes

Les expérimentations montrent que la métrique combinée géométrie + texture produit de meilleurs résultats visuels que les métriques isolées.

En particulier :

- `phaus` seul préserve la géométrie mais peut déplacer les coutures ;
- `ptext` seul préserve mieux la texture mais peut dégrader la forme ;
- `pcomb` donne un meilleur compromis.

## 23.2 Taille des vagues

Une vague minimale, avec une seule contraction, donne une très bonne qualité mais augmente le nombre de paquets.

Une vague maximale compresse mieux certains éléments de parcours, mais dégrade le contrôle de la distorsion.

Le seuil dynamique offre un compromis efficace.

## 23.3 Compression géométrie/connectivité

La méthode est compétitive à bas et moyen débit, notamment parce qu’elle contrôle finement la distorsion locale.

Elle garantit une restitution sans perte du maillage traité après pré-traitement, ce qui peut rendre le taux final plus coûteux que certaines méthodes spécialisées.

## 23.4 Compression UV

La prédiction géométrique des coordonnées UV permet d’obtenir de bons résultats, surtout lorsque la paramétrisation est relativement conforme.

La gestion par corners permet de bien traiter les coutures.

## 23.5 Multiplexage

Le multiplexage maillage + texture améliore la qualité visuelle progressive : il évite d’avoir un maillage trop détaillé avec une texture trop grossière, ou l’inverse.

Le résultat attendu est une progression visuelle équilibrée.

---

# 24. Limites connues

## 24.1 Coût de compression sans perte

La méthode peut produire des taux de compression sans perte plus élevés que des méthodes spécialisées.

Raisons principales :

- généricité ;
- support des maillages non-variétés ;
- support des maillages polygonaux ;
- support des coutures ;
- absence d’hypothèses fortes sur la topologie ;
- contrôle local fin de la distorsion.

## 24.2 Complexité algorithmique

La méthode est complexe parce qu’elle combine :

- topologie non-variété ;
- simplification polygonale ;
- compression progressive ;
- gestion des UV ;
- compression entropique ;
- multiplexage perceptuel.

Il ne faut pas essayer de tout coder en une seule passe.

## 24.3 Repère de Frenet sur non-variété

Le repère de Frenet améliore le codage géométrique sur des surfaces régulières, mais il peut être moins pertinent dans des patchs non-variétés.

Cette optimisation doit être isolée afin de pouvoir être désactivée ou remplacée.

## 24.4 Pré-traitement de fusion

La fusion de sommets de même position n’est pas strictement inversée dans la méthode décrite.

Cela doit être documenté clairement dans le projet.

## 24.5 Texture progressive

Le choix exact du codec image progressif peut être adapté.

Il faut préserver la propriété progressive, pas nécessairement reproduire à l’identique le format historique utilisé dans la thèse.

---

# 25. Frontières conceptuelles pour le futur projet

Le projet peut être segmenté en domaines conceptuels, sans encore définir de tâches d’implémentation.

## 25.1 Domaine Mesh Core

Responsable de représenter le maillage générique.

Il doit gérer :

- sommets ;
- arêtes ;
- faces polygonales ;
- relations d’incidence ;
- relations d’adjacence ;
- composantes connexes ;
- patchs ;
- modifications topologiques locales ;
- cas non-variétés.

## 25.2 Domaine Attribute Core

Responsable des attributs du maillage.

Il doit gérer :

- géométrie ;
- normales ;
- couleurs par sommet ou par face, si nécessaires ;
- corners ;
- UV ;
- régions de texture ;
- texture image.

Dans la thèse, la texture couleur est surtout traitée comme une image + une paramétrisation UV. Les couleurs par sommet ou par face sont plus simples, mais doivent être considérées comme des attributs additionnels si le nouveau projet veut les gérer.

## 25.3 Domaine Simplification

Responsable de la décimation.

Il doit connaître :

- contraction d’arête ;
- expansion inverse ;
- arêtes non contractables ;
- maintien de la cohérence topologique ;
- mise à jour des corners ;
- résolution des doublons ;
- file de priorité ;
- métriques locales.

## 25.4 Domaine Metrics

Responsable de l’évaluation des coûts de contraction.

Il doit isoler :

- métrique géométrique ;
- métrique texture ;
- métrique combinée ;
- seuil dynamique de vague ;
- éventuellement métriques alternatives.

## 25.5 Domaine Progressive Codec

Responsable de la structure du flux.

Il doit comprendre :

- entête ;
- paquets ;
- types de paquets ;
- ordre de lecture ;
- codage des vagues ;
- codage des contractions ;
- contexts d’entropie ;
- versionnement du format.

## 25.6 Domaine Texture Progressive

Responsable du flux de texture.

Il doit gérer :

- création de LoD de texture ;
- paquets progressifs ;
- compatibilité avec le viewer ;
- synchronisation avec les LoD de maillage.

## 25.7 Domaine Multiplexing

Responsable de l’ordre optimal des paquets.

Il doit gérer :

- score visuel ;
- coût des paquets ;
- choix entre raffinement maillage et raffinement texture ;
- construction du chemin progressif.

## 25.8 Domaine Decoder / Viewer

Responsable de la reconstruction et de l’affichage.

Il doit pouvoir :

- lire un flux progressif ;
- afficher `M0` ;
- appliquer les paquets un par un ;
- afficher chaque LoD ;
- vérifier la cohérence topologique ;
- visualiser les coutures, UV et erreurs.

---

# 26. Approche mentale recommandée pour l’agent

L’agent doit comprendre que le projet a deux niveaux.

## 26.1 Niveau logique

Le niveau logique vérifie que la méthode fonctionne :

- représenter un maillage ;
- contracter une arête ;
- stocker les informations inverses ;
- expandre un sommet ;
- retrouver exactement le patch initial ;
- enchaîner plusieurs contractions ;
- reconstruire progressivement.

Ce niveau peut être testé sans compression binaire avancée.

## 26.2 Niveau compression

Le niveau compression optimise le flux :

- quantification ;
- prédiction ;
- réduction d’entropie ;
- codage arithmétique ;
- multiplexage ;
- format binaire compact.

Ces optimisations ne doivent pas masquer la logique fondamentale. Un prototype peut d’abord utiliser un flux explicite, puis réduire progressivement les données.

---

# 27. Ce que l’agent doit éviter de faire trop tôt

L’agent ne doit pas commencer par :

- optimiser le format binaire ;
- coder un arithmetic coder complet ;
- gérer tous les cas non-variétés dès la première itération ;
- implémenter immédiatement le multiplexage MS-SSIM ;
- supposer que le maillage est triangulaire 2-variété ;
- ignorer les corners UV ;
- transformer les coutures en duplication de sommets sans décision explicite ;
- confondre texture image et coordonnées UV ;
- confondre simplification de rendu et compression progressive réversible.

Ces raccourcis peuvent produire un démonstrateur visuel, mais pas une reconstruction fidèle de la méthode.

---

# 28. Questions à clarifier avant plan d’implémentation

Avant de proposer un plan d’implémentation, l’agent devrait clarifier ou faire valider les points suivants :

1. Le projet vise-t-il une reproduction fidèle de la méthode de thèse ou un démonstrateur inspiré ?
2. Le format d’entrée principal sera-t-il OBJ, glTF, PLY, OFF, ou un format interne ?
3. Les faces polygonales doivent-elles être conservées ou peut-on trianguler au chargement ?
4. Le support non-variété est-il indispensable dès le début ?
5. La reconstruction finale doit-elle être strictement sans perte ?
6. Les textures sont-elles obligatoires dès le MVP ?
7. Les couleurs par sommet ou par face doivent-elles être traitées comme un attribut séparé ?
8. Le runtime cible est-il Web, desktop, Rust/WASM, C++, TypeScript, ou autre ?
9. Le viewer doit-il afficher chaque paquet de progression ?
10. Le codec doit-il être prioritairement pédagogique ou performant ?
11. Le format binaire doit-il être stable dès le début ou peut-il commencer en JSON/debug ?
12. Le multiplexage maillage/texture doit-il être reproduit dès la première version ou ajouté plus tard ?

---

# 29. Noyau minimal à comprendre

Si l’agent ne devait retenir qu’une seule chose :

> La méthode compresse progressivement un maillage surfacique texturé en le simplifiant par contractions d’arêtes, tout en enregistrant les informations nécessaires pour inverser chaque contraction pendant la décompression. Ces contractions sont choisies avec une métrique qui préserve à la fois la géométrie et la paramétrisation de texture. Les données de raffinement du maillage et les données de raffinement de texture sont ensuite multiplexées pour optimiser la qualité visuelle progressive.

---

# 30. Représentation synthétique

```text
ENCODER

input: maillage texturé Mn

1. Charger dans une structure générique
2. Quantifier géométrie et UV
3. Valider / pré-traiter le maillage
4. Initialiser file de priorité des arêtes
5. Répéter jusqu’à disparition des arêtes :
   a. créer une vague de décimation
   b. sélectionner les arêtes contractables selon pcomb
   c. pour chaque contraction :
      - capturer info géométrie
      - capturer info connectivité
      - capturer orientation
      - capturer info UV / régions de texture
      - contracter l’arête
   d. encoder la vague via un parcours déterministe
6. Obtenir M0
7. Compresser les informations de raffinement
8. Compresser la texture en niveaux progressifs
9. Multiplexer maillage + texture
10. Produire le flux final
```

```text
DECODER

input: flux progressif

1. Lire entête
2. Reconstruire M0
3. Afficher M0
4. Pour chaque paquet :
   a. si paquet texture :
      - raffiner la texture
   b. si paquet maillage :
      - identifier les sommets à expandre
      - décoder géométrie
      - décoder connectivité
      - décoder orientation
      - décoder UV
      - appliquer les expansions
   c. afficher le nouveau LoD
5. Terminer avec Mn
```

---

# 31. Critères de compréhension pour l’agent

L’agent a correctement compris la méthode s’il sait expliquer :

- pourquoi la compression progressive est différente d’une simple compression fichier ;
- pourquoi `M0` doit être affichable rapidement ;
- pourquoi l’opérateur de contraction d’arête est choisi ;
- pourquoi le sommet résultant est placé au milieu de l’arête ;
- pourquoi l’expansion de sommet est l’opération inverse ;
- pourquoi les maillages non-variétés changent fortement la difficulté ;
- pourquoi les corners sont nécessaires pour les coutures ;
- pourquoi une métrique géométrique seule ne suffit pas ;
- pourquoi les contractions sont regroupées en vagues ;
- pourquoi un arbre couvrant évite de coder explicitement les identifiants de sommets ;
- pourquoi la connectivité peut être prédite ou déduite partiellement ;
- pourquoi la texture image doit elle aussi être progressive ;
- pourquoi le multiplexage maillage/texture est nécessaire ;
- pourquoi la première version du projet peut être logique et non compressée avant d’être réellement optimisée.

---

# 32. Synthèse finale

La thèse propose une méthode complète et générique de compression progressive de maillages surfaciques texturés.

Son originalité tient principalement à quatre points :

1. **Généricité topologique** : traitement des maillages polygonaux non-variétés.
2. **Préservation visuelle locale** : choix des contractions par une métrique combinant géométrie et texture.
3. **Gestion correcte des coutures** : utilisation d’une représentation par corners et de régions de texture.
4. **Progressivité complète** : raffinement conjoint du maillage et de la texture via multiplexage perceptuel.

Pour réimplémenter cette méthode, il faut prioriser la compréhension de la logique de simplification/réversibilité avant la performance de compression. Le premier enjeu n’est pas de produire le meilleur taux de compression, mais de garantir que chaque contraction peut être inversée de manière déterministe par le décodeur.

Une fois ce noyau fiable, les optimisations de la thèse peuvent être ajoutées progressivement :

```text
quantification
→ prédiction géométrique
→ contexte entropique
→ codage arithmétique
→ texture progressive
→ multiplexage perceptuel
```

Le projet doit donc être conduit comme la construction d’un codec progressif, modulaire, testable et visuellement observable à chaque étape.
