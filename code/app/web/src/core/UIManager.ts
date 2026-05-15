/**
 * UI Manager
 * 
 * Manages dynamic UI reconfiguration based on active project.
 * Coordinates Menu, Toolbar, and Panel components.
 */

import type { ProjectConfig, MenuItem, ToolbarAction } from './types';
import type { Toolbar } from '../components/Toolbar';
import { uiLogger } from '../utils/logger';

export class UIManager {
    private toolbar: Toolbar;
    private currentConfig: ProjectConfig | null = null;

    /**
     * Create a new UIManager
     * 
     * @param toolbar - The toolbar component instance
     */
    constructor(toolbar: Toolbar) {
        this.toolbar = toolbar;
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

        // Reconfigure toolbar
        this.reconfigureToolbar(config.toolbarActions);

        // TODO: Reconfigure menu when Menu component is refactored
        // TODO: Reconfigure panels when PanelContainer is implemented

        uiLogger.debug('UI configuration applied', { 
            toolbarActions: config.toolbarActions.length,
            menuItems: config.menuItems.length,
            panels: config.panels.length
        });
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
     * Clear all UI elements
     */
    clear(): void {
        uiLogger.debug('Clearing UI configuration');
        this.currentConfig = null;
        // TODO: Clear toolbar, menu, panels
    }
}
