/**
 * Viewer Project
 * 
 * Default project for loading and viewing 3D meshes.
 * Provides basic .obj file loading and mesh visualization.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { ScenePanel } from '../components/ScenePanel';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import type { StatusBar } from '../components/StatusBar';
import type { SceneNode } from '../types/scene.types';
import { SceneElementProperties } from '../components/SceneElementProperties';
import { setupDropZone, type MeshLoadCallback, type ErrorCallback } from '../utils/meshLoader';
import { meshLogger } from '../utils/logger';

export class ViewerProject extends BaseProject {
    private scenePanel: ScenePanel | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private statusBar: StatusBar | null = null;
    private sceneElementProperties: SceneElementProperties = new SceneElementProperties();
    private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

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
                this.scenePanel?.addMesh({
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
            
            fileCallbacks: {
                onLoad: onLoad
            },
            
            // NOTE: viewCallbacks are now configured globally in UIManager.setViewer()

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
                    title: 'Properties',
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

        // Show "No element selected" in PropertiesPanel at startup
        if (this.detailsPanel) {
            this.sceneElementProperties.clear();
            this.detailsPanel.setMainContent(this.sceneElementProperties.element);
        }

        // Set up callbacks
        this.setupCallbacks();

        // Setup mesh loading
        this.setupMeshLoading();

        meshLogger.info('Viewer project initialized');
    }

    /**
     * Setup ScenePanel callbacks for visibility and selection
     * Called both in init() and onActivate() to ensure callbacks are active
     */
    private setupCallbacks(): void {
        if (!this.scenePanel) return;

        // Set up visibility toggle callback
        this.scenePanel.setVisibilityCallback((id: string, visible: boolean) => {
            this.viewer.set_mesh_visibility(id, visible);
            meshLogger.debug('Mesh visibility changed', { meshId: id, visible });
        });
        
        // Set up selection callback
        this.scenePanel.setSelectionCallback((node) => {
            meshLogger.info('Scene element selected', { 
                id: node.id, 
                type: node.type, 
                name: node.name 
            });
            
            // Sync metadata with actual viewer state before displaying
            if (node.type === 'camera') {
                this.syncCameraMetadata(node);
            } else if (node.type === 'light') {
                this.syncLightMetadata(node);
            } else if (node.type === 'root') {
                this.syncRootMetadata(node);
            }
            
            // Display element properties in PropertiesPanel (replaces entire content)
            if (this.detailsPanel) {
                this.sceneElementProperties.showElement(node);
                this.detailsPanel.setMainContent(this.sceneElementProperties.element);
            }
        });

        // Set up SceneElementProperties callbacks
        this.sceneElementProperties.setCallbacks({
            onRename: (nodeId: string, newName: string) => {
                meshLogger.info('Renaming element', { nodeId, newName });
                
                // Update node name in ScenePanel (TreeView will re-render)
                if (this.scenePanel) {
                    const node = this.scenePanel.getSelectedNode();
                    if (node) {
                        node.name = newName;
                        this.scenePanel.render();
                        
                        // Re-display properties with updated name
                        this.sceneElementProperties.showElement(node);
                    }
                }
            },

            onToggleVisibility: (nodeId: string, visible: boolean) => {
                meshLogger.info('Toggling element visibility', { nodeId, visible });
                
                // Update visibility in viewer
                this.viewer.set_mesh_visibility(nodeId, visible);
                
                // Update visibility in ScenePanel
                if (this.scenePanel) {
                    this.scenePanel.setMeshVisibility(nodeId, visible);
                }
            },

            onRemove: (nodeId: string) => {
                meshLogger.info('Removing element', { nodeId });
                
                try {
                    // Remove from viewer (if method exists)
                    if (typeof this.viewer.remove_mesh === 'function') {
                        this.viewer.remove_mesh(nodeId);
                    }
                    
                    // Remove from ScenePanel
                    if (this.scenePanel) {
                        this.scenePanel.removeMesh(nodeId);
                        // Clear selection since the element no longer exists
                        this.scenePanel.clearSelection();
                    }
                    
                    // Clear properties panel
                    this.sceneElementProperties.clear();
                    if (this.detailsPanel) {
                        this.detailsPanel.restoreDefaultContent();
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Mesh removed' });
                } catch (error) {
                    meshLogger.error('Failed to remove mesh', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to remove mesh' });
                }
            },

            onSave: (nodeId: string) => {
                meshLogger.info('Saving element', { nodeId });
                
                try {
                    // Export mesh as OBJ (if method exists)
                    if (typeof this.viewer.export_mesh_obj === 'function') {
                        const objContent = this.viewer.export_mesh_obj(nodeId);
                        const node = this.scenePanel?.getSelectedNode();
                        const filename = node ? `${node.name}.obj` : `${nodeId}.obj`;
                        
                        // Trigger download
                        this.downloadFile(objContent, filename, 'text/plain');
                        
                        this.statusBar?.updateStats({ status: `✅ Saved ${filename}` });
                    } else {
                        this.statusBar?.updateStats({ status: '⚠️ Export not available' });
                    }
                } catch (error) {
                    meshLogger.error('Failed to save mesh', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to save mesh' });
                }
            },

            // Camera callbacks
            onUpdateCameraPosition: (nodeId: string, position: [number, number, number]) => {
                meshLogger.info('Updating camera position', { nodeId, position });
                
                try {
                    // Update camera position in viewer
                    this.viewer.camera_set_position(position[0], position[1], position[2]);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.position = position;
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Camera position updated' });
                } catch (error) {
                    meshLogger.error('Failed to update camera position', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update camera' });
                }
            },

            onUpdateCameraTarget: (nodeId: string, target: [number, number, number]) => {
                meshLogger.info('Updating camera target', { nodeId, target });
                
                try {
                    // Update camera target in viewer
                    this.viewer.set_camera_target(target[0], target[1], target[2]);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.target = target;
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Camera target updated' });
                } catch (error) {
                    meshLogger.error('Failed to update camera target', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update camera' });
                }
            },

            onUpdateCameraFov: (nodeId: string, fov: number) => {
                meshLogger.info('Updating camera FOV', { nodeId, fov });
                
                try {
                    // Update camera FOV in viewer
                    this.viewer.set_camera_fov(fov);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.fov = fov;
                    }
                    
                    this.statusBar?.updateStats({ status: `✅ FOV set to ${fov}°` });
                } catch (error) {
                    meshLogger.error('Failed to update camera FOV', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update FOV' });
                }
            },

            onResetCamera: (nodeId: string) => {
                meshLogger.info('Resetting camera', { nodeId });
                
                try {
                    // Reset camera to default position
                    this.viewer.reset_camera();
                    
                    // Update properties panel to reflect new values
                    if (this.scenePanel) {
                        const node = this.scenePanel.getSelectedNode();
                        if (node && node.type === 'camera') {
                            // Get updated camera data from viewer
                            const position = this.viewer.camera_position();
                            const target = this.viewer.get_camera_target();
                            const fov = this.viewer.get_camera_fov();
                            
                            // Update node metadata
                            if (node.metadata) {
                                node.metadata.position = position;
                                node.metadata.target = target;
                                node.metadata.fov = fov;
                            }
                            
                            // Re-display properties with updated values
                            this.sceneElementProperties.showElement(node);
                        }
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Camera reset' });
                } catch (error) {
                    meshLogger.error('Failed to reset camera', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to reset camera' });
                }
            },

            // Light callbacks
            onUpdateLightDirection: (nodeId: string, direction: [number, number, number]) => {
                meshLogger.info('Updating light direction', { nodeId, direction });
                
                try {
                    // Update light direction in viewer
                    this.viewer.set_light_direction(direction[0], direction[1], direction[2]);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.direction = direction;
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Light direction updated' });
                } catch (error) {
                    meshLogger.error('Failed to update light direction', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update light' });
                }
            },

            onUpdateLightColor: (nodeId: string, color: [number, number, number]) => {
                meshLogger.info('Updating light color', { nodeId, color });
                
                try {
                    // Update light color in viewer (color is already 0.0-1.0)
                    this.viewer.set_light_color(color[0], color[1], color[2]);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.color = color;
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Light color updated' });
                } catch (error) {
                    meshLogger.error('Failed to update light color', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update light' });
                }
            },

            onUpdateLightIntensity: (nodeId: string, intensity: number) => {
                meshLogger.info('Updating light intensity', { nodeId, intensity });
                
                try {
                    // Update light intensity in viewer
                    this.viewer.set_light_intensity(intensity);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.intensity = intensity;
                    }
                    
                    this.statusBar?.updateStats({ status: `✅ Intensity set to ${intensity.toFixed(1)}` });
                } catch (error) {
                    meshLogger.error('Failed to update light intensity', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update intensity' });
                }
            },

            onResetLight: (nodeId: string) => {
                meshLogger.info('Resetting light', { nodeId });
                
                try {
                    // Reset to default sun light
                    this.viewer.set_light_direction(-0.3, -1.0, -0.5);
                    this.viewer.set_light_color(1.0, 0.98, 0.95);
                    this.viewer.set_light_intensity(0.8);
                    
                    // Update properties panel to reflect new values
                    if (this.scenePanel) {
                        const node = this.scenePanel.getSelectedNode();
                        if (node && node.type === 'light') {
                            // Get updated light data from viewer
                            const direction = this.viewer.get_light_direction();
                            const color = this.viewer.get_light_color();
                            const intensity = this.viewer.get_light_intensity();
                            
                            // Update node metadata
                            if (node.metadata) {
                                node.metadata.direction = direction;
                                node.metadata.color = color;
                                node.metadata.intensity = intensity;
                            }
                            
                            // Re-display properties with updated values
                            this.sceneElementProperties.showElement(node);
                        }
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Light reset' });
                } catch (error) {
                    meshLogger.error('Failed to reset light', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to reset light' });
                }
            },

            // Ambient Light callbacks
            onUpdateAmbientColor: (nodeId: string, color: [number, number, number]) => {
                meshLogger.info('Updating ambient color', { nodeId, color });
                
                try {
                    // Update ambient color in viewer (color is already 0.0-1.0)
                    this.viewer.set_ambient_color(color[0], color[1], color[2]);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.color = color;
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Ambient color updated' });
                } catch (error) {
                    meshLogger.error('Failed to update ambient color', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update ambient' });
                }
            },

            onUpdateAmbientIntensity: (nodeId: string, intensity: number) => {
                meshLogger.info('Updating ambient intensity', { nodeId, intensity });
                
                try {
                    // Update ambient intensity in viewer
                    this.viewer.set_ambient_intensity(intensity);
                    
                    // Sync metadata
                    const node = this.scenePanel?.getSelectedNode();
                    if (node && node.metadata) {
                        node.metadata.intensity = intensity;
                    }
                    
                    this.statusBar?.updateStats({ status: `✅ Ambient intensity set to ${intensity.toFixed(1)}` });
                } catch (error) {
                    meshLogger.error('Failed to update ambient intensity', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to update ambient intensity' });
                }
            },

            onResetAmbient: (nodeId: string) => {
                meshLogger.info('Resetting ambient light', { nodeId });
                
                try {
                    // Reset to default ambient light
                    this.viewer.set_ambient_color(0.8, 0.85, 0.9);
                    this.viewer.set_ambient_intensity(0.3);
                    
                    // Update properties panel to reflect new values
                    if (this.scenePanel) {
                        const node = this.scenePanel.getSelectedNode();
                        if (node && node.type === 'light' && node.metadata?.lightType === 'ambient') {
                            // Get updated ambient data from viewer
                            const color = this.viewer.get_ambient_color();
                            const intensity = this.viewer.get_ambient_intensity();
                            
                            // Update node metadata
                            if (node.metadata) {
                                node.metadata.color = color;
                                node.metadata.intensity = intensity;
                            }
                            
                            // Re-display properties with updated values
                            this.sceneElementProperties.showElement(node);
                        }
                    }
                    
                    this.statusBar?.updateStats({ status: '✅ Ambient light reset' });
                } catch (error) {
                    meshLogger.error('Failed to reset ambient light', { nodeId, error });
                    this.statusBar?.updateStats({ status: '❌ Failed to reset ambient' });
                }
            }
        });
    }

    /**
     * Sync camera node metadata with actual viewer camera state
     * Call this before displaying camera properties to ensure values are current
     */
    private syncCameraMetadata(node: SceneNode): void {
        if (!node.metadata) {
            node.metadata = {};
        }
        
        try {
            // Get current camera state from viewer
            const position = this.viewer.camera_position();
            const target = this.viewer.get_camera_target();
            const fov = this.viewer.get_camera_fov();
            
            // Update node metadata with current values
            node.metadata.position = position;
            node.metadata.target = target;
            node.metadata.fov = fov;
            
            meshLogger.debug('Camera metadata synced', { position, target, fov });
        } catch (error) {
            meshLogger.error('Failed to sync camera metadata', { error });
        }
    }

    /**
     * Sync light node metadata with actual viewer light state
     * Call this before displaying light properties to ensure values are current
     */
    private syncLightMetadata(node: SceneNode): void {
        if (!node.metadata) {
            node.metadata = {};
        }
        
        try {
            // Check light type and sync accordingly
            if (node.metadata.lightType === 'ambient') {
                // Sync ambient light
                const color = this.viewer.get_ambient_color();
                const intensity = this.viewer.get_ambient_intensity();
                
                node.metadata.color = color;
                node.metadata.intensity = intensity;
                
                meshLogger.debug('Ambient light metadata synced', { color, intensity });
            } else {
                // Sync directional light (default)
                const direction = this.viewer.get_light_direction();
                const color = this.viewer.get_light_color();
                const intensity = this.viewer.get_light_intensity();
                
                node.metadata.direction = direction;
                node.metadata.color = color;
                node.metadata.intensity = intensity;
                
                meshLogger.debug('Directional light metadata synced', { direction, color, intensity });
            }
        } catch (error) {
            meshLogger.error('Failed to sync light metadata', { error });
        }
    }

    /**
     * Sync root node metadata with scene statistics
     * Call this before displaying root properties to show current counts and bounding box
     */
    private syncRootMetadata(node: SceneNode): void {
        if (!node.metadata) {
            node.metadata = {};
        }
        
        try {
            // Get mesh count from viewer
            const meshCount = this.viewer.get_mesh_count();
            
            // Camera and light counts are currently fixed (1 camera, 1 light)
            // TODO: Make this dynamic if we support multiple cameras/lights
            const cameraCount = 1;
            const lightCount = 1;
            
            // Get scene bounding box
            const bboxJson = this.viewer.get_scene_bounding_box();
            let boundingBox: { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] } | undefined = undefined;
            if (bboxJson) {
                const bbox = JSON.parse(bboxJson);
                boundingBox = {
                    min: bbox.min,
                    max: bbox.max,
                    size: bbox.size
                };
            }
            
            // Update node metadata
            node.metadata.meshCount = meshCount;
            node.metadata.cameraCount = cameraCount;
            node.metadata.lightCount = lightCount;
            node.metadata.boundingBox = boundingBox;
            
            meshLogger.debug('Root metadata synced', { meshCount, cameraCount, lightCount, boundingBox });
        } catch (error) {
            meshLogger.error('Failed to sync root metadata', { error });
        }
    }

    /**
     * Trigger file download
     */
    private downloadFile(content: string, filename: string, mimeType: string): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    update(deltaTime: number): void {
        // No per-frame updates needed for basic viewer
        // Camera updates, animations, etc. will be added later
    }

    cleanup(): void {
        meshLogger.info('Cleaning up Viewer project...');
        
        // Clear element properties
        this.sceneElementProperties.clear();
        
        // NOTE: Do NOT clear UI component references (scenePanel, detailsPanel, statusBar)
        // These are persistent global UI components that are reused across project switches
    }

    onActivate(): void {
        meshLogger.debug('Viewer project activated');
        
        // Reconfigure callbacks to ensure they're active after switching projects
        this.setupCallbacks();
        
        // Show "No element selected" in PropertiesPanel instead of default Details section
        if (this.detailsPanel) {
            this.sceneElementProperties.clear();
            this.detailsPanel.setMainContent(this.sceneElementProperties.element);
        }

        // Setup keyboard shortcuts
        this.keyboardHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Clear selection and show empty properties panel
                if (this.scenePanel) {
                    this.scenePanel.clearSelection();
                }
                this.sceneElementProperties.clear();
                if (this.detailsPanel) {
                    this.detailsPanel.setMainContent(this.sceneElementProperties.element);
                }
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);
    }

    onDeactivate(): void {
        meshLogger.debug('Viewer project deactivated');
        
        // Remove keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        // Clear element properties and restore default panel content
        this.sceneElementProperties.clear();
        if (this.detailsPanel) {
            this.detailsPanel.restoreDefaultContent();
        }
    }

    /**
     * Set UI component references
     * Called by main.ts after UI is initialized
     */
    setUIComponents(scenePanel: ScenePanel, detailsPanel: PropertiesPanel, statusBar: StatusBar): void {
        this.scenePanel = scenePanel;
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
                
                this.scenePanel?.addMesh({
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
        await this.loadMeshHelper(content, filename, {
            scenePanel: this.scenePanel,
            detailsPanel: this.detailsPanel,
            statusBar: this.statusBar
        });
    }
}
