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
     * Helper method: Load mesh into viewer and update panels
     * 
     * Common mesh loading logic that can be reused by all projects.
     * Handles mesh ID generation, viewer loading, panel updates, and error handling.
     * 
     * @param content - OBJ file content
     * @param filename - Name of the file
     * @param options - Optional callbacks and configurations
     * @returns Mesh ID if successful, null if failed
     */
    protected async loadMeshHelper(
        content: string, 
        filename: string,
        options?: {
            scenePanel?: any;
            detailsPanel?: any;
            statusBar?: any;
            meshIdPrefix?: string;
            onSuccess?: (meshId: string, details: number[]) => void;
            onError?: (error: string) => void;
        }
    ): Promise<string | null> {
        try {
            const projectName = this.getName();
            appLogger.info(`[${projectName}] Loading mesh`, { filename, size: content.length });
            
            // Update status bar
            options?.statusBar?.updateStats({ status: `Loading ${filename}...` });
            
            // Generate unique mesh ID
            const meshId = `${options?.meshIdPrefix || 'mesh'}-${Date.now()}`;
            
            // Call WASM function to load mesh
            this.viewer.load_mesh(meshId, content);
            
            // Get detailed mesh info from viewer
            const details = this.viewer.mesh_details(meshId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
            
            // Add mesh to ScenePanel if provided
            if (options?.scenePanel) {
                options.scenePanel.addMesh({
                    id: meshId,
                    name: filename,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    visible: true
                });
            }
            
            // Update DetailsPanel if provided
            if (options?.detailsPanel) {
                options.detailsPanel.updateDetails({
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    sizeX,
                    sizeY,
                    sizeZ
                });
            }
            
            // Update status bar
            if (options?.statusBar) {
                options.statusBar.updateStats({ 
                    status: `✅ Loaded ${filename}`,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles)
                });
            }
            
            appLogger.info(`[${projectName}] Mesh loaded successfully`, { 
                meshId,
                filename, 
                vertices: Math.round(vertices), 
                triangles: Math.round(triangles)
            });
            
            // Call success callback if provided
            options?.onSuccess?.(meshId, details);
            
            return meshId;
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error(`[${this.getName()}] Failed to load mesh`, { filename, error: errorMsg });
            
            // Update status bar with error
            options?.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
            
            // Call error callback if provided
            options?.onError?.(errorMsg);
            
            return null;
        }
    }

    /**
     * Set project active state (managed by ProjectManager)
     */
    setActive(active: boolean): void {
        this.active = active;
    }
}
