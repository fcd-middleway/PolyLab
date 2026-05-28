/**
 * Scene Tree Types
 * 
 * Defines the structure for the scene hierarchy
 */

export type SceneNodeType = 'root' | 'folder' | 'mesh' | 'camera' | 'light';

/**
 * Base node in the scene tree
 */
export interface SceneNode {
    id: string;
    type: SceneNodeType;
    name: string;
    icon: string;
    visible?: boolean;      // For meshes - can be shown/hidden
    expanded?: boolean;     // For folders - can be collapsed/expanded
    children?: SceneNode[];
    metadata?: SceneNodeMetadata;
}

/**
 * Metadata attached to scene nodes
 */
export interface SceneNodeMetadata {
    // Mesh-specific
    vertices?: number;
    triangles?: number;
    sizeX?: number;
    sizeY?: number;
    sizeZ?: number;
    
    // Camera-specific (for later)
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
    
    // Light-specific (for later)
    lightType?: 'directional' | 'ambient';
    direction?: [number, number, number];
    color?: [number, number, number];
    intensity?: number;
    
    // Scene Root-specific
    meshCount?: number;
    cameraCount?: number;
    lightCount?: number;
    boundingBox?: {
        min: [number, number, number];
        max: [number, number, number];
        size: [number, number, number];
    };
}

/**
 * Mesh info structure (compatible with existing MeshPanel API)
 */
export interface MeshInfo {
    id: string;
    name: string;
    vertices: number;
    triangles: number;
    visible: boolean;
    sizeX?: number;
    sizeY?: number;
    sizeZ?: number;
}
