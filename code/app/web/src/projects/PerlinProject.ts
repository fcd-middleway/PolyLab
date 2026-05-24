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
import type { ScenePanel } from '../components/ScenePanel';
import { PerlinControlPanel, type TerrainParams } from '../components/PerlinControlPanel';
import { appLogger, meshLogger } from '../utils/logger';
import { meshDataToObj } from '../utils/terrainUtils';
import { LayoutManager } from '../core/LayoutManager';
import {
    setupHeightmapView,
    setupSlopeMapView,
    setupFlowMapView,
    setupMaterialMapView,
    type TerrainMapData
} from '../utils/terrainLayouts';

// Terrain WASM types (imported dynamically in init())
type WasmTerrainConfig = any;
type TerrainHandle = any;

export class PerlinProject extends BaseProject {
    private statusBar: StatusBar | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private scenePanel: ScenePanel | null = null;
    private controlPanel: PerlinControlPanel | null = null;
    private controlPanelContent: HTMLElement | null = null; // Keep reference to injected content
    private currentTerrainId: string | null = null;
    private terrainWasmInitialized: boolean = false;
    private layoutManager: LayoutManager | null = null;
    private currentViewMode: string = 'scene'; // Default: 3D scene
    
    // Terrain WASM module (loaded dynamically)
    private terrainWasm: any = null;
    private WasmTerrainConfigClass: any = null;
    private TerrainHandleClass: any = null;
    
    // Terrain map data for visualization
    private terrainMapData: TerrainMapData = {
        heightmap: null,
        slopeMap: null,
        flowMap: null,
        width: 0,
        height: 0
    };
    
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
                onError: (error: string) => {
                    appLogger.error('[PerlinProject] Failed to load mesh', error);
                    this.statusBar?.updateStats({ status: `❌ Error: ${error}` });
                }
            },
            
            // NOTE: viewCallbacks are now configured globally in UIManager.setViewer(),

            toolbarActions: [
                {
                    id: 'generate-terrain',
                    icon: '🏔️',
                    tooltip: 'Generate Terrain',
                    action: () => this.generateTerrain()
                },
                {
                    id: 'view-scene',
                    icon: '🎬',
                    tooltip: '3D Scene',
                    action: () => this.switchViewMode('scene')
                },
                {
                    id: 'view-heightmap',
                    icon: '🗺️',
                    tooltip: 'Heightmap',
                    action: () => this.switchViewMode('heightmap')
                },
                {
                    id: 'view-slope',
                    icon: '📐',
                    tooltip: 'Slope Map',
                    action: () => this.switchViewMode('slope')
                },
                {
                    id: 'view-flow',
                    icon: '💧',
                    tooltip: 'Flow Map (WIP)',
                    action: () => this.switchViewMode('flow')
                },
                {
                    id: 'view-material',
                    icon: '🎨',
                    tooltip: 'Material Map (WIP)',
                    action: () => this.switchViewMode('material')
                }
            ],

            layoutActions: [],

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
    setUIComponents(scenePanel: ScenePanel, statusBar: StatusBar, detailsPanel: PropertiesPanel): void {
        this.scenePanel = scenePanel;
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
        
        // Initialize terrain WASM module with dynamic import
        try {
            appLogger.debug('Loading terrain WASM module...');
            // Import from crates pkg folder (same pattern as viewer)
            // @ts-ignore - WASM module from relative path
            this.terrainWasm = await import('../../../../crates/polylab-terrain/pkg/polylab_terrain.js');
            await this.terrainWasm.default(); // Initialize WASM
            
            // Store class references
            this.WasmTerrainConfigClass = this.terrainWasm.WasmTerrainConfig;
            this.TerrainHandleClass = this.terrainWasm.TerrainHandle;
            
            this.terrainWasmInitialized = true;
            appLogger.info('Terrain WASM module initialized successfully');
        } catch (error) {
            appLogger.error('Failed to initialize terrain WASM', error);
            this.terrainWasmInitialized = false;
        }
        
        // Set up visibility toggle callback
        if (this.scenePanel) {
            this.scenePanel.setVisibilityCallback((id: string, visible: boolean) => {
                viewer.set_mesh_visibility(id, visible);
                meshLogger.debug('Mesh visibility changed', { meshId: id, visible });
            });
        }
        
        // Initialize layout manager
        const container = document.getElementById('canvas-container');
        if (container) {
            this.layoutManager = new LayoutManager(container);
            this.registerLayouts();
            appLogger.info('Layout manager initialized for terrain views');
        } else {
            appLogger.warn('Canvas container not found, layout switching disabled');
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
            
            if (this.scenePanel) {
                this.scenePanel.removeMesh(this.currentTerrainId);
            }
            
            this.currentTerrainId = null;
        }
        
        // Cleanup layout manager
        if (this.layoutManager) {
            this.layoutManager.destroy();
            this.layoutManager = null;
        }
        
        // Clear terrain map data
        this.terrainMapData = {
            heightmap: null,
            slopeMap: null,
            flowMap: null,
            width: 0,
            height: 0
        };
        
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

        if (!this.terrainWasmInitialized) {
            appLogger.error('Cannot generate terrain: terrain WASM not initialized');
            if (this.statusBar) {
                this.statusBar.updateStats({ status: '❌ Terrain WASM not loaded' });
            }
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
                if (this.scenePanel) {
                    this.scenePanel.removeMesh(this.currentTerrainId);
                }
            }

            // Generate new terrain ID
            this.currentTerrainId = `terrain-${Date.now()}`;
            meshLogger.debug('🔍 Step 1: Creating terrain configuration...');

            // Create terrain configuration from UI parameters
            const config = new this.WasmTerrainConfigClass();
            config.width = this.params.widthSegments + 1;  // segments + 1 = vertices
            config.height = this.params.depthSegments + 1;
            config.resolution = this.params.width / this.params.widthSegments;  // world units per cell
            config.seed = BigInt(this.params.seed);
            config.frequency = 1.0 / this.params.scale;  // Convert scale to frequency
            config.octaves = this.params.octaves;
            config.persistence = this.params.persistence;
            config.lacunarity = 2.0;
            config.height_scale = 10.0;  // Default height scale
            
            // Capture dimensions BEFORE passing config to TerrainHandle
            // (WASM objects may be consumed/invalidated after use)
            const terrainWidth = config.width;
            const terrainHeight = config.height;
            
            meshLogger.debug('✅ Step 1 OK - Config created', { 
                width: terrainWidth, 
                height: terrainHeight,
                resolution: config.resolution
            });

            // Generate terrain using new system
            meshLogger.debug('🔍 Step 2: Creating terrain handle...');
            const terrainHandle = new this.TerrainHandleClass(config);
            meshLogger.debug('✅ Step 2 OK - TerrainHandle created');

            meshLogger.debug('🔍 Step 3: Getting mesh data from WASM...');
            const meshData = terrainHandle.getMeshData();
            meshLogger.debug('✅ Step 3 OK - Mesh data retrieved', {
                verticesLength: meshData.vertices?.length,
                colorsLength: meshData.colors?.length,
                facesLength: meshData.faces?.length
            });

            // Convert mesh data to OBJ format
            meshLogger.debug('🔍 Step 4: Converting to OBJ format...');
            const objContent = meshDataToObj(
                new Float32Array(meshData.vertices),
                new Float32Array(meshData.colors),
                new Uint32Array(meshData.faces)
            );
            meshLogger.debug('✅ Step 4 OK - OBJ content generated', { 
                objSize: objContent.length 
            });

            // Load mesh into viewer
            meshLogger.debug('🔍 Step 5: Loading mesh into viewer...');
            this.viewer.load_mesh(this.currentTerrainId, objContent);
            meshLogger.debug('✅ Step 5 OK - Mesh loaded into viewer');

            // Get mesh details
            meshLogger.debug('🔍 Step 6: Getting mesh details from viewer...');
            const details = this.viewer.mesh_details(this.currentTerrainId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
            meshLogger.debug('✅ Step 6 OK - Mesh details retrieved', { 
                vertices, 
                triangles 
            });

            // Store terrain map data for visualization in different views
            meshLogger.debug('🔍 Step 7: Getting heightmap from WASM...');
            let heightmap: Float32Array | null = null;
            try {
                heightmap = terrainHandle.getHeightmap();
                meshLogger.debug('✅ Step 7 OK - Heightmap retrieved', { 
                    length: heightmap?.length 
                });
            } catch (err) {
                meshLogger.error('❌ Step 7 FAILED - Error getting heightmap', { 
                    error: err 
                });
                throw err;
            }

            meshLogger.debug('🔍 Step 8: Getting slope map from WASM...');
            let slopeMap: Float32Array | null = null;
            try {
                slopeMap = terrainHandle.getSlopeMap() || null;
                meshLogger.debug('✅ Step 8 OK - Slope map retrieved', { 
                    length: slopeMap?.length 
                });
            } catch (err) {
                meshLogger.error('❌ Step 8 FAILED - Error getting slope map', { 
                    error: err 
                });
                throw err;
            }

            this.terrainMapData = {
                heightmap,
                slopeMap,
                flowMap: null, // Phase 2
                width: terrainWidth,   // Use captured value instead of config.width
                height: terrainHeight  // Use captured value instead of config.height
            };
            
            meshLogger.debug('✅ Step 9: Terrain maps stored for visualization', {
                heightmapSize: this.terrainMapData.heightmap?.length || 0,
                slopeMapSize: this.terrainMapData.slopeMap?.length || 0,
                dimensions: [this.terrainMapData.width, this.terrainMapData.height]
            });

            // Add mesh to MeshPanel
            if (this.scenePanel) {
                this.scenePanel.addMesh({
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
                dimensions: [sizeX, sizeY, sizeZ],
                heightRange: [meshData.stats.min_height, meshData.stats.max_height]
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
        
        if (this.scenePanel) {
            this.scenePanel.removeMesh(this.currentTerrainId);
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
        await this.loadMeshHelper(content, filename, {
            scenePanel: this.scenePanel,
            detailsPanel: this.detailsPanel,
            statusBar: this.statusBar
        });
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

    /**
     * Register all available view layouts
     * Generic layouts, specific content configured via terrainMapData
     */
    private registerLayouts(): void {
        if (!this.layoutManager) return;

        // Note: 'scene' mode is handled by restoreOriginal() in switchViewMode()
        // No need to register it as a layout

        // Heightmap layout - 2D elevation visualization
        this.layoutManager.registerLayout({
            id: 'heightmap',
            title: 'Heightmap View',
            setup: (container) => {
                appLogger.debug('[PerlinProject] Setting up Heightmap view');
                setupHeightmapView(container, this.terrainMapData);
            }
        });

        // Slope layout - 2D slope visualization
        this.layoutManager.registerLayout({
            id: 'slope',
            title: 'Slope Map View',
            setup: (container) => {
                appLogger.debug('[PerlinProject] Setting up Slope view');
                setupSlopeMapView(container, this.terrainMapData);
            }
        });

        // Flow layout - water flow visualization (Phase 2)
        this.layoutManager.registerLayout({
            id: 'flow',
            title: 'Flow Map View',
            setup: (container) => {
                appLogger.debug('[PerlinProject] Setting up Flow view');
                setupFlowMapView(container, this.terrainMapData);
            }
        });

        // Material layout - material splat map (Phase 3)
        this.layoutManager.registerLayout({
            id: 'material',
            title: 'Material Map View',
            setup: (container) => {
                appLogger.debug('[PerlinProject] Setting up Material view');
                setupMaterialMapView(container, this.terrainMapData);
            }
        });

        appLogger.info('[PerlinProject] All terrain view layouts registered');
    }

    /**
     * Switch between visualization modes
     * @param mode - 'scene' (3D), 'heightmap', 'slope', 'flow', 'material'
     */
    private async switchViewMode(mode: string): Promise<void> {
        if (!this.layoutManager) {
            appLogger.warn('[PerlinProject] Cannot switch view: layout manager not initialized');
            return;
        }

        // Check if terrain data is available for non-scene modes
        if (mode !== 'scene' && !this.terrainMapData.heightmap) {
            appLogger.warn('[PerlinProject] Cannot switch to map view: terrain not generated yet');
            if (this.statusBar) {
                this.statusBar.updateStats({ status: '⚠️ Generate terrain first' });
            }
            return;
        }

        try {
            appLogger.info(`[PerlinProject] Switching to ${mode} view`);

            if (mode === 'scene') {
                // Restore original 3D canvas
                await this.layoutManager.restoreOriginal();
            } else {
                // Switch to 2D map layout
                await this.layoutManager.switchLayout(mode);
            }

            this.currentViewMode = mode;

            // Update status bar
            if (this.statusBar) {
                const viewNames: Record<string, string> = {
                    'scene': '3D Scene',
                    'heightmap': 'Heightmap',
                    'slope': 'Slope Map',
                    'flow': 'Flow Map',
                    'material': 'Material Map'
                };
                this.statusBar.updateStats({
                    status: `👁️ ${viewNames[mode] || mode}`
                });
            }

            appLogger.info(`[PerlinProject] View switched to: ${mode}`);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('[PerlinProject] Failed to switch view', { mode, error: errorMsg });
            if (this.statusBar) {
                this.statusBar.updateStats({ status: `❌ View switch failed` });
            }
        }
    }
}
