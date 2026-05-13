# Phase 1.1 - WebGPU Hello World

This phase implements a basic triangle renderer using WebGPU from Rust (compiled to WebAssembly).

## 🎯 Goal

Display a colored triangle on screen using:
- Rust + wgpu (WebGPU)
- Compiled to WebAssembly
- Rendered in a web browser

## 🔧 Prerequisites

1. **Rust WASM target**
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

2. **wasm-pack** (build tool)
   ```bash
   curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
   ```

3. **Node.js** (for the web app)
   - Already installed ✅

## 🚀 Build & Run

### Step 1: Build the Rust viewer to WASM

```bash
cd crates/polylab-viewer
wasm-pack build --target web --dev
```

This creates:
- `pkg/polylab_viewer.js`
- `pkg/polylab_viewer_bg.wasm`
- `pkg/polylab_viewer.d.ts`

### Step 2: Update the import path in main.ts

After building, the import path should already be correct in `app/web/src/main.ts`:

```typescript
// Import WASM module from pkg/
const wasmModule = await import('../../../crates/polylab-viewer/pkg/polylab_viewer.js');

// Create viewer using create() method
const viewer = await wasmModule.ViewerHandle.create('webgpu-canvas');
```

### Step 3: Launch the web app

```bash
cd app/web
npm install  # if not done already
npm run dev
```

### Step 4: Open in browser

Open http://localhost:5173

You should see a **colored triangle** (red/green/blue gradient)!

## 🧪 What you should see

- Dark gray background
- Triangle with RGB gradient at vertices
- Smooth color interpolation across the triangle
- "✅ Rendering!" status message

## 🐛 Troubleshooting

### "WebGPU is not supported"

**Solution**: Use a recent browser:
- Chrome/Edge 113+ (WebGPU enabled by default)
- Firefox Nightly with `dom.webgpu.enabled` flag
- Safari Technology Preview (partial support)

### Build errors with wgpu

**Solution**: Make sure you're building for WASM target:
```bash
rustup target add wasm32-unknown-unknown
```

### Import errors in main.ts

**Solution**: Check the path to the WASM module matches where `wasm-pack` generated files:
```typescript
// Should point to: crates/polylab-viewer/pkg/
```

### Canvas not rendering

**Check**:
1. Canvas ID matches in HTML and Rust: `webgpu-canvas`
2. Browser console for errors
3. Network tab shows `.wasm` file loaded

## 📁 Files created in this phase

```
crates/polylab-viewer/src/
├── lib.rs            # WASM API exports
├── renderer.rs       # WebGPU context & render loop
├── pipeline.rs       # Render pipeline creation
└── shaders.wgsl      # Vertex + fragment shaders

app/web/
├── index.html        # Canvas element
└── src/main.ts       # WASM loader + animation loop
```

## 🎓 What's happening

1. **Rust code** creates WebGPU context from canvas
2. **Shaders** (WGSL) define triangle vertices and colors
3. **Pipeline** connects shaders to GPU
4. **Render loop** draws triangle 60 times per second
5. **WASM** lets JavaScript call Rust functions

## ✅ Success criteria

- ✅ Triangle visible on screen
- ✅ Colors interpolated (red → green → blue)
- ✅ No console errors
- ✅ Smooth rendering (60 FPS)

## 🔜 Next: Phase 1.2

Load and display a real 3D mesh (.obj file) instead of hardcoded triangle.
