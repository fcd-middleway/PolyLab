import type { UIComponent } from '../types/ui.types';

/**
 * View Toolbar Component
 * 
 * Handles view controls: camera, render modes
 */
export class ViewToolbar implements UIComponent {
    element: HTMLElement;
    
    private resetCameraButton: HTMLButtonElement | null = null;
    private centerMeshButton: HTMLButtonElement | null = null;
    private solidButton: HTMLButtonElement | null = null;
    private wireframeButton: HTMLButtonElement | null = null;
    private verticesButton: HTMLButtonElement | null = null;
    
    // State
    private renderModes = {
        solid: true,
        wireframe: false,
        vertices: false
    };
    
    // Callbacks
    private onResetCamera: (() => void) | null = null;
    private onCenterMesh: (() => void) | null = null;
    private onRenderModeChange: ((modes: { solid: boolean; wireframe: boolean; vertices: boolean }) => void) | null = null;

    constructor() {
        this.element = this.createElement();
        this.setupViewSection();
    }

    /**
     * Create the view toolbar section
     */
    private createElement(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'toolbar-section toolbar-section-view';
        section.id = 'toolbar-section-view';
        return section;
    }

    /**
     * Setup view section: camera controls + render mode toggles
     */
    private setupViewSection(): void {
        // Reset Camera button
        this.resetCameraButton = document.createElement('button');
        this.resetCameraButton.className = 'toolbar-btn';
        this.resetCameraButton.id = 'reset-camera-btn';
        this.resetCameraButton.disabled = true;
        this.resetCameraButton.title = 'Reset Camera';
        this.resetCameraButton.innerHTML = `
            <span class="icon">📷</span>
            <span class="label">Reset Camera</span>
        `;
        this.element.appendChild(this.resetCameraButton);

        // Center Mesh button
        this.centerMeshButton = document.createElement('button');
        this.centerMeshButton.className = 'toolbar-btn';
        this.centerMeshButton.id = 'center-mesh-btn';
        this.centerMeshButton.disabled = true;
        this.centerMeshButton.title = 'Center Mesh';
        this.centerMeshButton.innerHTML = `
            <span class="icon">🎯</span>
            <span class="label">Center Mesh</span>
        `;
        this.element.appendChild(this.centerMeshButton);

        // Solid toggle button (active by default)
        this.solidButton = document.createElement('button');
        this.solidButton.className = 'toolbar-btn toolbar-btn-toggle active';
        this.solidButton.id = 'solid-btn';
        this.solidButton.title = 'Toggle Solid Rendering';
        this.solidButton.innerHTML = `
            <span class="icon">☑️</span>
            <span class="label">Solid</span>
        `;
        // TODO: MEMORY LEAK - These 3 permanent listeners are never removed in destroy()
        // Consider storing bound functions or cloning buttons before destroy
        this.solidButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRenderMode('solid');
        });
        this.element.appendChild(this.solidButton);

        // Wireframe toggle button
        this.wireframeButton = document.createElement('button');
        this.wireframeButton.className = 'toolbar-btn toolbar-btn-toggle';
        this.wireframeButton.id = 'wireframe-btn';
        this.wireframeButton.title = 'Toggle Wireframe Rendering';
        this.wireframeButton.innerHTML = `
            <span class="icon">☐</span>
            <span class="label">Wireframe</span>
        `;
        this.wireframeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRenderMode('wireframe');
        });
        this.element.appendChild(this.wireframeButton);

        // Vertices toggle button
        this.verticesButton = document.createElement('button');
        this.verticesButton.className = 'toolbar-btn toolbar-btn-toggle';
        this.verticesButton.id = 'vertices-btn';
        this.verticesButton.title = 'Toggle Vertices Rendering';
        this.verticesButton.innerHTML = `
            <span class="icon">☐</span>
            <span class="label">Vertices</span>
        `;
        this.verticesButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRenderMode('vertices');
        });
        this.element.appendChild(this.verticesButton);
    }

    /**
     * Toggle a render mode (solid, wireframe, vertices)
     */
    private toggleRenderMode(mode: 'solid' | 'wireframe' | 'vertices'): void {
        this.renderModes[mode] = !this.renderModes[mode];
        
        // Update button visual state
        let button: HTMLButtonElement | null = null;
        let icon = '';
        
        switch (mode) {
            case 'solid':
                button = this.solidButton;
                icon = this.renderModes.solid ? '☑️' : '☐';
                break;
            case 'wireframe':
                button = this.wireframeButton;
                icon = this.renderModes.wireframe ? '☑️' : '☐';
                break;
            case 'vertices':
                button = this.verticesButton;
                icon = this.renderModes.vertices ? '☑️' : '☐';
                break;
        }
        
        if (button) {
            if (this.renderModes[mode]) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
            
            const iconSpan = button.querySelector('.icon');
            if (iconSpan) {
                iconSpan.textContent = icon;
            }
        }
        
        // Notify listener
        this.onRenderModeChange?.(this.renderModes);
    }

    /**
     * Configure view callbacks
     */
    public configure(callbacks: {
        onResetCamera?: () => void;
        onCenterMesh?: () => void;
        onRenderModeChange?: (modes: { solid: boolean; wireframe: boolean; vertices: boolean }) => void;
    }): void {
        this.onResetCamera = callbacks.onResetCamera || null;
        this.onCenterMesh = callbacks.onCenterMesh || null;
        this.onRenderModeChange = callbacks.onRenderModeChange || null;
        
        // Enable reset camera button if callback provided
        if (this.resetCameraButton && callbacks.onResetCamera) {
            this.resetCameraButton.disabled = false;
            // Clone button to remove all existing listeners
            const oldButton = this.resetCameraButton;
            const newButton = oldButton.cloneNode(true) as HTMLButtonElement;
            oldButton.parentNode?.replaceChild(newButton, oldButton);
            this.resetCameraButton = newButton;
            
            // Add new listener
            this.resetCameraButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onResetCamera?.();
            });
        }
        
        // Enable center mesh button if callback provided
        if (this.centerMeshButton && callbacks.onCenterMesh) {
            this.centerMeshButton.disabled = false;
            // Clone button to remove all existing listeners
            const oldButton = this.centerMeshButton;
            const newButton = oldButton.cloneNode(true) as HTMLButtonElement;
            oldButton.parentNode?.replaceChild(newButton, oldButton);
            this.centerMeshButton = newButton;
            
            // Add new listener
            this.centerMeshButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onCenterMesh?.();
            });
        }
    }

    /**
     * Get current render modes state
     */
    public getRenderModes(): { solid: boolean; wireframe: boolean; vertices: boolean } {
        return { ...this.renderModes };
    }

    render(): void {
        // Toolbar renders itself during construction
    }

    destroy(): void {
        // TODO: MEMORY LEAK - Remove event listeners from solidButton, wireframeButton, verticesButton
        // These 3 buttons have permanent click listeners that are never cleaned up
        // Should explicitly removeEventListener or use clone-and-replace pattern
        this.element.remove();
    }
}
