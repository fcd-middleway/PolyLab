/**
 * Stereo Viewer Manager
 * 
 * Manages dual-camera stereo rendering for rover vision.
 * Creates and synchronizes left and right eye views.
 */

import type { ViewerHandle } from '../types/viewer.types';
import { uiLogger } from '../utils/logger';

export interface StereoConfig {
    /** Baseline distance between cameras in meters (default: 0.3m) */
    baseline: number;
    /** Canvas IDs for left and right views */
    leftCanvasId: string;
    rightCanvasId: string;
}

export class StereoViewerManager {
    private leftViewer: ViewerHandle | null = null;
    private rightViewer: ViewerHandle | null = null;
    private config: StereoConfig;
    private mainViewer: ViewerHandle | null = null;

    constructor(config: StereoConfig) {
        this.config = config;
        uiLogger.info(`StereoViewerManager created with baseline: ${config.baseline}m`);
    }

    /**
     * Initialize stereo viewers
     * 
     * @param mainViewer - The main viewer to synchronize with
     */
    async init(mainViewer: ViewerHandle): Promise<void> {
        this.mainViewer = mainViewer;

        // Configure stereo baseline on main viewer
        mainViewer.set_stereo_baseline(this.config.baseline);

        uiLogger.info('Stereo viewers initialized');
    }

    /**
     * Render stereo views
     * 
     * Renders left and right eye views using the main viewer's camera position
     * but with offset matrices for stereo effect.
     */
    async renderStereo(): Promise<void> {
        if (!this.mainViewer) {
            uiLogger.warn('Main viewer not initialized');
            return;
        }

        try {
            // Get stereo view-projection matrices
            const leftMatrix = this.mainViewer.get_stereo_view_projection_left();
            const rightMatrix = this.mainViewer.get_stereo_view_projection_right();

            // Render left eye view
            // TODO: Need to implement rendering to separate canvas or texture
            // For now, we'll use the standard render approach
            
            uiLogger.debug('Stereo render completed');
        } catch (error) {
            uiLogger.error('Stereo render failed:', error);
            throw error;
        }
    }

    /**
     * Update stereo baseline
     */
    setBaseline(baseline: number): void {
        this.config.baseline = baseline;
        if (this.mainViewer) {
            this.mainViewer.set_stereo_baseline(baseline);
        }
        uiLogger.info(`Stereo baseline updated: ${baseline}m`);
    }

    /**
     * Get current baseline
     */
    getBaseline(): number {
        return this.config.baseline;
    }

    /**
     * Cleanup stereo viewers
     */
    cleanup(): void {
        this.leftViewer = null;
        this.rightViewer = null;
        this.mainViewer = null;
        uiLogger.info('Stereo viewers cleaned up');
    }
}
