/**
 * Layout Manager
 * 
 * Generic system for managing dynamic view layouts in projects.
 * Allows projects to switch between different visualization modes (scene, stereo, grid, etc.)
 * with clean teardown and setup of canvases and containers.
 */

import { appLogger } from '../utils/logger';

export type LayoutConfig = {
    id: string;
    title: string;
    setup: (container: HTMLElement) => Promise<void> | void;
    cleanup?: () => Promise<void> | void;
};

export class LayoutManager {
    private container: HTMLElement;
    private currentLayout: string | null = null;
    private layouts: Map<string, LayoutConfig> = new Map();
    private originalCanvas: HTMLCanvasElement | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        
        // Save the original CANVAS element (not clone it!)
        // This is critical for WebGPU/WASM viewer which needs the same canvas instance
        this.originalCanvas = container.querySelector('canvas');
        
        appLogger.info('[LayoutManager] Initialized', { 
            hasCanvas: !!this.originalCanvas,
            canvasId: this.originalCanvas?.id 
        });
    }

    /**
     * Register a layout configuration
     */
    registerLayout(config: LayoutConfig): void {
        this.layouts.set(config.id, config);
        appLogger.debug(`[LayoutManager] Registered layout: ${config.id}`);
    }

    /**
     * Switch to a specific layout
     */
    async switchLayout(layoutId: string): Promise<void> {
        const config = this.layouts.get(layoutId);
        if (!config) {
            throw new Error(`Layout not found: ${layoutId}`);
        }

        appLogger.info(`[LayoutManager] Switching to layout: ${layoutId}`);

        // Cleanup current layout if exists
        if (this.currentLayout) {
            const currentConfig = this.layouts.get(this.currentLayout);
            if (currentConfig?.cleanup) {
                appLogger.debug(`[LayoutManager] Cleaning up layout: ${this.currentLayout}`);
                await currentConfig.cleanup();
            }
        }

        // Clear container
        this.container.innerHTML = '';

        // Setup new layout
        appLogger.debug(`[LayoutManager] Setting up layout: ${layoutId}`);
        await config.setup(this.container);

        this.currentLayout = layoutId;
        appLogger.info(`[LayoutManager] Layout switched to: ${layoutId}`);
    }

    /**
     * Restore original container content
     */
    async restoreOriginal(): Promise<void> {
        appLogger.info('[LayoutManager] Restoring original content');

        // Cleanup current layout
        if (this.currentLayout) {
            const currentConfig = this.layouts.get(this.currentLayout);
            if (currentConfig?.cleanup) {
                await currentConfig.cleanup();
            }
        }

        // Restore the original canvas
        // CRITICAL: We restore the SAME canvas instance, not a clone
        // This is required for WebGPU/WASM viewer to keep working
        if (this.originalCanvas) {
            this.container.innerHTML = '';
            this.container.appendChild(this.originalCanvas);
            
            // Reset container styles that might have been modified
            this.container.style.display = '';
            this.container.style.gridTemplateColumns = '';
            this.container.style.gridTemplateRows = '';
            this.container.style.gap = '';
            
            appLogger.debug('[LayoutManager] Original canvas restored', { 
                canvasId: this.originalCanvas.id 
            });
        }

        this.currentLayout = null;
        appLogger.info('[LayoutManager] Original content restored');
    }

    /**
     * Get current active layout ID
     */
    getCurrentLayout(): string | null {
        return this.currentLayout;
    }

    /**
     * Check if a specific layout is currently active
     */
    isLayoutActive(layoutId: string): boolean {
        return this.currentLayout === layoutId;
    }

    /**
     * Clear all layouts and restore to original state
     */
    async destroy(): Promise<void> {
        appLogger.info('[LayoutManager] Destroying layout manager');
        await this.restoreOriginal();
        this.layouts.clear();
    }
}
