/**
 * Viewer Project
 * 
 * Default project for loading and viewing 3D meshes.
 * Provides basic .obj file loading and mesh visualization.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { MeshPanel } from '../components/MeshPanel';
import type { DetailsPanel } from '../components/DetailsPanel';
import type { StatusBar } from '../components/StatusBar';
import { setupDropZone, type MeshLoadCallback, type ErrorCallback } from '../utils/meshLoader';
import { meshLogger } from '../utils/logger';

export class ViewerProject extends BaseProject {
    private meshPanel: MeshPanel | null = null;
    private detailsPanel: DetailsPanel | null = null;
    private statusBar: StatusBar | null = null;

    getId(): string {
        return 'viewer';
    }

    getName(): string {
        return '3D Viewer';
    }

    getConfig(): ProjectConfig {
        // Create mesh loading callback for drop zone
        const onLoad: MeshLoadCallback = async (objContent: string, filename: string) => {
            try {
                meshLogger.info('Loading mesh from drop zone', { filename, size: objContent.length });
                this.statusBar?.updateStats({ status: `Loading ${filename}...` });
                
                // Generate unique mesh ID
                const meshId = `mesh-${Date.now()}`;
                meshLogger.debug('Generated mesh ID', { meshId, filename });
                
                // Call WASM function to load mesh
                this.viewer.load_mesh(meshId, objContent);
                
                // Get detailed mesh info from viewer
                const details = this.viewer.mesh_details(meshId);
                const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
                
                // Add mesh to MeshPanel
                this.meshPanel?.addMesh({
                    id: meshId,
                    name: filename,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    visible: true
                });
                
                // Update DetailsPanel with dimensions
                this.detailsPanel?.updateDetails({
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    sizeX,
                    sizeY,
                    sizeZ
                });
                
                // Update status bar
                this.statusBar?.updateStats({ 
                    status: `✅ Loaded ${filename}`,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles)
                });
                
                meshLogger.info('Mesh loaded successfully', { 
                    meshId,
                    filename, 
                    vertices: Math.round(vertices), 
                    triangles: Math.round(triangles),
                    dimensions: [sizeX, sizeY, sizeZ]
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                meshLogger.error('Failed to load mesh', { filename, error: errorMsg });
                this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
            }
        };

        const onError: ErrorCallback = (error: string) => {
            meshLogger.error('File loading error', { error });
            this.statusBar?.updateStats({ status: `❌ ${error}` });
        };

        return {
            name: '3D Viewer',
            icon: '👁️',
            
            genericMenuCallbacks: {
                file: {
                    onLoadMesh: () => this.openFilePicker()
                },
                view: {
                    // Camera controls not implemented yet
                }
            },

            toolbarActions: [
                // No project-specific actions for now
                // Load Mesh is in File menu
            ],

            layoutActions: [
                {
                    id: 'normal-view',
                    icon: '🎬',
                    tooltip: 'Scene',
                    action: () => { /* Single view mode */ }
                }
            ],

            panels: [
                {
                    id: 'mesh-list',
                    title: 'Scenes',
                    position: 'left',
                    component: null // Will be set during init
                },
                {
                    id: 'mesh-details',
                    title: 'Details',
                    position: 'right',
                    component: null // Will be set during init
                }
            ],

            dropZone: {
                enabled: true,
                onLoad,
                onError,
                acceptedExtensions: ['.obj'],
                label: 'Drag & drop .obj files here or click to browse'
            }
        };
    }

    async init(viewer: any): Promise<void> {
        meshLogger.info('Initializing Viewer project...');
        
        this.viewer = viewer;

        // Initialize DetailsPanel with default triangle info
        if (this.detailsPanel) {
            const initialDetails = viewer.mesh_details(null);
            const [initVertices, initTriangles, initSizeX, initSizeY, initSizeZ] = initialDetails;
            this.detailsPanel.updateDetails({
                vertices: Math.round(initVertices),
                triangles: Math.round(initTriangles),
                sizeX: initSizeX,
                sizeY: initSizeY,
                sizeZ: initSizeZ
            });
        }

        // Set up visibility toggle callback
        if (this.meshPanel) {
            this.meshPanel.setVisibilityCallback((id: string, visible: boolean) => {
                viewer.set_mesh_visibility(id, visible);
                meshLogger.debug('Mesh visibility changed', { meshId: id, visible });
            });
        }

        // Setup mesh loading
        this.setupMeshLoading();

        meshLogger.info('Viewer project initialized');
    }

    update(deltaTime: number): void {
        // No per-frame updates needed for basic viewer
        // Camera updates, animations, etc. will be added later
    }

    cleanup(): void {
        meshLogger.info('Cleaning up Viewer project...');
        
        // Clear references
        this.meshPanel = null;
        this.detailsPanel = null;
        this.statusBar = null;
    }

    /**
     * Set UI component references
     * Called by main.ts after UI is initialized
     */
    setUIComponents(meshPanel: MeshPanel, detailsPanel: DetailsPanel, statusBar: StatusBar): void {
        this.meshPanel = meshPanel;
        this.detailsPanel = detailsPanel;
        this.statusBar = statusBar;
    }

    /**
     * Setup mesh loading (drag & drop on canvas as fallback)
     */
    private setupMeshLoading(): void {
        // The main drop zone is now in the Toolbar (configured via ProjectConfig)
        // We keep canvas drop zone as a secondary option
        const onLoad: MeshLoadCallback = async (objContent: string, filename: string) => {
            try {
                meshLogger.info('Loading mesh from canvas drop', { filename, size: objContent.length });
                this.statusBar?.updateStats({ status: `Loading ${filename}...` });
                
                const meshId = `mesh-${Date.now()}`;
                this.viewer.load_mesh(meshId, objContent);
                
                const details = this.viewer.mesh_details(meshId);
                const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
                
                this.meshPanel?.addMesh({
                    id: meshId,
                    name: filename,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    visible: true
                });
                
                this.detailsPanel?.updateDetails({
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    sizeX,
                    sizeY,
                    sizeZ
                });
                
                this.statusBar?.updateStats({ 
                    status: `✅ Loaded ${filename}`,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles)
                });
                
                meshLogger.info('Mesh loaded successfully from canvas drop', { 
                    meshId,
                    filename, 
                    vertices: Math.round(vertices), 
                    triangles: Math.round(triangles)
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                meshLogger.error('Failed to load mesh from canvas drop', { filename, error: errorMsg });
                this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
            }
        };

        const onError: ErrorCallback = (error: string) => {
            meshLogger.error('Canvas drop error', { error });
            this.statusBar?.updateStats({ status: `❌ ${error}` });
        };

        // Setup drag & drop on viewer canvas (as secondary drop zone)
        const canvas = document.getElementById('webgpu-canvas');
        if (canvas) {
            setupDropZone(canvas, onLoad, onError);
            meshLogger.debug('Drag & drop configured on canvas (secondary zone)');
        }
    }

    /**
     * Export current scene
     * TODO: Implement scene export
     */
    private exportScene(): void {
        meshLogger.info('Export scene requested');
        // TODO: Implement export functionality
    }

    /**
     * Reset camera to default position
     * TODO: Implement when camera system is added
     */
    private resetCamera(): void {
        meshLogger.info('Reset camera requested');
        // TODO: Implement camera reset
    }

    /**
     * Center camera on mesh
     * TODO: Implement when camera system is added
     */
    private centerMesh(): void {
        meshLogger.info('Center mesh requested');
        // TODO: Implement mesh centering
    }

    /**
     * Handle mesh file loaded from file picker (inherited from BaseProject)
     */
    protected async onMeshFileLoaded(content: string, filename: string): Promise<void> {
        try {
            meshLogger.info('Loading mesh from file picker', { filename, size: content.length });
            this.statusBar?.updateStats({ status: `Loading ${filename}...` });
            
            // Generate unique mesh ID
            const meshId = `mesh-${Date.now()}`;
            
            // Call WASM function to load mesh
            this.viewer.load_mesh(meshId, content);
            
            // Get detailed mesh info from viewer
            const details = this.viewer.mesh_details(meshId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
            
            // Add mesh to MeshPanel
            this.meshPanel?.addMesh({
                id: meshId,
                name: filename,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles),
                visible: true
            });
            
            // Update DetailsPanel with dimensions
            this.detailsPanel?.updateDetails({
                vertices: Math.round(vertices),
                triangles: Math.round(triangles),
                sizeX,
                sizeY,
                sizeZ
            });
            
            // Update status bar
            this.statusBar?.updateStats({ 
                status: `✅ Loaded ${filename}`,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles)
            });
            
            meshLogger.info('Mesh loaded successfully', { 
                meshId,
                filename, 
                vertices: Math.round(vertices), 
                triangles: Math.round(triangles),
                dimensions: [sizeX, sizeY, sizeZ]
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            meshLogger.error('Failed to load mesh', { filename, error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }
}
