/**
 * Core types for project system
 */

/**
 * Menu item definition
 */
export interface MenuItem {
    label?: string;
    action?: () => void;
    submenu?: MenuItem[];
    separator?: boolean;
    enabled?: boolean;
}

/**
 * Toolbar action definition
 */
export interface ToolbarAction {
    id: string;
    icon: string;
    tooltip: string;
    action: () => void;
    enabled?: boolean;
}

/**
 * Panel definition
 */
export interface PanelDefinition {
    id: string;
    title: string;
    position: 'left' | 'right';
    component: any; // Will be the actual UI component instance
}

/**
 * Project configuration
 */
export interface ProjectConfig {
    name: string;
    icon: string;
    menuItems: MenuItem[];
    toolbarActions: ToolbarAction[];
    panels: PanelDefinition[];
}
