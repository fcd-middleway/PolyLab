/**
 * UI Manager
 * 
 * Manages dynamic UI reconfiguration based on active project.
 * Coordinates Menu, Toolbar, and Panel components.
 */

import type { ProjectConfig, MenuItem, ToolbarAction } from './types';
import type { Toolbar } from '../components/Toolbar';
import type { MeshPanel } from '../components/MeshPanel';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import { uiLogger } from '../utils/logger';

export class UIManager {
    private toolbar: Toolbar;
    private meshPanel: MeshPanel | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private currentConfig: ProjectConfig | null = null;

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
     * Apply project configuration to UI
     * Reconfigures all UI components based on project config
     * 
     * @param config - Project configuration
     */
    applyConfig(config: ProjectConfig): void {
        uiLogger.info(`Applying UI config for project: ${config.name}`);
        
        this.currentConfig = config;

        // Configure toolbar with generic menus + project actions + layout actions
        if (config.genericMenuCallbacks) {
            // New system: use generic menus with callbacks
            this.toolbar.configure(config.genericMenuCallbacks, config.toolbarActions, config.layoutActions);
        } else if (config.menuItems) {
            // Legacy system: use custom menuItems (DEPRECATED)
            uiLogger.warn('Using deprecated menuItems - migrate to genericMenuCallbacks');
            this.reconfigureMenus(config.menuItems);
            this.reconfigureToolbar(config.toolbarActions);
        } else {
            // No menu configuration, use default empty callbacks
            this.toolbar.configure({}, config.toolbarActions, config.layoutActions);
        }

        // Configure drop zone if specified
        this.toolbar.configureDropZone(config.dropZone || null);

        // Configure panels with titles from config
        this.configurePanels(config.panels);

        uiLogger.debug('UI configuration applied', { 
            toolbarActions: config.toolbarActions.length,
            layoutActions: config.layoutActions?.length || 0,
            panels: config.panels.length,
            dropZoneEnabled: config.dropZone?.enabled || false
        });
    }

    /**
     * Reconfigure menus with new items
     */
    private reconfigureMenus(menuItems: MenuItem[]): void {
        uiLogger.debug(`Configuring menus with ${menuItems.length} top-level items`);
        this.toolbar.setMenuItems(menuItems);
    }

    /**
     * Reconfigure toolbar with new actions
     */
    private reconfigureToolbar(actions: ToolbarAction[]): void {
        uiLogger.debug(`Configuring toolbar with ${actions.length} actions`);
        this.toolbar.setActions(actions);
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
            if (panelDef.id === 'mesh-list' && this.meshPanel) {
                this.meshPanel.setTitle(panelDef.title);
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
