/**
 * Base class for all projects
 * 
 * Each project (Viewer, Perlin, Rover, etc.) extends this class
 * and provides its own configuration and behavior.
 */

import type { ProjectConfig } from './types';
import { appLogger } from '../utils/logger';

export abstract class BaseProject {
    protected viewer: any; // ViewerHandle from WASM
    protected active: boolean = false;

    /**
     * Get project unique identifier
     */
    abstract getId(): string;

    /**
     * Get project display name
     */
    abstract getName(): string;

    /**
     * Get project UI configuration
     * Defines menus, toolbar buttons, and panels
     */
    abstract getConfig(): ProjectConfig;

    /**
     * Initialize the project
     * Called when project is first loaded or switched to
     * 
     * @param viewer - The WebGPU viewer instance
     */
    abstract init(viewer: any): Promise<void>;

    /**
     * Update loop
     * Called every frame when project is active
     * 
     * @param deltaTime - Time elapsed since last frame (seconds)
     */
    abstract update(deltaTime: number): void;

    /**
     * Cleanup project resources
     * Called when switching to another project or closing
     */
    abstract cleanup(): void;

    /**
     * Called when project becomes active
     * Optional hook for additional activation logic
     */
    onActivate?(): void;

    /**
     * Called when project becomes inactive
     * Optional hook for deactivation logic
     */
    onDeactivate?(): void;

    /**
     * Check if project is currently active
     */
    isActive(): boolean {
        return this.active;
    }

    /**
     * Open file picker for loading mesh
     * Generic implementation available to all projects
     */
    protected openFilePicker(): void {
        appLogger.debug('[BaseProject] Opening file picker...');
        
        // Create temporary file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.obj';
        input.style.display = 'none';
        
        input.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            
            if (!file) return;
            
            try {
                appLogger.info('[BaseProject] Loading mesh file', { filename: file.name });
                const content = await file.text();
                await this.onMeshFileLoaded(content, file.name);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                appLogger.error('[BaseProject] Failed to load mesh', { error: errorMsg });
            } finally {
                // Clean up
                document.body.removeChild(input);
            }
        });
        
        document.body.appendChild(input);
        input.click();
    }

    /**
     * Called when a mesh file is loaded via file picker
     * Projects should override this to handle mesh loading
     * 
     * @param content - OBJ file content
     * @param filename - Name of the file
     */
    protected async onMeshFileLoaded(content: string, filename: string): Promise<void> {
        appLogger.warn('[BaseProject] onMeshFileLoaded not implemented - override in subclass');
    }

    /**
     * Set project active state (managed by ProjectManager)
     */
    setActive(active: boolean): void {
        this.active = active;
    }
}
