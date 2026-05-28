/**
 * Scene Panel Component
 * 
 * Displays the scene hierarchy with meshes, cameras, and lights
 */

import type { UIComponent } from '../types/ui.types';
import type { SceneNode, MeshInfo } from '../types/scene.types';
import { TreeView } from './TreeView';

export class ScenePanel implements UIComponent {
    element: HTMLElement;
    private treeView: TreeView;
    private sceneRoot!: SceneNode;
    private meshesFolder!: SceneNode;
    private camerasFolder!: SceneNode;
    private lightsFolder!: SceneNode;
    private visibilityCallback: ((id: string, visible: boolean) => void) | null = null;
    private selectionCallback: ((node: SceneNode) => void) | null = null;
    private isCollapsed: boolean = false;
    private title: string = 'Scene';

    constructor() {
        this.treeView = new TreeView();
        this.element = this.createElement();
        this.initializeScene();
        this.attachEventListeners();
    }

    /**
     * Initialize the scene structure
     */
    private initializeScene(): void {
        // Create root node
        this.sceneRoot = {
            id: 'scene-root',
            type: 'root',
            name: 'Scene',
            icon: '🌍',
            expanded: true,
            children: []
        };

        // Create Meshes folder
        this.meshesFolder = {
            id: 'meshes-folder',
            type: 'folder',
            name: 'Meshes',
            icon: '📦',
            expanded: true,
            children: []
        };

        // Create Cameras folder
        this.camerasFolder = {
            id: 'cameras-folder',
            type: 'folder',
            name: 'Cameras',
            icon: '🎥',
            expanded: true,
            children: []
        };

        // Create Lights folder
        this.lightsFolder = {
            id: 'lights-folder',
            type: 'folder',
            name: 'Lights',
            icon: '💡',
            expanded: true,
            children: []
        };

        // Add Main Camera
        const mainCamera: SceneNode = {
            id: 'main-camera',
            type: 'camera',
            name: 'Main Camera',
            icon: '📹',
            metadata: {
                position: [0, 2, 5],
                target: [0, 0, 0],
                fov: 45
            }
        };
        this.camerasFolder.children!.push(mainCamera);

        // Add Directional Light
        const directionalLight: SceneNode = {
            id: 'directional-light',
            type: 'light',
            name: 'Directional Light',
            icon: '☀️',
            metadata: {
                lightType: 'directional',
                direction: [0.3, -0.8, -0.5],
                color: [1.0, 1.0, 1.0],
                intensity: 1.0
            }
        };
        this.lightsFolder.children!.push(directionalLight);

        // Add Ambient Light
        const ambientLight: SceneNode = {
            id: 'ambient-light',
            type: 'light',
            name: 'Ambient Light',
            icon: '💡',
            metadata: {
                lightType: 'ambient',
                color: [0.8, 0.85, 0.9],
                intensity: 0.3
            }
        };
        this.lightsFolder.children!.push(ambientLight);

        // Add folders to root
        this.sceneRoot.children!.push(this.meshesFolder);
        this.sceneRoot.children!.push(this.camerasFolder);
        this.sceneRoot.children!.push(this.lightsFolder);

        // Set root in tree view
        this.treeView.setRoot(this.sceneRoot);

        // Setup callbacks
        this.treeView.setOnNodeClick((node) => {
            if (this.selectionCallback) {
                this.selectionCallback(node);
            }
        });

        this.treeView.setOnNodeToggleVisible((nodeId, visible) => {
            if (this.visibilityCallback) {
                this.visibilityCallback(nodeId, visible);
            }
        });
    }

    /**
     * Set panel title dynamically
     */
    setTitle(title: string): void {
        this.title = title;
        const titleElement = this.element.querySelector('.panel-header h3');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    private createElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'scene-panel panel';

        const header = document.createElement('div');
        header.className = 'panel-header';
        header.innerHTML = `
            <h3>${this.title}</h3>
            <button class="panel-collapse-btn" title="Toggle panel">
                <span class="collapse-icon">▶</span>
            </button>
        `;

        const content = document.createElement('div');
        content.className = 'panel-content';
        content.id = 'scene-tree';
        content.appendChild(this.treeView.element);

        panel.appendChild(header);
        panel.appendChild(content);

        return panel;
    }

    private attachEventListeners(): void {
        const collapseBtn = this.element.querySelector('.panel-collapse-btn');
        collapseBtn?.addEventListener('click', () => this.toggle());
    }

    /**
     * Toggle panel collapsed state
     */
    toggle(): void {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.element.classList.add('collapsed');
        } else {
            this.element.classList.remove('collapsed');
        }
    }

    /**
     * Check if panel is collapsed
     */
    isCollapsedState(): boolean {
        return this.isCollapsed;
    }

    /**
     * Add a mesh to the scene
     */
    addMesh(mesh: MeshInfo): void {
        const meshNode: SceneNode = {
            id: mesh.id,
            type: 'mesh',
            name: mesh.name,
            icon: '🔺',
            visible: mesh.visible,
            metadata: {
                vertices: mesh.vertices,
                triangles: mesh.triangles,
                sizeX: mesh.sizeX,
                sizeY: mesh.sizeZ,
                sizeZ: mesh.sizeZ
            }
        };

        this.treeView.addNode('meshes-folder', meshNode);
    }

    /**
     * Remove a mesh from the scene
     */
    removeMesh(id: string): void {
        this.treeView.removeNode(id);
    }

    /**
     * Clear all meshes
     */
    clearMeshes(): void {
        // Clear children of meshes folder
        this.meshesFolder.children = [];
        this.treeView.setRoot(this.sceneRoot);
    }

    /**
     * Add a camera to the scene
     */
    addCamera(id: string, name: string, position: [number, number, number], target: [number, number, number], fov: number = 60): void {
        const cameraNode: SceneNode = {
            id,
            type: 'camera',
            name,
            icon: '📹',
            visible: true,
            metadata: {
                position,
                target,
                fov
            }
        };

        this.treeView.addNode('cameras-folder', cameraNode);
    }

    /**
     * Update camera position and target
     */
    updateCameraPosition(id: string, position: [number, number, number], target: [number, number, number]): void {
        this.treeView.updateNode(id, { 
            metadata: { 
                position, 
                target 
            } 
        });
    }

    /**
     * Remove a camera from the scene
     */
    removeCamera(id: string): void {
        this.treeView.removeNode(id);
    }

    /**
     * Update mesh visibility
     */
    setMeshVisibility(id: string, visible: boolean): void {
        this.treeView.updateNode(id, { visible });
    }

    /**
     * Set the visibility callback
     * 
     * This callback is called whenever a mesh visibility is toggled.
     */
    setVisibilityCallback(callback: (id: string, visible: boolean) => void): void {
        this.visibilityCallback = callback;
    }

    /**
     * Set the selection callback
     * 
     * This callback is called whenever a node is selected in the tree.
     */
    setSelectionCallback(callback: (node: SceneNode) => void): void {
        this.selectionCallback = callback;
    }

    /**
     * Get the currently selected node
     */
    getSelectedNode(): SceneNode | null {
        return this.treeView.getSelectedNode();
    }

    /**
     * Clear the current selection
     */
    clearSelection(): void {
        this.treeView.clearSelection();
    }

    render(): void {
        this.treeView.render();
    }

    destroy(): void {
        this.treeView.destroy();
        this.element.remove();
    }
}
