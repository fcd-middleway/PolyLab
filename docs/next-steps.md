# 📝 Prochaines étapes - Session suivante

**Date de dernière mise à jour** : 13 mai 2026

---

## ✅ Où nous en sommes

### Phase 1.1 complétée avec succès ! 🎉
- Triangle RGB s'affiche correctement dans le navigateur (Chrome 146)
- WebGPU fonctionne après migration wgpu 29.0
- Architecture Rust/WASM opérationnelle
- Pipeline de build automatisé avec wasm-pack

---

## 🎯 Prochaines sessions

### 🔧 Session A : Refactorisation (Iteration 1.1.5)
**Objectif** : Clarifier le code avant d'ajouter plus de fonctionnalités

#### Tâches prioritaires

1. **Restructurer `renderer.rs`**
   - Séparer l'initialisation WebGPU du rendu
   - Créer une méthode `initialize_webgpu()` dédiée
   - Isoler la logique de render pass dans une fonction
   - Améliorer les messages d'erreur

2. **Documenter les concepts WebGPU**
   - Ajouter des commentaires explicatifs sur :
     - Instance, Adapter, Device, Queue
     - Surface et SurfaceConfiguration
     - RenderPipeline et RenderPass
     - CurrentSurfaceTexture enum
   - Expliquer le flow de rendu dans le code

3. **Améliorer la gestion d'erreurs**
   - Créer un type d'erreur custom `RendererError`
   - Logging plus détaillé avec `web_sys::console`
   - Messages d'erreur user-friendly pour le JS

4. **Nettoyage du code**
   - Revoir les imports (éliminer unused)
   - Uniformiser le style de code
   - Ajouter des tests unitaires simples si possible

**Fichiers à modifier** :
- `crates/polylab-viewer/src/renderer.rs` (priorité haute)
- `crates/polylab-viewer/src/lib.rs` (améliorer API exports)
- `crates/polylab-viewer/src/pipeline.rs` (documenter options)

**Livrable** : Code plus lisible et maintenable, prêt pour ajout de features

---

### 🖥️ Session B : Support Desktop (Iteration 1.1.8)
**Objectif** : Permettre compilation native (pas seulement WASM)

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
- `crates/sandbox/src/main.rs` (nouveau - entry point desktop)
- `crates/sandbox/Cargo.toml` (ajouter winit dependency)
- `crates/polylab-viewer/src/renderer.rs` (conditional compilation)

**Livrable** : Application qui fonctionne à la fois en desktop et en web, même code de rendu

---

### 📦 Session C : Mesh .obj (Iteration 1.2)
**Objectif** : Afficher un vrai mesh 3D (après refactoring + desktop)

#### Tâches (détails à planifier plus tard)
- Parser fichier .obj (utiliser crate `tobj` ?)
- Créer vertex buffer WebGPU
- Implémenter caméra 3D
- Shaders avec matrices MVP
- Rotation interactive

**Note** : Ne pas commencer avant d'avoir fait les sessions A et B !

---

## 🛠️ Outils et commandes utiles

### Build WASM
```bash
cd crates/polylab-viewer
wasm-pack build --target web --dev
```

### Run dev server
```bash
cd app/web
npm run dev
# Puis ouvrir http://localhost:5173 en navigation privée
```

### Build natif (après Session B)
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
