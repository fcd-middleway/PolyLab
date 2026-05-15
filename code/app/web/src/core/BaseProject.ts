/**
 * Base class for all projects
 * 
 * Each project (Viewer, Perlin, Rover, etc.) extends this class
 * and provides its own configuration and behavior.
 */

import type { ProjectConfig } from './types';

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
     * Set project active state (managed by ProjectManager)
     */
    setActive(active: boolean): void {
        this.active = active;
    }
}
