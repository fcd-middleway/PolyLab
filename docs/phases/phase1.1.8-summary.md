# 🖥️ Phase 1.1.8 - Desktop Native Support

**Date**: 14 mai 2026  
**Status**: ✅ Complétée  
**Durée**: ~2 heures

---

## 🎯 Objectif

Permettre à PolyLab de compiler et s'exécuter en tant qu'application native desktop (en plus de la version WASM/web), en utilisant le même code de rendu pour les deux plateformes.

**Rationale**: Ajouter le support desktop tôt évite l'accumulation de problèmes platform-specific et facilite le debugging (meilleur accès aux logs, validation API, etc.)

---

## ✅ Résultats

### Architecture mise en place

**Nouveau crate**: `polylab-desktop` (binaire)
- Point d'entrée: `main.rs` avec winit event loop
- Dependencies: winit 0.30, pollster 0.3, env_logger 0.11, wgpu 29.0
- Pattern: `ApplicationHandler` de winit 0.30 (nouveau API)

**Modifications de `polylab-viewer`** (bibliothèque)
- Modules exposés pour les deux targets (suppression des `#[cfg(target_arch = "wasm32")]`)
- Dual constructors:
  - `Renderer::new(canvas)` pour WASM
  - `Renderer::new_native(window)` pour desktop
  - Idem pour `WebGpuContext`
- Backend adaptatif:
  - WASM: `Backends::BROWSER_WEBGPU`
  - Native: `Backends::PRIMARY` (Vulkan/Metal/DX12)

**Scripts de lancement**
- `scripts/run-web-app.sh` (ancien run-phase1.sh renommé)
- `scripts/run-desktop-app.sh` (nouveau)

---

## 🔨 Implémentation technique

### Structure du main.rs desktop

```rust
struct App {
    window: Option<Arc<Window>>,
    viewer: Option<AppViewer>,
}

struct AppViewer {
    renderer: polylab_viewer::Renderer,
    pipeline: wgpu::RenderPipeline,
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        // Create window 800x600
        // Init viewer with pollster::block_on
    }
    
    fn window_event(&mut self, event_loop: &ActiveEventLoop, _, event: WindowEvent) {
        match event {
            WindowEvent::RedrawRequested => { /* render */ },
            WindowEvent::CloseRequested => { event_loop.exit() },
            WindowEvent::Resized(size) => { /* resize surface */ },
            _ => {}
        }
    }
}
```

### Pattern de compilation conditionnelle

```rust
// Dans lib.rs - Modules accessibles aux deux targets
mod constants;
mod webgpu_context;
mod pipeline;
mod renderer;

pub use pipeline::create_render_pipeline;
pub use renderer::Renderer;

// Exports WASM uniquement
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct ViewerHandle { /* ... */ }
```

```rust
// Dans webgpu_context.rs - Dual méthodes
#[cfg(target_arch = "wasm32")]
pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
    instance_desc.backends = wgpu::Backends::BROWSER_WEBGPU;
    // Surface depuis canvas
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn new_native(window: Arc<winit::window::Window>) -> Result<Self, String> {
    instance_desc.backends = wgpu::Backends::PRIMARY;
    let surface = instance.create_surface(window.clone())?;
    // Reste identique
}
```

---

## 📊 Tests et validation

### Compilation desktop
```bash
cargo check --bin polylab-desktop
✅ Réussi en 0.54s
```

### Exécution desktop
```bash
cargo run --bin polylab-desktop
✅ Fenêtre 800×600 affichée avec triangle RGB
✅ Logs: "Renderer initialized successfully!"
✅ Backend: Metal (macOS)
```

### Compilation WASM (non-régression)
```bash
wasm-pack build --target web --out-dir ../../web-app/public/wasm code/crates/polylab-viewer
✅ Réussi en 57.34s
✅ Fichiers générés: polylab_viewer_bg.wasm, polylab_viewer.js
```

---

## 📦 Livrables

- ✅ Code: 3 fichiers créés, 4 fichiers modifiés
  - Créés: `polylab-desktop/Cargo.toml`, `polylab-desktop/src/main.rs`, `scripts/run-desktop-app.sh`
  - Modifiés: `polylab-viewer/lib.rs`, `polylab-viewer/Cargo.toml`, `polylab-viewer/src/webgpu_context.rs`, `polylab-viewer/src/renderer.rs`
  - Renommé: `run-phase1.sh` → `run-web-app.sh`
  
- ✅ Documentation:
  - `README.md` mis à jour avec les deux scripts
  - `docs/phases/next-steps.md` marqué iteration 1.1.8 complétée
  - `docs/project/ROADMAP.md` statut mis à jour

- ✅ Tests:
  - Compilation desktop validée (cargo check + cargo run)
  - Compilation WASM validée (wasm-pack build)
  - Triangle affiché correctement sur les deux plateformes

---

## 🎓 Leçons apprises

1. **Pattern winit 0.30**: ApplicationHandler remplace l'ancien Event<T> match
   - `resumed()` pour création de window (supporte mobile suspend/resume)
   - `window_event()` pour les événements de fenêtre
   - `ControlFlow::Poll` pour rendu continu

2. **Dual constructors vs generic**: Choix de méthodes séparées (`new()` / `new_native()`)
   - Plus explicite que des types génériques complexes
   - Facilite la lecture du code et le debugging
   - Évite les trait bounds compliqués

3. **Module visibility**: Important de retirer les `#[cfg]` des déclarations de modules
   - Les modules doivent être compilés pour les deux targets
   - Seuls les exports publics spécifiques doivent être gardés

4. **wgpu dependency**: Doit être ajoutée à polylab-desktop en plus de polylab-viewer
   - Pour accéder au type `wgpu::RenderPipeline` dans main.rs
   - Évite les erreurs "unresolved module or crate"

---

## 🔜 Prochaine étape suggérée

**Phase 1.2: Chargement de mesh .obj**
- Remplacer le triangle hardcodé par un vrai mesh 3D
- Charger un fichier .obj simple (cube, teapot)
- Créer vertex/index buffers
- Ajouter transformations MVP (Model-View-Projection)
- Permettre rotation caméra

Infrastructure dual-platform maintenant en place pour tester facilement sur web et desktop!
