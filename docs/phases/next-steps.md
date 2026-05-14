# 📝 Prochaines étapes - Session suivante

**Date de dernière mise à jour** : 14 mai 2026

---

## ✅ Où nous en sommes

### Phase 1.1 complétée avec succès ! 🎉
- Triangle RGB s'affiche correctement dans le navigateur (Chrome 146)
- WebGPU fonctionne après migration wgpu 29.0
- Architecture Rust/WASM opérationnelle
- Pipeline de build automatisé avec wasm-pack

### Iteration 1.1.5 : Refactorisation - ✅ COMPLÉTÉE
**Code refactorisé** :
- ✅ `webgpu_context.rs` créé - Init WebGPU isolée
- ✅ `constants.rs` créé - Valeurs centralisées
- ✅ `renderer.rs` simplifié (~70 lignes vs 160)
- ✅ Documentation concise ajoutée partout (lib.rs, pipeline.rs, shaders.wgsl)

**Arborescence réorganisée** :
- ✅ `docs/` structuré : `project/` et `phases/`
- ✅ `scripts/` créé pour scripts de lancement
- ✅ `code/` regroupe crates/ et app/
- ✅ Cargo.toml reste à la racine (convention Rust)

### Iteration 1.1.8 : Support Desktop - ✅ COMPLÉTÉE
**Dual-platform support** :
- ✅ Nouveau crate `polylab-desktop` créé
- ✅ winit 0.30 + ApplicationHandler pattern implémenté
- ✅ `webgpu_context::new_native()` pour création de surface native
- ✅ `renderer::new_native()` pour constructeur desktop
- ✅ Compilation conditionnelle (#[cfg]) pour WASM vs native
- ✅ Scripts séparés : `run-web-app.sh` et `run-desktop-app.sh`
- ✅ Triangle s'affiche dans fenêtre 800×600 (macOS Metal backend)

---

## 🎯 Prochaine session

### 📦 Phase 1.2 : Chargement de mesh .obj (Iteration 1.2.1)
**Objectif** : Charger et afficher un mesh 3D simple au lieu du triangle hardcodé

**Pourquoi maintenant** : Infrastructure dual-platform en place, prêt pour données 3D réelles

#### Tâches prioritaires

1. **Ajouter dépendances native**
   ```toml
   # Dans polylab-viewer/Cargo.toml
   [target.'cfg(not(target_arch = "wasm32"))'.dependencies]
   winit = "0.30"
   pollster = "0.3"  # Déjà présent
   env_logger = "0.11"
   ```

2. **Créer point d'entrée desktop**
   - Option A : Utiliser crate `sandbox` existant
   - Option B : Nouveau crate `polylab-desktop`
   - Implémenter `main.rs` avec winit event loop

3. **Adapter la création de surface**
   ```rust
   // Dans renderer.rs - séparer WASM vs native
   #[cfg(target_arch = "wasm32")]
   pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
       // Existing WASM code
   }
   
   #[cfg(not(target_arch = "wasm32"))]
   pub async fn new(window: Arc<winit::window::Window>) -> Result<Self, String> {
       // Native code using winit
   }
   ```

4. **Adapter Instance backends**
   ```rust
   #[cfg(target_arch = "wasm32")]
   instance_desc.backends = wgpu::Backends::BROWSER_WEBGPU;
   
   #[cfg(not(target_arch = "wasm32"))]
   instance_desc.backends = wgpu::Backends::PRIMARY; // Vulkan, Metal, DX12
   ```

5. **Tester les deux targets**
   ```bash
   # Native
   cargo run --release
   
   # WASM
   cd crates/polylab-viewer && wasm-pack build --target web --dev
   ```

**Fichiers à créer/modifier** :
- `code/crates/sandbox/src/main.rs` (nouveau - entry point desktop)
- `code/crates/sandbox/Cargo.toml` (ajouter winit dependency)
- `code/crates/polylab-viewer/src/webgpu_context.rs` (conditional compilation)
- `code/crates/polylab-viewer/src/renderer.rs` (adapter pour WASM et native)

**Livrable** : Application qui fonctionne à la fois en desktop et en web, même code de rendu

---

### 📦 Après Desktop : Mesh .obj (Iteration 1.2)
**Objectif** : Afficher un vrai mesh 3D

#### Tâches (détails à planifier plus tard)
- Parser fichier .obj (utiliser crate `tobj` ?)
- Créer vertex buffer WebGPU
- Implémenter caméra 3D
- Shaders avec matrices MVP
- Rotation interactive

**Note** : Ne pas commencer avant d'avoir fait le support desktop !

---

## 🛠️ Outils et commandes utiles

### Build WASM
```bash
cd code/crates/polylab-viewer
wasm-pack build --target web --dev
```

### Run dev server (WASM)
```bash
cd code/app/web
npm run dev
# Puis ouvrir http://localhost:5173 en navigation privée
```

### Build natif (après Phase 1.1.8)
```bash
cargo build --release
cargo run
```

### Check compilation
```bash
cargo check  # Native
cargo check --target wasm32-unknown-unknown  # WASM
```

---

## 📚 Ressources importantes

### Documentation wgpu 29
- [wgpu docs.rs](https://docs.rs/wgpu/29.0.0/wgpu/)
- [wgpu examples](https://github.com/gfx-rs/wgpu/tree/trunk/examples)

### winit pour desktop
- [winit docs](https://docs.rs/winit/0.30.0/winit/)
- [winit + wgpu example](https://github.com/gfx-rs/wgpu/blob/trunk/examples/common/src/lib.rs)

### Architecture actuelle
- Voir `ARCHITECTURE.md` pour comprendre la structure
- Voir `VISION.md` pour objectifs long terme

---

## ⚠️ Points d'attention

1. **Ne pas oublier** : face culling désactivé (`cull_mode: None`) pour debug, à réactiver plus tard
2. **Browser cache** : Toujours utiliser navigation privée ou Cmd+Shift+R
3. **wgpu version** : Garder 29.0+ pour compatibilité Chrome 135+
4. **rust-analyzer** : Config dans `.vscode/settings.json` pour WASM target

---

## 🤔 Questions à se poser pour Session A

- Est-ce qu'on garde `ViewerHandle` ou on renomme ?
- Est-ce qu'on veut un système de logging unifié (WASM + native) ?
- Est-ce qu'on crée un module `error.rs` dédié ?
- Est-ce qu'on extrait les shaders dans un module séparé ?

---

**Prêt à reprendre quand tu veux ! 🚀**
