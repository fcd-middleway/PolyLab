import type { UIComponent } from '../types/ui.types';
import { setupDropZone } from '../utils/meshLoader';

/**
 * File Toolbar Component
 * 
 * Handles file operations: load OBJ, export/import scene
 */
export class FileToolbar implements UIComponent {
    element: HTMLElement;
    
    private dropZoneElement: HTMLElement | null = null;
    private exportButton: HTMLButtonElement | null = null;
    private importButton: HTMLButtonElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    private importFileInput: HTMLInputElement | null = null;
    private dropZoneConfigured: boolean = false;
    
    // Callbacks
    private onFileLoad: ((content: string, filename: string) => Promise<void>) | null = null;
    private onFileError: ((error: string) => void) | null = null;
    private onExportScene: (() => void) | null = null;
    private onImportScene: ((bytes: Uint8Array) => void) | null = null;

    constructor() {
        this.element = this.createElement();
        this.setupFileSection();
    }

    /**
     * Create the file toolbar section
     */
    private createElement(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'toolbar-section toolbar-section-file';
        section.id = 'toolbar-section-file';
        return section;
    }

    /**
     * Setup file section: drop zone + export + import buttons
     */
    private setupFileSection(): void {
        // Create drop zone
        this.dropZoneElement = document.createElement('div');
        this.dropZoneElement.className = 'drop-zone';
        this.dropZoneElement.id = 'drop-zone';
        this.dropZoneElement.innerHTML = `
            <span class="drop-zone-icon">📁</span>
            <span class="drop-zone-text">Drag & drop or click to browse</span>
        `;
        this.element.appendChild(this.dropZoneElement);

        // Create file input (hidden)
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.obj';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // Click to open file picker
        this.dropZoneElement.addEventListener('click', (e) => {
            e.stopPropagation();
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

        // Create export button
        this.exportButton = document.createElement('button');
        this.exportButton.className = 'toolbar-btn';
        this.exportButton.id = 'export-scene-btn';
        this.exportButton.disabled = true;
        this.exportButton.title = 'Export Scene';
        this.exportButton.innerHTML = `
            <span class="icon">💾</span>
            <span class="label">Export Scene</span>
        `;
        this.element.appendChild(this.exportButton);
        
        // Create import button
        this.importButton = document.createElement('button');
        this.importButton.className = 'toolbar-btn';
        this.importButton.id = 'import-scene-btn';
        this.importButton.disabled = true;
        this.importButton.title = 'Import Scene (.pls)';
        this.importButton.innerHTML = `
            <span class="icon">📂</span>
            <span class="label">Import Scene</span>
        `;
        this.element.appendChild(this.importButton);
        
        // Create import file input (hidden)
        this.importFileInput = document.createElement('input');
        this.importFileInput.type = 'file';
        this.importFileInput.accept = '.pls';
        this.importFileInput.style.display = 'none';
        document.body.appendChild(this.importFileInput);
        
        // Click import button to open file picker
        this.importButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.importFileInput?.click();
        });
        
        // Import file input change handler
        this.importFileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file && this.onImportScene) {
                file.arrayBuffer()
                    .then(buffer => this.onImportScene!(new Uint8Array(buffer)))
                    .catch(error => console.error('Import failed:', error));
            }
            // Reset input for next selection
            target.value = '';
        });
    }

    /**
     * Configure file callbacks
     */
    public configure(callbacks: {
        onLoad?: (content: string, filename: string) => Promise<void>;
        onError?: (error: string) => void;
        onExport?: () => void;
        onImport?: (bytes: Uint8Array) => void;
    }): void {
        // Update callbacks
        if (callbacks.onLoad !== undefined) {
            this.onFileLoad = callbacks.onLoad;
        }
        if (callbacks.onError !== undefined) {
            this.onFileError = callbacks.onError;
        }
        if (callbacks.onExport !== undefined) {
            this.onExportScene = callbacks.onExport;
        }
        if (callbacks.onImport !== undefined) {
            this.onImportScene = callbacks.onImport;
        }
        
        // Setup drop zone with callbacks ONLY if not already configured
        // Use wrapper functions that reference this.onFileLoad and this.onFileError
        // so that callback updates are always used (not captured in closure)
        if (!this.dropZoneConfigured && this.dropZoneElement) {
            const loadWrapper = async (content: string, filename: string) => {
                if (this.onFileLoad) {
                    await this.onFileLoad(content, filename);
                }
            };
            const errorWrapper = (error: string) => {
                if (this.onFileError) {
                    this.onFileError(error);
                }
            };
            setupDropZone(this.dropZoneElement, loadWrapper, errorWrapper);
            this.dropZoneConfigured = true;
        }
        
        // Enable export button if callback provided
        if (this.exportButton && this.onExportScene) {
            this.exportButton.disabled = false;
            // Clone button to remove all existing listeners
            const oldButton = this.exportButton;
            const newButton = oldButton.cloneNode(true) as HTMLButtonElement;
            oldButton.parentNode?.replaceChild(newButton, oldButton);
            this.exportButton = newButton;
            
            // Add new listener
            this.exportButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onExportScene?.();
            });
        }
        
        // Enable import button if callback provided
        if (this.importButton && this.onImportScene) {
            this.importButton.disabled = false;
        }
    }

    render(): void {
        // Toolbar renders itself during construction
    }

    destroy(): void {
        // TODO: MEMORY LEAK - Remove event listeners before removing elements
        // fileInput has 'change' listener (line ~68)
        // importFileInput has 'change' listener (line ~118)
        // Should explicitly removeEventListener before remove()
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }
        if (this.importFileInput) {
            this.importFileInput.remove();
            this.importFileInput = null;
        }
        this.element.remove();
    }
}
