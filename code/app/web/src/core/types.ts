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
 * Callbacks for toolbar FILE section
 */
export interface FileCallbacks {
    onLoad: (content: string, filename: string) => void;
    onError?: (error: Error) => void;
    onExport?: () => void;
}

/**
 * Callbacks for toolbar VIEW section
 */
export interface ViewCallbacks {
    onResetCamera?: () => void;
    onCenterMesh?: () => void;
    onRenderModeChange?: (modes: { solid: boolean; wireframe: boolean; vertices: boolean }) => void;
}

/**
 * Callbacks for generic menus (File, View) - DEPRECATED, use FileCallbacks/ViewCallbacks instead
 */
export interface GenericMenuCallbacks {
    file?: {
        onLoadMesh?: () => void;
        onExportScene?: () => void;
    };
    view?: {
        onResetCamera?: () => void;
        onCenterMesh?: () => void;
        onToggleSolid?: () => void;
        onToggleWireframe?: () => void;
        onToggleVertices?: () => void;
    };
}

/**
 * Project configuration
 */
export interface ProjectConfig {
    name: string;
    icon: string;
    fileCallbacks?: FileCallbacks; // FILE section callbacks
    viewCallbacks?: ViewCallbacks; // VIEW section callbacks
    genericMenuCallbacks?: GenericMenuCallbacks; // DEPRECATED: Use fileCallbacks/viewCallbacks instead
    menuItems?: MenuItem[]; // DEPRECATED: Use fileCallbacks/viewCallbacks instead
    toolbarActions: ToolbarAction[]; // MODE section actions
    layoutActions?: ToolbarAction[]; // Layout/view mode buttons (right side)
    panels: PanelDefinition[];
    dropZone?: DropZoneConfig; // DEPRECATED: Use fileCallbacks instead
}
