# Test Assets - Compression

Ces maillages de test sont conçus pour valider la robustesse de l'algorithme de simplification par edge collapse sur différentes configurations topologiques.

**Générés par** : `scripts/generate_test_meshes.py`  
**Date** : 9 juin 2026

---

## 📦 Catégories

### 1. Manifold Simple (6 meshes)

Maillages 2-variétés classiques, cas de base pour la simplification.

| Fichier | Vertices | Faces | Description |
|---------|----------|-------|-------------|
| `triangle.obj` | 3 | 1 | Triangle simple (baseline) |
| `quad.obj` | 4 | 1 | Quad simple (face à 4 côtés) |
| `two_triangles.obj` | 4 | 2 | 2 triangles partageant 1 arête |
| `cube_tris.obj` | 8 | 12 | Cube triangulé (2 tri/face) |
| `cube_quads.obj` | 8 | 6 | Cube en quads |
| `sphere_low.obj` | 12 | 20 | Icosaèdre (sphère low-poly) |

**Tests attendus** : ✅ Chargement OK, ✅ Simplification progressive sans erreur

---

### 2. Non-Manifold (5 meshes)

Configurations non-2-variétés avec arêtes complexes, sommets pinch, bords ouverts.

| Fichier | Vertices | Faces | Description |
|---------|----------|-------|-------------|
| `t_junction.obj` | 5 | 3 | Arête complexe (3 faces incidentes) |
| `pinch_point.obj` | 5 | 2 | Sommet complexe (2 surfaces jointes) |
| `open_surface.obj` | 6 | 4 | Surface avec bords ouverts |
| `multiple_holes.obj` | 16 | 8 | Surface avec 2 trous |
| `wing_edge.obj` | 4 | 1 | Arête avec 1 seule face |

**Tests attendus** :
- ⚠️ `t_junction` : collapse de l'arête complexe DOIT échouer
- ⚠️ `pinch_point` : attention à ne pas fusionner les surfaces
- ✅ `open_surface` : collapse OK mais gérer les bords
- ⚠️ `multiple_holes` : ne pas changer la topologie (genre)

---

### 3. Degenerate (3 meshes)

Cas limites et dégénérés pour tester la robustesse.

| Fichier | Vertices | Faces | Description |
|---------|----------|-------|-------------|
| `zero_area_face.obj` | 3 | 1 | Face avec aire = 0 (vertices alignés) |
| `zero_length_edge.obj` | 3 | 1 | Arête de longueur 0 |
| `isolated_vertex.obj` | 4 | 1 | Vertex sans arête incidente |

**Tests attendus** :
- ⚠️ Détecter et cleanup les éléments dégénérés
- ❌ Ou refuser le chargement avec message explicite

---

### 4. Polygonal (4 meshes)

Faces polygonales (non-triangulaires) pour tester le support générique.

| Fichier | Vertices | Faces | Description |
|---------|----------|-------|-------------|
| `pentagon.obj` | 5 | 1 | Pentagone (5 côtés) |
| `hexagon.obj` | 6 | 1 | Hexagone (6 côtés) |
| `quad_strip.obj` | 8 | 3 | Bande de 3 quads |
| `mixed_valence.obj` | 12 | 3 | Mix triangle/quad/pentagon |

**Tests attendus** :
- ✅ Chargement OK (faces polygonales)
- ⚠️ Collapse réduit la valence (pentagon → quad → triangle)
- ✅ Pas de dégénérescence des faces

---

## 🧪 Utilisation

### Chargement dans l'UI

1. Lancer le serveur : `npm run dev`
2. Activer le mode **Compression**
3. Cliquer sur **📁 Load** et sélectionner un fichier de test
4. Tester la simplification avec **⚡ Simplify**

### Tests unitaires Rust

```bash
cd crates/polylab-compression
cargo test
```

### Visualisation manuelle

```bash
# Voir la structure d'un fichier
cat test-assets/compression/manifold_simple/triangle.obj

# Compter vertices/faces
grep "^v " triangle.obj | wc -l  # vertices
grep "^f " triangle.obj | wc -l  # faces
```

---

## 📊 Matrice de Validation

| Mesh | Charge | Simplify | Robustesse | Notes |
|------|--------|----------|------------|-------|
| triangle | ✅ | ✅ | ✅ | Baseline |
| quad | ✅ | ⏳ | ⏳ | À tester |
| two_triangles | ✅ | ⏳ | ⏳ | À tester |
| cube_tris | ✅ | ⏳ | ⏳ | À tester |
| cube_quads | ✅ | ⏳ | ⏳ | À tester |
| sphere_low | ✅ | ⏳ | ⏳ | À tester |
| t_junction | ✅ | ❌ | ❌ | Collapse DOIT échouer |
| pinch_point | ✅ | ⚠️ | ⚠️ | Validation needed |
| open_surface | ✅ | ⚠️ | ⚠️ | Gérer les bords |
| multiple_holes | ✅ | ⚠️ | ⚠️ | Ne pas changer genre |
| wing_edge | ✅ | ⏳ | ⏳ | À tester |
| zero_area_face | ⚠️ | ❌ | ❌ | Cleanup requis |
| zero_length_edge | ⚠️ | ❌ | ❌ | Cleanup requis |
| isolated_vertex | ✅ | ⏳ | ⏳ | Ignorer v isolé |
| pentagon | ✅ | ⏳ | ⏳ | À tester |
| hexagon | ✅ | ⏳ | ⏳ | À tester |
| quad_strip | ✅ | ⏳ | ⏳ | À tester |
| mixed_valence | ✅ | ⏳ | ⏳ | À tester |

**Légende** :
- ✅ : Fonctionne correctement
- ⏳ : À tester
- ⚠️ : Fonctionne mais validation requise
- ❌ : Ne fonctionne pas (comportement attendu)

---

## 🔄 Régénération

Pour régénérer tous les maillages :

```bash
python3 scripts/generate_test_meshes.py
```

Cela écrasera les fichiers existants.

---

## 📝 Notes Techniques

### Format OBJ

- **Vertices** : `v x y z` (indexé à partir de 1 dans les faces)
- **Faces** : `f v1 v2 v3 [v4 v5 ...]` (N vertices pour N-gone)
- **Triangles** : 3 indices
- **Quads** : 4 indices
- **Polygones** : N indices (N ≥ 3)

### Conventions

- **Orientation** : Counter-clockwise (CCW) pour les faces
- **Coordonnées** : Toutes les meshes en Z=0 ou Z proche de 0
- **Échelle** : Vertices dans [-5, 5] généralement

---

**Dernière mise à jour** : 9 juin 2026
