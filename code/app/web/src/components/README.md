# UI Components Architecture

This directory contains the modular UI components for the PolyLab web application.

## Component Structure

Each component follows the `UIComponent` interface defined in `../types/ui.types.ts`:

```typescript
interface UIComponent {
    element: HTMLElement;
    render(): void;
    destroy(): void;
}
```

## Components

### Header.ts
Top navigation bar with:
- Logo and title
- Theme toggle button
- Help button
- Settings/GitHub button

### Toolbar.ts
Action toolbar with:
- Load button
- Rotate button
- Screenshot button
- Measure button
- Settings button
- Drag & drop zone for .obj files

### MeshPanel.ts (Left sidebar)
Mesh management panel:
- List of loaded meshes
- Checkbox to show/hide each mesh
- "Add Mesh" button

### DetailsPanel.ts (Right sidebar)
Mesh details display:
- Vertices count
- Triangles count
- Size X, Y, Z dimensions

### StatusBar.ts (Bottom bar)
Status information:
- Current status message
- WebGPU backend info
- FPS counter

### ViewerCanvas.ts (Center)
WebGPU canvas wrapper:
- Manages the canvas element
- Provides resize functionality
- Canvas reference for WASM viewer

## Usage

```typescript
import { Header } from './components/Header';

const header = new Header();
document.body.appendChild(header.element);

// Update component
header.render();

// Clean up
header.destroy();
```

## Event Handling

All button clicks are currently mocked with `console.log()` statements for easy debugging. Real implementations will be added progressively in future phases.

## Styling

Each component has a corresponding CSS file in `../styles/`:
- `header.css`
- `toolbar.css`
- `panels.css`
- `statusbar.css`
