# 🗂️ Réorganisation du projet - 13 mai 2026

## Contexte

Refactorisation de l'arborescence pour améliorer la clarté et la maintenabilité du projet.

---

## Nouvelle structure

```
PolyLab/
├── README.md                    # Documentation principale (racine)
├── Cargo.toml                   # Workspace Rust
├── docs/                        # 📚 Toute la documentation
│   ├── project/                 # Docs généraux du projet
│   │   ├── VISION.md
│   │   ├── ROADMAP.md
│   │   ├── PROJECTS.md
│   │   └── ARCHITECTURE.md
│   ├── phases/                  # Documentation par phase
│   │   ├── next-steps.md
│   │   └── phase1.1-summary.md
│   └── REORGANIZATION.md        # Ce fichier
├── scripts/                     # 🔧 Scripts utilitaires
│   └── run-phase1.sh           # Build et run Phase 1.1
└── code/                        # 💻 Tout le code source
    ├── crates/                  # Bibliothèques Rust
    │   ├── polylab-core/
    │   └── polylab-viewer/
    └── app/                     # Applications
        └── web/                 # App web TypeScript + Vite
```

---

## Changements effectués

### 1. Documentation consolidée (`docs/`)
- **Avant** : Fichiers .md éparpillés à la racine
- **Après** : Sous-dossiers thématiques
  - `docs/project/` : Vision, roadmap, architecture
  - `docs/phases/` : Documentation par itération

### 2. Scripts isolés (`scripts/`)
- **Avant** : `run-phase1.sh` à la racine
- **Après** : `scripts/run-phase1.sh` avec chemins mis à jour
- Le script se positionne automatiquement à la racine du projet

### 3. Code regroupé (`code/`)
- **Avant** : `crates/`, `app/` à la racine
- **Après** : Tout sous `code/`
- Sépare clairement documentation et code

---

## Fichiers modifiés

### Cargo.toml (workspace)
```diff
[workspace]
members = [
-    "crates/polylab-core",
-    "crates/polylab-viewer"
+    "code/crates/polylab-core",
+    "code/crates/polylab-viewer"
]
```

### scripts/run-phase1.sh
- Ajout de `cd "$(dirname "$0")/.."`pour naviguer vers la racine
- Chemins mis à jour : `code/crates/...`, `code/app/...`

### code/app/web/src/main.ts
```diff
- const wasmModule = await import('../../../crates/polylab-viewer/pkg/...');
+ const wasmModule = await import('../../crates/polylab-viewer/pkg/...');
```

### code/app/web/vite.config.ts
- `allow: ['../..']` reste valide (accès à `code/`)

---

## Commandes mises à jour

### Build WASM
```bash
# Avant
cd crates/polylab-viewer && wasm-pack build --target web --dev

# Après
cd code/crates/polylab-viewer && wasm-pack build --target web --dev
```

### Run dev server
```bash
# Avant
cd app/web && npm run dev

# Après
cd code/app/web && npm run dev
```

### Script automatisé (recommandé)
```bash
# Depuis n'importe où dans le projet
./scripts/run-phase1.sh
```

### Cargo workspace
```bash
# Toujours depuis la racine
cargo check
cargo build
cargo test
```

---

## Bénéfices

✅ **Clarté** : Structure logique (docs / scripts / code)  
✅ **Maintenabilité** : Facile de retrouver les fichiers  
✅ **Extensibilité** : Prêt pour ajouter plus de crates/apps  
✅ **Standards** : Séparation docs/code commune dans les projets

---

## Prochaines étapes

Cette réorganisation prépare le terrain pour :
- Phase 1.1.8 : Support desktop (native + WASM)
- Ajout de nouveaux modules (compression, rover, etc.)
- CI/CD plus simple avec scripts centralisés
