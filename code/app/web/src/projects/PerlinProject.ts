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
import { TerrainPipelineBanner } from '../components/TerrainPipelineBanner';
import { TerrainStageParameters } from '../components/TerrainStageParameters';
import type { ViewerCanvas } from '../components/ViewerCanvas';
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
    private viewerCanvas: ViewerCanvas | null = null;
    private pipelineBanner: TerrainPipelineBanner | null = null;
    private stageParameters: TerrainStageParameters | null = null;
    private currentTerrainId: string | null = null;
    private terrainWasmInitialized: boolean = false;
    private layoutManager: LayoutManager | null = null;
    private currentViewMode: string = 'scene'; // Default: 3D scene
    
    // Terrain WASM module (loaded dynamically)
    private terrainWasm: any = null;
    private WasmTerrainConfigClass: any = null;
    private TerrainHandleClass: any = null;
    private terrainHandle: any = null; // Current terrain handle for step-by-step pipeline
    
    // Terrain map data for visualization
    private terrainMapData: TerrainMapData = {
        heightmap: null,
        slopeMap: null,
        flowMap: null,
        width: 0,
        height: 0
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
    setUIComponents(scenePanel: ScenePanel, statusBar: StatusBar, detailsPanel: PropertiesPanel, viewerCanvas?: ViewerCanvas): void {
        this.scenePanel = scenePanel;
        this.statusBar = statusBar;
        this.detailsPanel = detailsPanel;
        this.viewerCanvas = viewerCanvas || null;
        
        // Create pipeline banner (horizontal banner above viewer)
        this.pipelineBanner = new TerrainPipelineBanner();
        
        // Create stage parameters component (for PropertiesPanel)
        this.stageParameters = new TerrainStageParameters();
        
        // Register callbacks for banner interactions
        this.pipelineBanner.onStageSelect((stageId) => {
            // Show parameters for selected stage
            if (this.stageParameters) {
                this.stageParameters.showStage(stageId);
            }
            appLogger.debug('Stage selected', { stageId });
        });
        
        this.pipelineBanner.onExecute(() => {
            // Execute current selected stage
            const stageId = this.pipelineBanner?.getSelectedStageId();
            if (stageId && this.stageParameters) {
                const params = this.stageParameters.getStageParameters(stageId);
                this.executeStage(stageId, params);
            }
        });
        
        this.pipelineBanner.onExecuteAll(() => {
            // Execute all remaining stages
            this.executeAllStages();
        });
        
        // Show initial stage parameters (Base Terrain)
        if (this.stageParameters) {
            this.stageParameters.showStage('base');
        }

        appLogger.debug('Terrain pipeline components initialized');
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
        
        // NOTE: We do NOT remove the terrain mesh from the viewer here!
        // Meshes should persist in the scene when switching projects.
        // Only UI-specific resources are cleaned up.
        
        // Cleanup layout manager
        if (this.layoutManager) {
            this.layoutManager.destroy();
            this.layoutManager = null;
        }
        
        // Note: terrainMapData and currentTerrainId are kept in memory
        // so the terrain persists when switching back to this project
    }

    onActivate(): void {
        appLogger.debug('Perlin project activated');
        
        // Update status bar
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '🏔️ Perlin Terrain - Select a stage to configure'
            });
        }
        
        // Inject pipeline banner into permanent container (above canvas-container)
        const bannerContainer = document.getElementById('terrain-banner-container');
        if (bannerContainer && this.pipelineBanner) {
            bannerContainer.innerHTML = '';
            bannerContainer.appendChild(this.pipelineBanner.element);
            appLogger.debug('Pipeline banner injected into permanent container');
        }
        
        // Inject stage parameters into PropertiesPanel (directly, no sub-sections)
        if (this.detailsPanel && this.stageParameters) {
            this.detailsPanel.element.querySelector('.panel-content')!.innerHTML = '';
            this.detailsPanel.element.querySelector('.panel-content')!.appendChild(this.stageParameters.element);
            appLogger.debug('Stage parameters injected into PropertiesPanel');
        }
    }

    onDeactivate(): void {
        appLogger.debug('Perlin project deactivated');
        
        // Clear pipeline banner from permanent container
        const bannerContainer = document.getElementById('terrain-banner-container');
        if (bannerContainer) {
            bannerContainer.innerHTML = '';
        }
        
        // Clear PropertiesPanel
        if (this.detailsPanel) {
            this.detailsPanel.element.querySelector('.panel-content')!.innerHTML = '';
        }
    }

    /**
     * Execute a single stage of the pipeline
     */
    private async executeStage(stageId: string, params: Record<string, any>): Promise<void> {
        if (!this.viewer || !this.terrainWasmInitialized) {
            throw new Error('Viewer or terrain WASM not initialized');
        }

        meshLogger.info(`Executing stage: ${stageId}`, params);

        // Mark stage as active
        if (this.pipelineBanner) {
            this.pipelineBanner.updateStageStatus(stageId, 'active');
        }

        try {
            switch (stageId) {
                case 'base':
                    await this.executeBaseStage(params);
                    break;
                case 'noise':
                    await this.executeNoiseStage(params);
                    break;
                case 'slope':
                    await this.executeSlopeStage();
                    break;
                case 'mesh':
                    await this.executeMeshStage(params);
                    break;
                default:
                    throw new Error(`Unknown stage: ${stageId}`);
            }

            // Mark stage as completed
            if (this.pipelineBanner) {
                this.pipelineBanner.updateStageStatus(stageId, 'completed');
            }

            meshLogger.info(`Stage completed: ${stageId}`);
        } catch (error) {
            // Mark stage as pending (failed)
            if (this.pipelineBanner) {
                this.pipelineBanner.updateStageStatus(stageId, 'pending');
            }
            meshLogger.error(`Stage failed: ${stageId}`, { error });
            throw error;
        }
    }

    /**
     * Execute all remaining stages at once (legacy mode)
     */
    private async executeAllStages(): Promise<void> {
        meshLogger.info('Executing all stages sequentially');

        const stages = ['base', 'noise', 'slope', 'mesh'];
        const selectedStageId = this.pipelineBanner?.getSelectedStageId();
        const startIndex = selectedStageId ? stages.indexOf(selectedStageId) : 0;

        for (let i = startIndex; i < stages.length; i++) {
            const stageId = stages[i];
            const params = this.stageParameters?.getStageParameters(stageId) || {};
            await this.executeStage(stageId, params);
        }

        meshLogger.info('All stages completed');
    }

    /**
     * Base terrain stage: create flat heightmap
     */
    private async executeBaseStage(params: Record<string, any>): Promise<void> {
        const size = parseInt(params.size) || 256;
        const resolution = params.resolution || 1.0;
        const seed = params.seed || 12345;

        meshLogger.debug('Creating base terrain', { size, resolution, seed });

        // Create base terrain handle
        this.terrainHandle = this.TerrainHandleClass.createBase(
            size,
            size,
            resolution,
            BigInt(seed)
        );

        // Store terrain ID (reuse if exists, otherwise create new)
        if (!this.currentTerrainId) {
            this.currentTerrainId = `terrain-${Date.now()}`;
        }

        // Initialize all map data (heightmap, slopeMap, etc.) with default values
        // This ensures maps are always available, even before their stages run
        this.updateMapData();

        // Generate and display mesh immediately (flat plane)
        await this.generateAndDisplayMesh({ applyColor: true, calculateNormals: true });

        // Update status
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: `✅ Base terrain created (${size}×${size})`
            });
        }

        meshLogger.info('Base terrain created and displayed', { size, resolution });
    }

    /**
     * Noise stage: apply Perlin noise to heightmap
     */
    private async executeNoiseStage(params: Record<string, any>): Promise<void> {
        if (!this.terrainHandle) {
            throw new Error('No terrain handle - execute base stage first');
        }

        const frequency = params.frequency || 0.05;
        const octaves = params.octaves || 6;
        const persistence = params.persistence || 0.5;
        const lacunarity = params.lacunarity || 2.0;
        const heightScale = params.heightScale || 10.0;

        meshLogger.debug('Adding noise stage', params);

        // Add noise stage to pipeline
        this.terrainHandle.addNoiseStage(frequency, octaves, persistence, lacunarity, heightScale);

        // Execute the stage
        const stageName = this.terrainHandle.executeNextStep();
        meshLogger.info(`Executed stage: ${stageName}`);

        // Update map data (heightmap has been modified by noise)
        this.updateMapData();

        // Regenerate and display mesh with new height data
        await this.generateAndDisplayMesh({ applyColor: true, calculateNormals: true });

        // Update status
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '✅ Perlin noise applied'
            });
        }
    }

    /**
     * Slope stage: calculate terrain steepness
     */
    private async executeSlopeStage(): Promise<void> {
        if (!this.terrainHandle) {
            throw new Error('No terrain handle - execute base stage first');
        }

        meshLogger.debug('Adding slope stage');

        // Add slope stage to pipeline
        this.terrainHandle.addSlopeStage();

        // Execute the stage
        const stageName = this.terrainHandle.executeNextStep();
        meshLogger.info(`Executed stage: ${stageName}`);

        // Update map data (slope map has been recalculated)
        this.updateMapData();

        // Update status
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '✅ Slope map calculated'
            });
        }
    }

    /**
     * Mesh stage: regenerate mesh with specific options (colors, normals)
     */
    private async executeMeshStage(params: Record<string, any>): Promise<void> {
        if (!this.terrainHandle) {
            throw new Error('No terrain handle - execute base stage first');
        }

        const applyColor = params.applyColor !== undefined ? params.applyColor : true;
        const calculateNormals = params.calculateNormals !== undefined ? params.calculateNormals : true;

        meshLogger.debug('Mesh stage: regenerating with options', { applyColor, calculateNormals });

        // Regenerate mesh with specific rendering options
        await this.generateAndDisplayMesh({ applyColor, calculateNormals });

        // Update status
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '✅ 3D mesh generated with final options'
            });
        }

        meshLogger.info('Final mesh generated with rendering options', { applyColor, calculateNormals });
    }

    /**
     * Helper: Update terrain map data for visualization
     * Retrieves all maps from WASM and updates terrainMapData
     */
    private updateMapData(): void {
        if (!this.terrainHandle) {
            meshLogger.warn('Cannot update map data: terrain handle not initialized');
            return;
        }

        try {
            // Get all map data from WASM
            const heightmapRaw = this.terrainHandle.getHeightmap();
            const slopeMapRaw = this.terrainHandle.getSlopeMap();
            
            // Convert to Float32Array (WASM returns plain Array, not typed array)
            this.terrainMapData.heightmap = heightmapRaw ? new Float32Array(heightmapRaw) : null;
            this.terrainMapData.slopeMap = slopeMapRaw ? new Float32Array(slopeMapRaw) : null;
            this.terrainMapData.width = this.terrainHandle.getWidth();
            this.terrainMapData.height = this.terrainHandle.getHeight();

            meshLogger.debug('Terrain map data updated', { 
                width: this.terrainMapData.width, 
                height: this.terrainMapData.height,
                expectedLength: this.terrainMapData.width * this.terrainMapData.height,
                heightmapLength: this.terrainMapData.heightmap?.length,
                slopeMapLength: this.terrainMapData.slopeMap?.length,
                heightmapType: this.terrainMapData.heightmap?.constructor?.name,
                slopeMapType: this.terrainMapData.slopeMap?.constructor?.name
            });
        } catch (err) {
            meshLogger.error('Could not retrieve terrain map data', { error: err });
        }
    }

    /**
     * Helper: Generate mesh from current terrain state and display in viewer
     * This can be called after any stage to visualize the current terrain
     */
    private async generateAndDisplayMesh(options: { applyColor: boolean; calculateNormals: boolean }): Promise<void> {
        if (!this.terrainHandle || !this.viewer) {
            throw new Error('Cannot generate mesh: terrain handle or viewer not initialized');
        }

        meshLogger.debug('Generating mesh from current terrain state', options);

        // Add mesh stage to pipeline (or update if already exists)
        this.terrainHandle.addMeshStage(options.applyColor, options.calculateNormals);

        // Execute mesh generation
        const stageName = this.terrainHandle.executeNextStep();
        meshLogger.debug(`Executed: ${stageName}`);

        // Get mesh data from WASM
        const meshData = this.terrainHandle.getMeshData();

        // Convert mesh data to OBJ format
        const objContent = meshDataToObj(
            new Float32Array(meshData.vertices),
            new Float32Array(meshData.colors),
            new Uint32Array(meshData.faces)
        );

        // Remove old mesh if exists
        if (this.currentTerrainId && this.viewer) {
            try {
                this.viewer.remove_mesh(this.currentTerrainId);
                if (this.scenePanel) {
                    this.scenePanel.removeMesh(this.currentTerrainId);
                }
                meshLogger.debug('Removed old mesh', { id: this.currentTerrainId });
            } catch (err) {
                meshLogger.debug('No old mesh to remove');
            }
        }

        // Load mesh into viewer
        this.viewer.load_mesh(this.currentTerrainId!, objContent);

        // Get mesh details
        const details = this.viewer.mesh_details(this.currentTerrainId!);
        const [vertices, triangles, sizeX, sizeY, sizeZ] = details;

        // Add/update mesh in ScenePanel
        if (this.scenePanel) {
            // Remove if exists, then add fresh
            this.scenePanel.removeMesh(this.currentTerrainId!);
            this.scenePanel.addMesh({
                id: this.currentTerrainId!,
                name: `Terrain`,
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
                vertices: Math.round(vertices),
                triangles: Math.round(triangles)
            });
        }

        meshLogger.info('Mesh generated and displayed', {
            terrainId: this.currentTerrainId,
            vertices: Math.round(vertices),
            triangles: Math.round(triangles),
            dimensions: [sizeX, sizeY, sizeZ]
        });
    }

    /**
     * Generate terrain with current parameters (LEGACY - deprecated, use pipeline timeline instead)
     * @deprecated Use the pipeline timeline for step-by-step terrain generation
     */
    private generateTerrain(): void {
        meshLogger.warn('generateTerrain() is deprecated - use pipeline timeline instead');
        // This method is kept for compatibility but is no longer the recommended approach
        // Users should use the pipeline timeline UI for step-by-step generation
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
