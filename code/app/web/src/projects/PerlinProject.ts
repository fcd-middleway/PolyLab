/**
 * Perlin Project
 * 
 * Procedural terrain generation using Perlin noise algorithm.
 * Creates 3D landscapes with configurable parameters.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { StatusBar } from '../components/StatusBar';
import type { DetailsPanel } from '../components/DetailsPanel';
import type { MeshPanel } from '../components/MeshPanel';
import { appLogger, meshLogger } from '../utils/logger';

/**
 * Terrain generation parameters
 */
export interface TerrainParams {
    seed: number;           // Random seed (0-999999)
    octaves: number;        // Number of noise layers (1-8)
    persistence: number;    // Amplitude decay per octave (0.1-1.0)
    scale: number;          // Noise frequency scale (1-100)
    width: number;          // Terrain width in world units
    depth: number;          // Terrain depth in world units
    widthSegments: number;  // Number of vertices along width
    depthSegments: number;  // Number of vertices along depth
}

export class PerlinProject extends BaseProject {
    private statusBar: StatusBar | null = null;
    private detailsPanel: DetailsPanel | null = null;
    private meshPanel: MeshPanel | null = null;
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
            
            menuItems: [
                { 
                    label: 'Terrain',
                    submenu: [
                        { label: 'Generate Terrain', action: () => this.generateTerrain() },
                        { separator: true },
                        { label: 'Clear Terrain', action: () => this.clearTerrain(), enabled: false }
                    ]
                },
                {
                    label: 'View',
                    submenu: [
                        { label: 'Reset Camera', action: () => this.resetCamera(), enabled: false },
                        { label: 'Center Terrain', action: () => this.centerTerrain(), enabled: false }
                    ]
                }
            ],

            toolbarActions: [
                {
                    id: 'generate-terrain',
                    icon: '🏔️',
                    tooltip: 'Generate Terrain',
                    action: () => this.generateTerrain()
                }
            ],

            panels: [
                {
                    id: 'mesh-list',
                    title: 'Meshes',
                    position: 'left',
                    component: null
                },
                {
                    id: 'terrain-details',
                    title: 'Details',
                    position: 'right',
                    component: null
                }
            ]
        };
    }

    /**
     * Set UI components (called by main.ts after project creation)
     */
    setUIComponents(meshPanel: MeshPanel, statusBar: StatusBar, detailsPanel: DetailsPanel): void {
        this.meshPanel = meshPanel;
        this.statusBar = statusBar;
        this.detailsPanel = detailsPanel;
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
        
        // Generate initial terrain
        this.generateTerrain();
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
    }

    onActivate(): void {
        appLogger.debug('Perlin project activated');
        
        // Update status bar
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '🏔️ Perlin Terrain - Ready to generate'
            });
        }
    }

    onDeactivate(): void {
        appLogger.debug('Perlin project deactivated');
    }

    /**
     * Generate terrain with current parameters
     */
    private generateTerrain(): void {
        if (!this.viewer) {
            appLogger.error('Cannot generate terrain: viewer not initialized');
            return;
        }

        // Randomize seed for each generation
        this.params.seed = Date.now() % 1000000;

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
