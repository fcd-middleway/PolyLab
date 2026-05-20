import type { MenuItem } from '../core/types';

/**
 * Generic File menu - same for all projects
 */
export function getFileMenu(callbacks: {
    onLoadMesh?: () => void;
    onExportScene?: () => void;
}): MenuItem {
    return {
        label: 'File',
        submenu: [
            { 
                label: 'Load Mesh...', 
                action: callbacks.onLoadMesh,
                enabled: !!callbacks.onLoadMesh
            },
            { separator: true },
            { 
                label: 'Export Scene...', 
                action: callbacks.onExportScene,
                enabled: false // Not implemented yet
            }
        ]
    };
}

/**
 * Generic View menu - same for all projects
 */
export function getViewMenu(callbacks: {
    onResetCamera?: () => void;
    onCenterMesh?: () => void;
    onToggleSolid?: () => void;
    onToggleWireframe?: () => void;
    onToggleVertices?: () => void;
}): MenuItem {
    return {
        label: 'View',
        submenu: [
            { 
                label: 'Reset Camera', 
                action: callbacks.onResetCamera,
                enabled: false // Not implemented yet
            },
            { 
                label: 'Center Mesh', 
                action: callbacks.onCenterMesh,
                enabled: false // Not implemented yet
            },
            { separator: true },
            {
                label: '☑️ Solid',
                action: callbacks.onToggleSolid,
                enabled: !!callbacks.onToggleSolid
            },
            {
                label: '☐ Wireframe',
                action: callbacks.onToggleWireframe,
                enabled: !!callbacks.onToggleWireframe
            },
            {
                label: '☐ Vertices',
                action: callbacks.onToggleVertices,
                enabled: !!callbacks.onToggleVertices
            }
        ]
    };
}
