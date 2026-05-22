/**
 * UI Manager
 * 
 * Manages dynamic UI reconfiguration based on active project.
 * Coordinates Menu, Toolbar, and Panel components.
 */

import type { ProjectConfig, MenuItem, ToolbarAction } from './types';
import type { Toolbar } from '../components/Toolbar';
import type { ScenePanel } from '../components/ScenePanel';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import { uiLogger } from '../utils/logger';

export class UIManager {
    private toolbar: Toolbar;
    private scenePanel: ScenePanel | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private currentConfig: ProjectConfig | null = null;
    private viewer: any = null; // WASM viewer handle

    /**
     * Create a new UIManager
     * 
     * @param toolbar - The toolbar component instance
     * @param meshPanel - The mesh/scene panel instance (optional)
     * @param detailsPanel - The properties panel instance (optional)
     */
    constructor(toolbar: Toolbar, meshPanel?: MeshPanel, detailsPanel?: PropertiesPanel) {
        this.toolbar = toolbar;
        this.meshPanel = meshPanel || null;
        this.detailsPanel = detailsPanel || null;
        uiLogger.info('UIManager initialized');
    }

    /**
     * Set the viewer and configure common VIEW section callbacks
     * This should be called ONCE after viewer initialization
     * 
     * @param viewer - The WASM viewer handle
     */
    setViewer(viewer: any): void {
        this.viewer = viewer;
        
        // Configure FILE section Export callback (common to ALL projects)
        this.toolbar.configureFileCallbacks({
            onExport: () => {
                uiLogger.info('[UIManager] Exporting scene');
                if (this.viewer) {
                    try {
                        // Generate timestamp for unique filename
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                        const filename = `polylab-scene-${timestamp}.pls`;
                        
                        // Call WASM export_scene
                        const zipData = this.viewer.export_scene(filename);
                        
                        // Create Blob and trigger download
                        const blob = new Blob([zipData], { type: 'application/zip' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        uiLogger.info(`[UIManager] Scene exported successfully: ${filename}`);
                    } catch (error) {
                        uiLogger.error('[UIManager] Export failed', error);
                        alert(`Export failed: ${error}`);
                    }
                } else {
                    uiLogger.warn('[UIManager] Viewer not set yet');
                }
            }
        });
        
        // Configure VIEW section callbacks (common to ALL projects)
        this.toolbar.configureViewCallbacks({
            onResetCamera: () => {
                uiLogger.info('[UIManager] Resetting camera to default position');
                if (this.viewer) {
                    this.viewer.reset_camera();
                    uiLogger.info('[UIManager] Camera reset successful');
                } else {
                    uiLogger.warn('[UIManager] Viewer not set yet');
                }
            },
            onCenterMesh: () => {
                uiLogger.info('[UIManager] Centering camera on meshes');
                if (this.viewer) {
                    const success = this.viewer.center_on_meshes();
                    if (success) {
                        uiLogger.info('[UIManager] Camera centered on meshes');
                    } else {
                        uiLogger.warn('[UIManager] No visible meshes to center on');
                    }
                } else {
                    uiLogger.warn('[UIManager] Viewer not set yet');
                }
            },
            onRenderModeChange: (modes) => {
                uiLogger.info('[UIManager] Render modes changed (common)', modes);
                if (this.viewer) {
                    this.viewer.set_render_modes(modes.solid, modes.wireframe, modes.vertices);
                    uiLogger.info('[UIManager] Called viewer.set_render_modes', modes);
                } else {
                    uiLogger.warn('[UIManager] Viewer not set yet');
                }
            }
        });
        
        uiLogger.info('UIManager viewer set, FILE Export and VIEW callbacks configured (common to all projects)');
    }

    /**
     * Apply project configuration to UI
     * Reconfigures all UI components based on project config
     * 
     * @param config - Project configuration
     */
    applyConfig(config: ProjectConfig): void {
        uiLogger.info(`Applying UI config for project: ${config.name}`);
        
        this.currentConfig = config;

        // Configure FILE section callbacks (project-specific)
        if (config.fileCallbacks) {
            this.toolbar.configureFileCallbacks(config.fileCallbacks);
        } else if (config.dropZone?.enabled) {
            // Legacy: convert dropZone to fileCallbacks
            this.toolbar.configureFileCallbacks({
                onLoad: (content, filename) => {
                    config.dropZone!.onLoad(content, filename).catch(err => {
                        config.dropZone!.onError(err.message);
                    });
                },
                onError: (error) => config.dropZone!.onError(error.message)
            });
        }

        // NOTE: VIEW section is configured ONCE in setViewer(), not per-project
        // This ensures common behavior across all projects

        // Set MODE section actions (project-specific)
        this.toolbar.setModeActions(config.toolbarActions);

        // Configure panels with titles from config
        this.configurePanels(config.panels);

        uiLogger.debug('UI configuration applied', { 
            toolbarActions: config.toolbarActions.length,
            layoutActions: config.layoutActions?.length || 0,
            panels: config.panels.length,
            fileCallbacksEnabled: !!config.fileCallbacks
        });
    }

    /**
     * Get current project configuration
     */
    getCurrentConfig(): ProjectConfig | null {
        return this.currentConfig;
    }

    /**
     * Configure panels with titles from project config
     */
    private configurePanels(panelDefinitions: any[]): void {
        panelDefinitions.forEach(panelDef => {
            if (panelDef.id === 'mesh-list' && this.scenePanel) {
                this.scenePanel.setTitle(panelDef.title);
                uiLogger.debug(`Set mesh panel title to: ${panelDef.title}`);
            } else if (panelDef.id === 'mesh-details' && this.detailsPanel) {
                this.detailsPanel.setTitle(panelDef.title);
                uiLogger.debug(`Set details panel title to: ${panelDef.title}`);
            } else if ((panelDef.id === 'rover-details' || panelDef.id === 'terrain-details') && this.detailsPanel) {
                this.detailsPanel.setTitle(panelDef.title);
                uiLogger.debug(`Set details panel title to: ${panelDef.title}`);
            }
        });
    }

    /**
     * Clear all UI elements
     */
    clear(): void {
        uiLogger.debug('Clearing UI configuration');
        this.currentConfig = null;
        // TODO: Clear toolbar, menu, panels
    }
}
