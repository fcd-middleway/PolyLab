/**
 * Compression Project
 * 
 * Progressive mesh compression and decompression visualization.
 * Load meshes, compress them, and visualize compression results.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { ScenePanel } from '../components/ScenePanel';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import type { StatusBar } from '../components/StatusBar';
import { appLogger, meshLogger } from '../utils/logger';

export class CompressionProject extends BaseProject {
    private scenePanel: ScenePanel | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private statusBar: StatusBar | null = null;
    
    private currentMeshId: string | null = null;
    private isCompressed: boolean = false;
    private compressionHandle: any = null; // CompressionHandle from WASM
    private currentMetric: string = 'edge_length'; // Default metric
    
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
                status: '📦 Mesh Compression - Load a mesh to begin'
            });
        }
        
        // Clear Settings section (not used in Compression mode)
        if (this.detailsPanel) {
            this.detailsPanel.clearSettings();
        }
    }

    onDeactivate(): void {
        appLogger.debug('Compression project deactivated');
        
        // Clear Settings section when deactivating
        if (this.detailsPanel) {
            this.detailsPanel.clearSettings();
        }
    }

    /**
     * Simplify the current mesh using edge collapse
     */
    private async compressMesh(): Promise<void> {
        if (!this.currentMeshId || !this.compressionHandle) {
            appLogger.warn('No mesh loaded to compress');
            this.statusBar?.updateStats({ status: '⚠️ Load a mesh first' });
            return;
        }

        try {
            appLogger.info('Simplifying mesh...', { meshId: this.currentMeshId, metric: this.currentMetric });
            this.statusBar?.updateStats({ status: '⚡ Simplifying...' });
            
            // Simplify by 10% (keep 90% of vertices)
            const result = this.compressionHandle.simplify_step(0.9, this.currentMetric);
            
            // Convert arrays to TypedArrays
            const verticesArray = new Float32Array(result.vertices);
            const facesArray = new Uint32Array(result.faces);
            
            // Update viewer with new geometry
            this.viewer.update_mesh(
                this.currentMeshId,
                verticesArray,
                facesArray
            );
            
            // Update UI with new stats
            this.displayStats(result.stats);
            
            // Update status bar
            const reduction = result.stats.original_vertices - result.stats.vertices;
            this.statusBar?.updateStats({ 
                status: `⚡ Simplified: -${reduction} vertices`,
                vertices: result.stats.vertices,
                triangles: result.stats.faces
            });
            
            appLogger.info('Mesh simplified successfully', { 
                vertices: result.stats.vertices,
                reduction 
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('Failed to simplify mesh', { error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }

    /**
     * Reset the mesh to its original state
     */
    private async resetMesh(): Promise<void> {
        if (!this.currentMeshId || !this.compressionHandle) {
            appLogger.warn('No mesh to reset');
            this.statusBar?.updateStats({ status: '⚠️ Load a mesh first' });
            return;
        }

        try {
            appLogger.info('Resetting mesh...', { meshId: this.currentMeshId });
            this.statusBar?.updateStats({ status: '🔄 Resetting...' });
            
            // Reset to original mesh
            const result = this.compressionHandle.reset();
            
            // Convert arrays to TypedArrays
            const verticesArray = new Float32Array(result.vertices);
            const facesArray = new Uint32Array(result.faces);
            
            // Update viewer with original geometry
            this.viewer.update_mesh(
                this.currentMeshId,
                verticesArray,
                facesArray
            );
            
            // Update UI with original stats
            this.displayStats(result.stats);
            
            // Update status bar
            this.statusBar?.updateStats({ 
                status: '🔄 Mesh reset to original',
                vertices: result.stats.vertices,
                triangles: result.stats.faces
            });
            
            appLogger.info('Mesh reset successfully', { 
                vertices: result.stats.vertices
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('Failed to reset mesh', { error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }

    /**
     * Display compression statistics in the properties panel
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
                        <span>Collapsed Edges:</span>
                        <span>${stats.collapsed_edges.toLocaleString()}</span>
                    </div>
                    <div class="stats-row">
                        <span>Metric:</span>
                        <span>${stats.metric_name}</span>
                    </div>
                </div>
            </div>
        `;
        
        this.detailsPanel.setSettingsContent(statsHTML);
    }

    /**
     * Decompress the current mesh
     * TODO: Implement actual decompression logic (Sprint 3+)
     */
    private decompressMesh(): void {
        appLogger.warn('Decompression not implemented yet');
        this.statusBar?.updateStats({ status: '⚠️ Decompression coming in future update' });
    }

    /**
     * Load mesh from content (called by FILE section callback)
     */
    private async loadMesh(content: string, filename: string): Promise<void> {
        // Reuse existing implementation from onMeshFileLoaded
        await this.onMeshFileLoaded(content, filename);
    }

    /**
     * Handle file load error (called by FILE section callback)
     */
    private handleLoadError(error: Error): void {
        const message = error.message || 'Unknown error loading mesh';
        appLogger.error('[CompressionProject] Failed to load mesh', error);
        this.statusBar?.updateStats({ status: `❌ Error: ${message}` });
    }

    /**
     * Toggle a render mode (solid, wireframe, vertices)
     * NOTE: This is now deprecated - render mode changes are handled by toolbar callbacks
     */
    private toggleRenderMode(mode: 'solid' | 'wireframe' | 'vertices'): void {
        this.renderModes[mode] = !this.renderModes[mode];
        
        // Update viewer render modes
        if (this.viewer) {
            this.viewer.set_render_modes(
                this.renderModes.solid,
                this.renderModes.wireframe,
                this.renderModes.vertices
            );
        }
        
        appLogger.info('Render mode toggled', { mode, enabled: this.renderModes[mode] });
        this.statusBar?.updateStats({ 
            status: `${mode} mode ${this.renderModes[mode] ? 'enabled' : 'disabled'}` 
        });
        
        // Update menu labels (would need UI manager support - for now just log)
        this.updateViewMenuLabels();
    }

    /**
     * Update View menu labels based on current render modes
     * TODO: Implement proper menu item update in UI manager
     */
    private updateViewMenuLabels(): void {
        // This would need to be implemented in the UI manager
        // For now, the menu labels are static
        appLogger.debug('View menu labels need updating', this.renderModes);
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
            
            // Generate unique mesh ID
            this.currentMeshId = `mesh-${Date.now()}`;
            
            // Call WASM function to load mesh
            this.viewer.load_mesh(this.currentMeshId, content);
            
            // Get detailed mesh info from viewer
            const details = this.viewer.mesh_details(this.currentMeshId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
            
            // Create compression handle
            // First, we need to extract raw vertex and face data
            // Parse OBJ to get raw data (we'll need to add a helper method)
            const meshData = this.parseOBJForCompression(content);
            
            this.compressionHandle = this.viewer.create_compression_handle(
                this.currentMeshId,
                meshData.vertices,
                meshData.faces
            );
            
            appLogger.info('[CompressionProject] Compression handle created', { 
                meshId: this.currentMeshId,
                vertices: meshData.vertices.length / 3,
                faces: meshData.faces.length / 3
            });
            
            // Add mesh to MeshPanel
            this.scenePanel?.addMesh({
                id: this.currentMeshId,
                name: filename,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles),
                visible: true
            });
            
            // Get initial stats from compression handle
            const stats = this.compressionHandle.get_stats();
            this.displayStats(stats);
            
            // Update status bar
            this.statusBar?.updateStats({ 
                status: `✅ Loaded ${filename} - Ready to simplify`,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles)
            });
            
            // Reset compression state
            this.isCompressed = false;
            
            // Initialize render modes (solid only by default)
            appLogger.info('[CompressionProject] Initializing render modes', this.renderModes);
            this.viewer.set_render_modes(
                this.renderModes.solid,
                this.renderModes.wireframe,
                this.renderModes.vertices
            );
            
            appLogger.info('[CompressionProject] Mesh loaded successfully', { 
                meshId: this.currentMeshId,
                filename, 
                vertices: Math.round(vertices), 
                triangles: Math.round(triangles)
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('[CompressionProject] Failed to load mesh', { filename, error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }

    /**
     * Parse OBJ file to extract raw vertex and face data for compression
     */
    private parseOBJForCompression(content: string): { vertices: Float32Array, faces: Uint32Array } {
        const lines = content.split('\n');
        const vertices: number[] = [];
        const faces: number[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Vertex position
            if (trimmed.startsWith('v ')) {
                const parts = trimmed.split(/\s+/);
                vertices.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            }
            // Face (triangular only for now)
            else if (trimmed.startsWith('f ')) {
                const parts = trimmed.split(/\s+/);
                if (parts.length === 4) { // Triangle
                    for (let i = 1; i <= 3; i++) {
                        // Handle "v/vt/vn" or "v//vn" or just "v"
                        const vertexIndex = parseInt(parts[i].split('/')[0]) - 1; // OBJ indices are 1-based
                        faces.push(vertexIndex);
                    }
                } else if (parts.length === 5) { // Quad - triangulate
                    // Split quad into two triangles: (0,1,2) and (0,2,3)
                    const indices = [
                        parseInt(parts[1].split('/')[0]) - 1,
                        parseInt(parts[2].split('/')[0]) - 1,
                        parseInt(parts[3].split('/')[0]) - 1,
                        parseInt(parts[4].split('/')[0]) - 1
                    ];
                    faces.push(indices[0], indices[1], indices[2]);
                    faces.push(indices[0], indices[2], indices[3]);
                }
            }
        }

        return {
            vertices: new Float32Array(vertices),
            faces: new Uint32Array(faces)
        };
    }
}
