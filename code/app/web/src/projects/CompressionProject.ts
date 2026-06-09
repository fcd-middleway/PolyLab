/**
 * Compression Project
 * 
 * Progressive mesh compression and decompression visualization.
 * Load meshes, compress them, and visualize compression results.
 * 
 * Pipeline stages:
 * 1. Load: Load OBJ file
 * 2. AIF: Convert to Already-Indexed Format
 * 3. Pre-process: Topology analysis and validation
 * 4. Simplify: Progressive edge collapse
 * 5. Export: Export simplified mesh
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { ScenePanel } from '../components/ScenePanel';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import type { StatusBar } from '../components/StatusBar';
import { CompressionPipelineBanner } from '../components/CompressionPipelineBanner';
import { CompressionStageParameters } from '../components/CompressionStageParameters';
import type { BatchTestResult } from '../components/CompressionPipelineBanner';
import { appLogger, meshLogger } from '../utils/logger';

export class CompressionProject extends BaseProject {
    private scenePanel: ScenePanel | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private statusBar: StatusBar | null = null;
    private pipelineBanner: CompressionPipelineBanner | null = null;
    private stageParameters: CompressionStageParameters | null = null;
    
    private currentMeshId: string | null = null;
    private currentFilename: string | null = null;
    private currentMeshContent: string | null = null; // OBJ content for re-processing
    private isCompressed: boolean = false;
    private compressionHandle: any = null; // CompressionHandle from WASM
    private currentMetric: string = 'EdgeLength'; // Default metric
    
    // Pipeline state tracking
    private pipelineState = {
        loaded: false,
        aifConverted: false,
        preprocessed: false,
        simplified: false,
        exported: false
    };
    
    // Render modes
    private renderModes = {
        solid: true,
        wireframe: false,
        vertices: false
    };

    getId(): string {
        return 'compression';
    }

    getName(): string {
        return 'Mesh Compression';
    }

    getConfig(): ProjectConfig {
        return {
            name: 'Mesh Compression',
            icon: '📦',
            
            fileCallbacks: {
                onLoad: (content: string, filename: string) => this.loadMesh(content, filename),
                onError: (error: Error) => this.handleLoadError(error)
            },

            // NOTE: viewCallbacks are now configured globally in UIManager.setViewer()
            // No need to configure them per-project anymore!

            toolbarActions: [
                {
                    id: 'simplify-mesh',
                    icon: '⚡',
                    tooltip: 'Simplify Mesh',
                    action: () => this.compressMesh()
                },
                {
                    id: 'reset-mesh',
                    icon: '🔄',
                    tooltip: 'Reset Mesh',
                    action: () => this.resetMesh()
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
                    id: 'compression-details',
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
    setUIComponents(scenePanel: ScenePanel, detailsPanel: PropertiesPanel, statusBar: StatusBar): void {
        this.scenePanel = scenePanel;
        this.detailsPanel = detailsPanel;
        this.statusBar = statusBar;
        
        // Create pipeline banner
        this.pipelineBanner = new CompressionPipelineBanner();
        
        // Create stage parameters component
        this.stageParameters = new CompressionStageParameters();
        
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
        
        this.pipelineBanner.onBatchTest((targetStage) => {
            // Run batch testing on all test assets
            this.runBatchTest(targetStage);
        });
        
        // Show initial stage parameters
        if (this.stageParameters) {
            this.stageParameters.showStage('load');
        }
        
        appLogger.debug('Compression pipeline components initialized');
    }

    async init(viewer: any): Promise<void> {
        appLogger.info('Initializing Compression project...');
        this.viewer = viewer;
        
        // Set up visibility toggle callback
        if (this.scenePanel) {
            this.scenePanel.setVisibilityCallback((id: string, visible: boolean) => {
                viewer.set_mesh_visibility(id, visible);
                meshLogger.debug('Mesh visibility changed', { meshId: id, visible });
            });
        }
        
        appLogger.info('Compression project ready');
    }

    update(deltaTime: number): void {
        // No per-frame updates needed
    }

    cleanup(): void {
        appLogger.info('Cleaning up Compression project...');
        
        // Remove current mesh if exists
        if (this.currentMeshId && this.viewer) {
            this.viewer.remove_mesh(this.currentMeshId);
            
            if (this.scenePanel) {
                this.scenePanel.removeMesh(this.currentMeshId);
            }
            
            this.currentMeshId = null;
        }
        
        this.isCompressed = false;
    }

    onActivate(): void {
        appLogger.debug('Compression project activated');
        
        // Update status bar
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '📦 Mesh Compression - Select a stage to configure'
            });
        }
        
        // Inject pipeline banner into permanent container (above canvas-container)
        // Reuse the terrain-banner-container from Perlin
        const bannerContainer = document.getElementById('terrain-banner-container');
        if (bannerContainer && this.pipelineBanner) {
            bannerContainer.innerHTML = '';
            bannerContainer.appendChild(this.pipelineBanner.element);
            appLogger.debug('Compression pipeline banner injected');
        }
        
        // Inject stage parameters into PropertiesPanel
        if (this.detailsPanel && this.stageParameters) {
            this.detailsPanel.element.querySelector('.panel-content')!.innerHTML = '';
            this.detailsPanel.element.querySelector('.panel-content')!.appendChild(this.stageParameters.element);
            appLogger.debug('Stage parameters injected into PropertiesPanel');
        }
    }

    onDeactivate(): void {
        appLogger.debug('Compression project deactivated');
        
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
     * Execute a single stage of the compression pipeline
     */
    private async executeStage(stageId: string, params: Record<string, any>): Promise<void> {
        if (!this.viewer) {
            throw new Error('Viewer not initialized');
        }

        meshLogger.info(`Executing stage: ${stageId}`, params);

        // Mark stage as active
        if (this.pipelineBanner) {
            this.pipelineBanner.updateStageStatus(stageId, 'active');
        }

        try {
            switch (stageId) {
                case 'load':
                    // Load stage is triggered by file picker, so this just validates
                    if (!this.pipelineState.loaded) {
                        throw new Error('No mesh loaded yet. Use file picker to load an OBJ file.');
                    }
                    break;
                case 'aif':
                    await this.executeAIFStage();
                    break;
                case 'preprocess':
                    await this.executePreprocessStage();
                    break;
                case 'simplify':
                    await this.executeSimplifyStage(params);
                    break;
                case 'export':
                    await this.executeExportStage(params);
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
            // Mark stage as failed
            if (this.pipelineBanner) {
                this.pipelineBanner.updateStageStatus(stageId, 'failed');
            }
            const errorMsg = error instanceof Error ? error.message : String(error);
            meshLogger.error(`Stage failed: ${stageId}`, { error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${stageId}: ${errorMsg}` });
            throw error;
        }
    }

    /**
     * Execute all remaining stages
     */
    private async executeAllStages(): Promise<void> {
        meshLogger.info('Executing all stages sequentially');

        const stages = ['load', 'aif', 'preprocess', 'simplify', 'export'];
        const selectedStageId = this.pipelineBanner?.getSelectedStageId();
        const startIndex = selectedStageId ? stages.indexOf(selectedStageId) : 0;

        for (let i = startIndex; i < stages.length; i++) {
            const stageId = stages[i];
            const params = this.stageParameters?.getStageParameters(stageId) || {};
            
            try {
                await this.executeStage(stageId, params);
            } catch (error) {
                // Stop execution on first error
                meshLogger.error('Pipeline stopped due to error', { stageId });
                return;
            }
        }

        meshLogger.info('All stages completed successfully');
        this.statusBar?.updateStats({ status: '✅ Pipeline completed' });
    }

    /**
     * AIF conversion stage: Convert loaded mesh to Already-Indexed Format
     */
    private async executeAIFStage(): Promise<void> {
        if (!this.pipelineState.loaded || !this.currentMeshContent) {
            throw new Error('No mesh loaded. Load a mesh first.');
        }

        meshLogger.debug('Converting mesh to AIF format');
        this.statusBar?.updateStats({ status: '🔄 Converting to AIF...' });

        // Parse OBJ to get vertices and faces
        const meshData = this.parseOBJ(this.currentMeshContent);
        
        // Load the AIF-based compression WASM module dynamically
        try {
            // @ts-ignore - WASM module
            const compressionWasm = await import('../../../../crates/polylab-compression/pkg/polylab_compression.js');
            await compressionWasm.default();
            
            // Create CompressionHandle with the mesh data
            // Note: wasm-bindgen constructors use 'new', not '.new()'
            this.compressionHandle = new compressionWasm.CompressionHandle(
                this.currentMeshId || 'mesh',
                meshData.vertices,
                meshData.faces
            );
            
            const stats = this.compressionHandle.get_stats();
            this.pipelineState.aifConverted = true;
            
            this.statusBar?.updateStats({ 
                status: '✅ AIF conversion complete',
                vertices: stats.vertices,
                triangles: stats.faces
            });
            
            meshLogger.info('AIF conversion successful', { stats });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`AIF conversion failed: ${errorMsg}`);
        }
    }

    /**
     * Pre-process stage: Topology analysis and validation
     * TODO: Implement actual topology validation (manifold detection, etc.)
     */
    private async executePreprocessStage(): Promise<void> {
        if (!this.pipelineState.aifConverted || !this.compressionHandle) {
            throw new Error('AIF not converted yet. Convert to AIF first.');
        }

        meshLogger.debug('Pre-processing mesh (topology analysis, validation)');
        this.statusBar?.updateStats({ status: '🔍 Pre-processing...' });

        // TODO: Call WASM functions for topology analysis
        // For now, this is a placeholder
        
        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.pipelineState.preprocessed = true;
        
        this.statusBar?.updateStats({ 
            status: '✅ Pre-processing complete (manifold analysis pending)'
        });
        
        meshLogger.info('Pre-processing complete (placeholder)');
    }

    /**
     * Simplify stage: Progressive edge collapse simplification
     */
    private async executeSimplifyStage(params: Record<string, any>): Promise<void> {
        if (!this.pipelineState.preprocessed || !this.compressionHandle) {
            throw new Error('Pre-processing not done yet. Complete pre-processing first.');
        }

        const targetRatio = params.targetRatio || 0.9;
        const metric = params.metric || 'EdgeLength';
        
        meshLogger.debug('Simplifying mesh', { targetRatio, metric });
        this.statusBar?.updateStats({ status: '⚡ Simplifying...' });
        
        try {
            // Perform simplification
            const result = this.compressionHandle.simplify_step(targetRatio, metric);
            
            // Convert arrays to TypedArrays
            const verticesArray = new Float32Array(result.vertices);
            const facesArray = new Uint32Array(result.faces);
            
            // Update viewer with new geometry
            if (this.currentMeshId) {
                this.viewer.update_mesh(
                    this.currentMeshId,
                    verticesArray,
                    facesArray
                );
            }
            
            this.pipelineState.simplified = true;
            
            // Display stats
            this.displayStats(result.stats);
            
            const reduction = result.stats.original_vertices - result.stats.vertices;
            this.statusBar?.updateStats({ 
                status: `⚡ Simplified: -${reduction} vertices`,
                vertices: result.stats.vertices,
                triangles: result.stats.faces
            });
            
            meshLogger.info('Simplification complete', { 
                vertices: result.stats.vertices,
                reduction 
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Simplification failed: ${errorMsg}`);
        }
    }

    /**
     * Export stage: Export simplified mesh
     */
    private async executeExportStage(params: Record<string, any>): Promise<void> {
        if (!this.pipelineState.simplified || !this.compressionHandle) {
            throw new Error('Mesh not simplified yet. Simplify the mesh first.');
        }

        const format = params.format || 'obj';
        
        meshLogger.debug('Exporting mesh', { format });
        this.statusBar?.updateStats({ status: '💾 Exporting...' });
        
        // TODO: Implement actual export (download OBJ file)
        // For now, just mark as complete
        
        this.pipelineState.exported = true;
        
        this.statusBar?.updateStats({ 
            status: '✅ Export ready (download feature WIP)'
        });
        
        meshLogger.info('Export stage complete (placeholder)');
    }

    /**
     * Run batch testing on all test assets
     */
    private async runBatchTest(targetStage: string): Promise<void> {
        meshLogger.info('Starting batch test', { targetStage });
        this.statusBar?.updateStats({ status: '🧪 Running batch test...' });
        
        const results: BatchTestResult[] = [];
        const testAssets = this.getTestAssets();
        
        for (const asset of testAssets) {
            try {
                meshLogger.debug('Testing asset', { asset });
                
                // Load the test asset
                const response = await fetch(`/test-assets/compression/${asset.category}/${asset.filename}`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${asset.filename}`);
                }
                const content = await response.text();
                
                // Reset pipeline state
                this.resetPipelineState();
                
                // Load mesh
                this.currentMeshContent = content;
                this.currentFilename = asset.filename;
                this.currentMeshId = `test-${Date.now()}`;
                this.pipelineState.loaded = true;
                
                // Execute stages up to target
                const stages = ['load', 'aif', 'preprocess', 'simplify', 'export'];
                const stopIndex = stages.indexOf(targetStage);
                
                for (let i = 0; i <= stopIndex; i++) {
                    const stageId = stages[i];
                    const params = this.stageParameters?.getStageParameters(stageId) || {};
                    await this.executeStage(stageId, params);
                }
                
                // Get final stats
                const stats = this.compressionHandle?.get_stats();
                
                results.push({
                    meshName: asset.filename,
                    success: true,
                    stats: stats ? {
                        vertices: stats.vertices,
                        faces: stats.faces,
                        edges: stats.edges
                    } : undefined
                });
                
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                results.push({
                    meshName: asset.filename,
                    success: false,
                    failedStage: targetStage,
                    error: errorMsg
                });
                meshLogger.error('Batch test failed for asset', { asset, error: errorMsg });
            }
        }
        
        // Display results
        if (this.pipelineBanner) {
            this.pipelineBanner.displayBatchResults(results);
        }
        
        const successCount = results.filter(r => r.success).length;
        this.statusBar?.updateStats({ 
            status: `🧪 Batch test complete: ${successCount}/${results.length} passed`
        });
        
        meshLogger.info('Batch test complete', { 
            total: results.length, 
            success: successCount, 
            failed: results.length - successCount 
        });
    }

    /**
     * Get list of test assets for batch testing
     */
    private getTestAssets(): Array<{ category: string; filename: string }> {
        return [
            // Manifold Simple
            { category: 'manifold_simple', filename: 'triangle.obj' },
            { category: 'manifold_simple', filename: 'quad.obj' },
            { category: 'manifold_simple', filename: 'two_triangles.obj' },
            { category: 'manifold_simple', filename: 'cube_tris.obj' },
            { category: 'manifold_simple', filename: 'cube_quads.obj' },
            { category: 'manifold_simple', filename: 'sphere_low.obj' },
            // Non-Manifold
            { category: 'non_manifold', filename: 't_junction.obj' },
            { category: 'non_manifold', filename: 'pinch_point.obj' },
            { category: 'non_manifold', filename: 'open_surface.obj' },
            { category: 'non_manifold', filename: 'multiple_holes.obj' },
            { category: 'non_manifold', filename: 'wing_edge.obj' },
            // Degenerate
            { category: 'degenerate', filename: 'zero_area_face.obj' },
            { category: 'degenerate', filename: 'zero_length_edge.obj' },
            { category: 'degenerate', filename: 'isolated_vertex.obj' },
            // Polygonal
            { category: 'polygonal', filename: 'pentagon.obj' },
            { category: 'polygonal', filename: 'hexagon.obj' },
            { category: 'polygonal', filename: 'quad_strip.obj' },
            { category: 'polygonal', filename: 'mixed_valence.obj' }
        ];
    }

    /**
     * Reset pipeline state
     */
    private resetPipelineState(): void {
        this.pipelineState = {
            loaded: false,
            aifConverted: false,
            preprocessed: false,
            simplified: false,
            exported: false
        };
        
        if (this.pipelineBanner) {
            this.pipelineBanner.reset();
        }
    }

    /**
     * Parse OBJ content to extract vertices and faces
     */
    private parseOBJ(content: string): { vertices: Float32Array; faces: Uint32Array } {
        const vertices: number[] = [];
        const faces: number[] = [];
        
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('v ')) {
                // Vertex line
                const parts = trimmed.split(/\s+/);
                vertices.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (trimmed.startsWith('f ')) {
                // Face line
                const parts = trimmed.split(/\s+/).slice(1);
                const indices = parts.map(p => {
                    const idx = parseInt(p.split('/')[0]);
                    return idx > 0 ? idx - 1 : vertices.length / 3 + idx;
                });
                
                // Triangulate if needed (assuming convex polygons)
                for (let i = 1; i < indices.length - 1; i++) {
                    faces.push(indices[0], indices[i], indices[i + 1]);
                }
            }
        }
        
        return {
            vertices: new Float32Array(vertices),
            faces: new Uint32Array(faces)
        };
    }

    /**
     * Handle mesh file loaded from file picker (inherited from BaseProject)
     */
    protected async onMeshFileLoaded(content: string, filename: string): Promise<void> {
        try {
            appLogger.info('[CompressionProject] Loading mesh from file picker', { filename, size: content.length });
            this.statusBar?.updateStats({ status: `Loading ${filename}...` });
            
            // Remove old mesh if exists
            if (this.currentMeshId && this.viewer) {
                this.viewer.remove_mesh(this.currentMeshId);
                this.scenePanel?.removeMesh(this.currentMeshId);
            }
            
            // Reset pipeline state for new mesh
            this.resetPipelineState();
            
            // Generate unique mesh ID
            this.currentMeshId = `mesh-${Date.now()}`;
            this.currentFilename = filename;
            this.currentMeshContent = content; // Store for re-processing
            
            // Load mesh into viewer (display only)
            this.viewer.load_mesh(this.currentMeshId, content);
            
            // Get mesh details
            const details = this.viewer.mesh_details(this.currentMeshId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
            
            // Add mesh to scene panel
            this.scenePanel?.addMesh({
                id: this.currentMeshId,
                name: filename,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles),
                visible: true
            });
            
            // Mark "load" stage as completed
            this.pipelineState.loaded = true;
            if (this.pipelineBanner) {
                this.pipelineBanner.updateStageStatus('load', 'completed');
            }
            
            // Update status bar
            this.statusBar?.updateStats({ 
                status: `✅ Loaded ${filename} - Ready for pipeline`,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles)
            });
            
            appLogger.info('[CompressionProject] Mesh loaded successfully', { 
                meshId: this.currentMeshId,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles)
            });
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('[CompressionProject] Failed to load mesh', { error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ Error: ${errorMsg}` });
        }
    }

    /**
     * Simplify the current mesh (legacy toolbar button - delegates to pipeline)
     */
    private async compressMesh(): Promise<void> {
        // Delegate to simplify stage
        const params = this.stageParameters?.getStageParameters('simplify') || {};
        await this.executeStage('simplify', params);
    }

    /**
     * Reset the mesh to original (legacy toolbar button)
     */
    private async resetMesh(): Promise<void> {
        if (!this.compressionHandle) {
            appLogger.warn('No mesh to reset');
            this.statusBar?.updateStats({ status: '⚠️ Load a mesh first' });
            return;
        }

        try {
            meshLogger.info('Resetting mesh');
            this.statusBar?.updateStats({ status: '🔄 Resetting...' });
            
            const result = this.compressionHandle.reset();
            
            const verticesArray = new Float32Array(result.vertices);
            const facesArray = new Uint32Array(result.faces);
            
            if (this.currentMeshId) {
                this.viewer.update_mesh(
                    this.currentMeshId,
                    verticesArray,
                    facesArray
                );
            }
            
            this.displayStats(result.stats);
            
            this.statusBar?.updateStats({ 
                status: '🔄 Mesh reset to original',
                vertices: result.stats.vertices,
                triangles: result.stats.faces
            });
            
            meshLogger.info('Mesh reset successfully');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            meshLogger.error('Failed to reset mesh', { error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }

    /**
     * Display compression statistics
     */
    private displayStats(stats: any): void {
        if (!this.detailsPanel) return;

        const compressionPercent = ((1 - stats.compression_ratio) * 100).toFixed(1);
        
        const statsHTML = `
            <div class="compression-stats">
                <div class="stats-section">
                    <h5>Original</h5>
                    <div class="stats-row">
                        <span>Vertices:</span>
                        <span>${stats.original_vertices.toLocaleString()}</span>
                    </div>
                    <div class="stats-row">
                        <span>Faces:</span>
                        <span>${stats.original_faces.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h5>Current</h5>
                    <div class="stats-row">
                        <span>Vertices:</span>
                        <span>${stats.vertices.toLocaleString()}</span>
                    </div>
                    <div class="stats-row">
                        <span>Faces:</span>
                        <span>${stats.faces.toLocaleString()}</span>
                    </div>
                    <div class="stats-row">
                        <span>Edges:</span>
                        <span>${stats.edges.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h5>Compression</h5>
                    <div class="stats-row">
                        <span>Reduction:</span>
                        <span>${compressionPercent}%</span>
                    </div>
                    <div class="stats-row">
                        <span>Collapsed:</span>
                        <span>${stats.collapsed_edges.toLocaleString()}</span>
                    </div>
                    <div class="stats-row">
                        <span>Metric:</span>
                        <span>${stats.metric_name}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Inject directly into PropertiesPanel content (no subsection)
        const content = this.detailsPanel.element.querySelector('.panel-content');
        if (content) {
            // Find or create stats container after stage parameters
            let statsContainer = content.querySelector('.compression-stats-container') as HTMLElement;
            if (!statsContainer) {
                statsContainer = document.createElement('div');
                statsContainer.className = 'compression-stats-container';
                content.appendChild(statsContainer);
            }
            statsContainer.innerHTML = statsHTML;
        }
    }

    /**
     * Load mesh from content (called by file callback)
     */
    private async loadMesh(content: string, filename: string): Promise<void> {
        await this.onMeshFileLoaded(content, filename);
    }

    /**
     * Handle file load error
     */
    private handleLoadError(error: Error): void {
        const message = error.message || 'Unknown error loading mesh';
        appLogger.error('[CompressionProject] Failed to load mesh', error);
        this.statusBar?.updateStats({ status: `❌ Error: ${message}` });
    }
}
