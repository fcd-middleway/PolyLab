import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction } from '../core/types';
import { createFileInput, setupDropZone } from '../utils/meshLoader';

/**
 * Toolbar component - Sectioned action buttons bar
 * 
 * Structure:
 * [FILE Section (common)] | [VIEW Section (common)] | [MODE Section (specific)]
 */
export class Toolbar implements UIComponent {
    element: HTMLElement;
    
    // Section containers
    private fileSectionElement: HTMLElement | null = null;
    private viewSectionElement: HTMLElement | null = null;
    private modeSectionElement: HTMLElement | null = null;
    
    // FILE section elements
    private dropZoneElement: HTMLElement | null = null;
    private exportButton: HTMLButtonElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    
    // VIEW section elements
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
    private onFileLoad: ((content: string, filename: string) => void) | null = null;
    private onFileError: ((error: Error) => void) | null = null;
    private onExportScene: (() => void) | null = null;
    private onResetCamera: (() => void) | null = null;
    private onCenterMesh: (() => void) | null = null;
    private onRenderModeChange: ((modes: { solid: boolean; wireframe: boolean; vertices: boolean }) => void) | null = null;

    constructor() {
        this.element = this.createElement();
        this.setupCommonSections();
    }

    /**
     * Create the base toolbar structure with 3 sections
     */
    private createElement(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';

        toolbar.innerHTML = `
            <!-- FILE Section (common to all modes) -->
            <div class="toolbar-section toolbar-section-file" id="toolbar-section-file">
                <!-- Drop zone and export button will be added here -->
            </div>
            
            <div class="toolbar-divider"></div>
            
            <!-- VIEW Section (common to all modes) -->
            <div class="toolbar-section toolbar-section-view" id="toolbar-section-view">
                <!-- Camera and render mode buttons will be added here -->
            </div>
            
            <div class="toolbar-divider"></div>
            
            <!-- MODE Section (specific to each mode) -->
            <div class="toolbar-section toolbar-section-mode" id="toolbar-section-mode">
                <!-- Mode-specific buttons will be added here -->
            </div>
        `;

        this.fileSectionElement = toolbar.querySelector('#toolbar-section-file');
        this.viewSectionElement = toolbar.querySelector('#toolbar-section-view');
        this.modeSectionElement = toolbar.querySelector('#toolbar-section-mode');

        return toolbar;
    }

    /**
     * Setup FILE and VIEW sections (common to all modes)
     * Called once during construction
     */
    private setupCommonSections(): void {
        this.setupFileSection();
        this.setupViewSection();
    }

    /**
     * Setup FILE section: drop zone + export button
     */
    private setupFileSection(): void {
        if (!this.fileSectionElement) return;

        // Create drop zone
        this.dropZoneElement = document.createElement('div');
        this.dropZoneElement.className = 'drop-zone';
        this.dropZoneElement.id = 'drop-zone';
        this.dropZoneElement.innerHTML = `
            <span class="drop-zone-icon">📁</span>
            <span class="drop-zone-text">Drag & drop or click to browse</span>
        `;
        this.fileSectionElement.appendChild(this.dropZoneElement);

        // Create file input (hidden)
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.obj';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // Click to open file picker
        this.dropZoneElement.addEventListener('click', () => {
            this.fileInput?.click();
        });

        // File input change handler
        this.fileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file && this.onFileLoad) {
                file.text()
                    .then(content => this.onFileLoad!(content, file.name))
                    .catch(error => this.onFileError?.(error));
            }
            // Reset input for next selection
            target.value = '';
        });

        // Create export button (disabled for now)
        this.exportButton = document.createElement('button');
        this.exportButton.className = 'toolbar-btn';
        this.exportButton.id = 'export-scene-btn';
        this.exportButton.disabled = true;
        this.exportButton.title = 'Export Scene (not implemented yet)';
        this.exportButton.innerHTML = `
            <span class="icon">💾</span>
            <span class="label">Export Scene</span>
        `;
        this.fileSectionElement.appendChild(this.exportButton);
    }

    /**
     * Setup VIEW section: camera controls + render mode toggles
     */
    private setupViewSection(): void {
        if (!this.viewSectionElement) return;

        // Reset Camera button (disabled for now)
        this.resetCameraButton = document.createElement('button');
        this.resetCameraButton.className = 'toolbar-btn';
        this.resetCameraButton.id = 'reset-camera-btn';
        this.resetCameraButton.disabled = true;
        this.resetCameraButton.title = 'Reset Camera (not implemented yet)';
        this.resetCameraButton.innerHTML = `
            <span class="icon">📷</span>
            <span class="label">Reset Camera</span>
        `;
        this.viewSectionElement.appendChild(this.resetCameraButton);

        // Center Mesh button (disabled for now)
        this.centerMeshButton = document.createElement('button');
        this.centerMeshButton.className = 'toolbar-btn';
        this.centerMeshButton.id = 'center-mesh-btn';
        this.centerMeshButton.disabled = true;
        this.centerMeshButton.title = 'Center Mesh (not implemented yet)';
        this.centerMeshButton.innerHTML = `
            <span class="icon">🎯</span>
            <span class="label">Center Mesh</span>
        `;
        this.viewSectionElement.appendChild(this.centerMeshButton);

        // Solid toggle button (active by default)
        this.solidButton = document.createElement('button');
        this.solidButton.className = 'toolbar-btn toolbar-btn-toggle active';
        this.solidButton.id = 'solid-btn';
        this.solidButton.title = 'Toggle Solid Rendering';
        this.solidButton.innerHTML = `
            <span class="icon">☑️</span>
            <span class="label">Solid</span>
        `;
        this.solidButton.addEventListener('click', () => this.toggleRenderMode('solid'));
        this.viewSectionElement.appendChild(this.solidButton);

        // Wireframe toggle button
        this.wireframeButton = document.createElement('button');
        this.wireframeButton.className = 'toolbar-btn toolbar-btn-toggle';
        this.wireframeButton.id = 'wireframe-btn';
        this.wireframeButton.title = 'Toggle Wireframe Rendering';
        this.wireframeButton.innerHTML = `
            <span class="icon">☐</span>
            <span class="label">Wireframe</span>
        `;
        this.wireframeButton.addEventListener('click', () => this.toggleRenderMode('wireframe'));
        this.viewSectionElement.appendChild(this.wireframeButton);

        // Vertices toggle button
        this.verticesButton = document.createElement('button');
        this.verticesButton.className = 'toolbar-btn toolbar-btn-toggle';
        this.verticesButton.id = 'vertices-btn';
        this.verticesButton.title = 'Toggle Vertices Rendering';
        this.verticesButton.innerHTML = `
            <span class="icon">☐</span>
            <span class="label">Vertices</span>
        `;
        this.verticesButton.addEventListener('click', () => this.toggleRenderMode('vertices'));
        this.viewSectionElement.appendChild(this.verticesButton);
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
     * Set MODE-specific actions (called when project changes)
     */
    public setModeActions(actions: ToolbarAction[]): void {
        if (!this.modeSectionElement) return;

        // Clear current mode-specific buttons
        this.modeSectionElement.innerHTML = '';

        // Create buttons for each action
        actions.forEach(action => {
            const button = document.createElement('button');
            button.className = 'toolbar-btn';
            button.id = `toolbar-${action.id}`;
            button.title = action.tooltip;
            button.disabled = action.enabled === false;

            button.innerHTML = `
                <span class="icon">${action.icon}</span>
                <span class="label">${action.tooltip}</span>
            `;

            button.addEventListener('click', () => {
                if (!button.disabled) {
                    action.action();
                }
            });

            this.modeSectionElement!.appendChild(button);
        });
    }

    /**
     * Configure FILE section callbacks
     */
    public configureFileCallbacks(callbacks: {
        onLoad: (content: string, filename: string) => void;
        onError?: (error: Error) => void;
        onExport?: () => void;
    }): void {
        this.onFileLoad = callbacks.onLoad;
        this.onFileError = callbacks.onError || null;
        this.onExportScene = callbacks.onExport || null;
        
        // Setup drop zone with callbacks
        if (this.dropZoneElement && this.onFileLoad && this.onFileError) {
            setupDropZone(this.dropZoneElement, this.onFileLoad, this.onFileError);
        }
        
        // Enable export button if callback provided
        if (this.exportButton && callbacks.onExport) {
            this.exportButton.disabled = false;
            this.exportButton.addEventListener('click', () => {
                this.onExportScene?.();
            });
        }
    }

    /**
     * Configure VIEW section callbacks
     */
    public configureViewCallbacks(callbacks: {
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
            this.resetCameraButton.addEventListener('click', () => {
                this.onResetCamera?.();
            });
        }
        
        // Enable center mesh button if callback provided
        if (this.centerMeshButton && callbacks.onCenterMesh) {
            this.centerMeshButton.disabled = false;
            this.centerMeshButton.addEventListener('click', () => {
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
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }
        this.element.remove();
    }
}
