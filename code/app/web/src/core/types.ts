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
 * Drop zone configuration for file loading
 */
export interface DropZoneConfig {
    enabled: boolean;
    onLoad: (content: string, filename: string) => Promise<void>;
    onError: (error: string) => void;
    acceptedExtensions?: string[]; // e.g., ['.obj', '.stl']
    label?: string; // Custom label for the drop zone
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
    dropZone?: DropZoneConfig; // Optional drag & drop zone
}
