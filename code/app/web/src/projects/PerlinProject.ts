/**
 * Perlin Project
 * 
 * Procedural terrain generation using Perlin noise algorithm.
 * Creates 3D landscapes with configurable parameters.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { StatusBar } from '../components/StatusBar';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import type { MeshPanel } from '../components/MeshPanel';
import { PerlinControlPanel, type TerrainParams } from '../components/PerlinControlPanel';
import { appLogger, meshLogger } from '../utils/logger';

export class PerlinProject extends BaseProject {
    private statusBar: StatusBar | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private meshPanel: MeshPanel | null = null;
    private controlPanel: PerlinControlPanel | null = null;
    private controlPanelContent: HTMLElement | null = null; // Keep reference to injected content
    private currentTerrainId: string | null = null;
    
    // Default terrain parameters
    private params: TerrainParams = {
        seed: Date.now() % 1000000,  // Random seed based on current time
        octaves: 4,
        persistence: 0.5,
        scale: 20.0,
        width: 20.0,
        depth: 20.0,
        widthSegments: 50,
        depthSegments: 50
    };

    getId(): string {
        return 'perlin';
    }

    getName(): string {
        return 'Perlin Terrain';
    }

    getConfig(): ProjectConfig {
        return {
            name: 'Perlin Terrain',
            icon: '🏔️',
            
            fileCallbacks: {
                onLoad: (content: string, filename: string) => this.onMeshFileLoaded(content, filename),
                onError: (error: Error) => {
                    appLogger.error('[PerlinProject] Failed to load mesh', error);
                    this.statusBar?.updateStats({ status: `❌ Error: ${error.message}` });
                }
            },
            
            // NOTE: viewCallbacks are now configured globally in UIManager.setViewer(),

            toolbarActions: [
                {
                    id: 'generate-terrain',
                    icon: '🏔️',
                    tooltip: 'Generate Terrain',
                    action: () => this.generateTerrain()
                }
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
                    component: null
                },
                {
                    id: 'terrain-details',
                    title: 'Properties',
                    position: 'right',
                    component: null
                }
            ]
        };
    }

    /**
     * Set UI components (called by main.ts after project creation)
     */
    setUIComponents(meshPanel: MeshPanel, statusBar: StatusBar, detailsPanel: PropertiesPanel): void {
        this.meshPanel = meshPanel;
        this.statusBar = statusBar;
        this.detailsPanel = detailsPanel;
        
        // Create control panel with default params
        this.controlPanel = new PerlinControlPanel(this.params);
        
        // Set generate callback
        this.controlPanel.setGenerateCallback((params: TerrainParams) => {
            this.params = params;
            this.generateTerrain();
        });

        // Store reference to control panel content (will be injected on activation)
        if (this.controlPanel) {
            const controlContent = this.controlPanel.element.querySelector('.panel-content');
            if (controlContent) {
                this.controlPanelContent = controlContent as HTMLElement;
                appLogger.debug('Terrain control panel content reference stored');
            }
        }
    }

    async init(viewer: any): Promise<void> {
        appLogger.info('Initializing Perlin project...');
        this.viewer = viewer;
        
        // Set up visibility toggle callback
        if (this.meshPanel) {
            this.meshPanel.setVisibilityCallback((id: string, visible: boolean) => {
                viewer.set_mesh_visibility(id, visible);
                meshLogger.debug('Mesh visibility changed', { meshId: id, visible });
            });
        }
        
        // Don't generate terrain automatically - let user use controls
        appLogger.info('Perlin project ready - use controls to generate terrain');
    }

    update(deltaTime: number): void {
        // No per-frame updates needed for static terrain
        // Future: could add animated noise for water/clouds
    }

    cleanup(): void {
        appLogger.info('Cleaning up Perlin project...');
        
        // Remove current terrain if exists
        if (this.currentTerrainId && this.viewer) {
            this.viewer.remove_mesh(this.currentTerrainId);
            
            if (this.meshPanel) {
                this.meshPanel.removeMesh(this.currentTerrainId);
            }
            
            this.currentTerrainId = null;
        }
        
        // Clear UI references
        this.controlPanelContent = null;
    }

    onActivate(): void {
        appLogger.debug('Perlin project activated');
        
        // Update status bar
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '🏔️ Perlin Terrain - Ready to generate'
            });
        }
        
        // Inject control panel content into Settings section
        if (this.detailsPanel && this.controlPanelContent) {
            this.detailsPanel.setSettingsContent(this.controlPanelContent);
            appLogger.debug('Terrain controls injected into Settings section');
        }
    }

    onDeactivate(): void {
        appLogger.debug('Perlin project deactivated');
        
        // Clear Settings section when deactivating
        if (this.detailsPanel) {
            this.detailsPanel.clearSettings();
        }
    }

    /**
     * Generate terrain with current parameters
     */
    private generateTerrain(): void {
        if (!this.viewer) {
            appLogger.error('Cannot generate terrain: viewer not initialized');
            return;
        }

        meshLogger.info('Generating terrain...', { params: this.params });
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '⏳ Generating terrain...' });
        }

        try {
            // Remove old terrain if exists
            if (this.currentTerrainId) {
                this.viewer.remove_mesh(this.currentTerrainId);
                if (this.meshPanel) {
                    this.meshPanel.removeMesh(this.currentTerrainId);
                }
            }

            // Generate new terrain ID
            this.currentTerrainId = `terrain-${Date.now()}`;

            // Call WASM function to generate terrain
            this.viewer.generate_terrain(
                this.currentTerrainId,
                this.params.seed,
                this.params.octaves,
                this.params.persistence,
                this.params.scale,
                this.params.width,
                this.params.depth,
                this.params.widthSegments,
                this.params.depthSegments
            );

            // Get mesh details
            const details = this.viewer.mesh_details(this.currentTerrainId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;

            // Add mesh to MeshPanel
            if (this.meshPanel) {
                this.meshPanel.addMesh({
                    id: this.currentTerrainId,
                    name: `Terrain (seed: ${this.params.seed})`,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    visible: true
                });
            }

            // Update details panel
            if (this.detailsPanel) {
                this.detailsPanel.updateDetails({
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    sizeX,
                    sizeY,
                    sizeZ
                });
            }

            // Update status bar
            if (this.statusBar) {
                this.statusBar.updateStats({ 
                    status: '✅ Terrain generated',
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles)
                });
            }

            meshLogger.info('Terrain generated successfully', {
                terrainId: this.currentTerrainId,
                seed: this.params.seed,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles),
                dimensions: [sizeX, sizeY, sizeZ]
            });

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            meshLogger.error('Failed to generate terrain', { error: errorMsg, params: this.params });
            
            if (this.statusBar) {
                this.statusBar.updateStats({ status: `❌ ${errorMsg}` });
            }
        }
    }

    /**
     * Clear current terrain
     */
    private clearTerrain(): void {
        if (!this.viewer || !this.currentTerrainId) {
            return;
        }

        this.viewer.remove_mesh(this.currentTerrainId);
        
        if (this.meshPanel) {
            this.meshPanel.removeMesh(this.currentTerrainId);
        }
        
        this.currentTerrainId = null;

        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '🏔️ Terrain cleared',
                vertices: 0,
                triangles: 0
            });
        }

        meshLogger.info('Terrain cleared');
    }

    /**
     * Reset camera to default view
     * TODO: Implement camera controls
     */
    private resetCamera(): void {
        appLogger.warn('Reset camera not implemented yet');
    }

    /**
     * Center camera on terrain
     * TODO: Implement camera controls
     */
    private centerTerrain(): void {
        appLogger.warn('Center terrain not implemented yet');
    }

    /**
     * Handle mesh file loaded from file picker (inherited from BaseProject)
     */
    protected async onMeshFileLoaded(content: string, filename: string): Promise<void> {
        try {
            appLogger.info('[PerlinProject] Loading mesh from file picker', { filename, size: content.length });
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
            
            appLogger.info('[PerlinProject] Mesh loaded successfully', { 
                meshId,
                filename, 
                vertices: Math.round(vertices), 
                triangles: Math.round(triangles)
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('[PerlinProject] Failed to load mesh', { filename, error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }

    /**
     * Update terrain parameters
     * Used by PerlinControlPanel to modify params
     */
    public updateParams(newParams: Partial<TerrainParams>): void {
        this.params = { ...this.params, ...newParams };
        appLogger.debug('Terrain params updated', { params: this.params });
    }

    /**
     * Get current terrain parameters
     */
    public getParams(): TerrainParams {
        return { ...this.params };
    }
}
