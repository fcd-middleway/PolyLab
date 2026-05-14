/**
 * UI Types for PolyLab Web App
 */

/**
 * Mesh information displayed in the UI
 */
export interface MeshInfo {
    id: string;
    name: string;
    vertices: number;
    triangles: number;
    visible: boolean;
}

/**
 * Viewer statistics
 */
export interface ViewerStats {
    fps: number;
    backend: string;
    meshCount: number;
    vertices?: number;
    triangles?: number;
    status: string;
}

/**
 * UI Component interface
 */
export interface UIComponent {
    element: HTMLElement;
    render(): void;
    destroy(): void;
}
