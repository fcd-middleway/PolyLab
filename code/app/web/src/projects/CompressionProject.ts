/**
 * Compression Project
 * 
 * Progressive mesh compression and decompression visualization.
 * Load meshes, compress them, and visualize compression results.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { MeshPanel } from '../components/MeshPanel';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import type { StatusBar } from '../components/StatusBar';
import { appLogger, meshLogger } from '../utils/logger';

export class CompressionProject extends BaseProject {
    private meshPanel: MeshPanel | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private statusBar: StatusBar | null = null;
    
    private currentMeshId: string | null = null;
    private isCompressed: boolean = false;

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
            
            genericMenuCallbacks: {
                file: {
                    onLoadMesh: () => this.openFilePicker()
                },
                view: {
                    // Camera controls not implemented yet
                }
            },

            toolbarActions: [
                {
                    id: 'compress-mesh',
                    icon: '⚡',
                    tooltip: 'Compress Mesh',
                    action: () => this.compressMesh()
                },
                {
                    id: 'decompress-mesh',
                    icon: '📦',
                    tooltip: 'Decompress Mesh',
                    action: () => this.decompressMesh()
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
    setUIComponents(meshPanel: MeshPanel, detailsPanel: PropertiesPanel, statusBar: StatusBar): void {
        this.meshPanel = meshPanel;
        this.detailsPanel = detailsPanel;
        this.statusBar = statusBar;
    }

    async init(viewer: any): Promise<void> {
        appLogger.info('Initializing Compression project...');
        this.viewer = viewer;
        
        // Set up visibility toggle callback
        if (this.meshPanel) {
            this.meshPanel.setVisibilityCallback((id: string, visible: boolean) => {
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
            
            if (this.meshPanel) {
                this.meshPanel.removeMesh(this.currentMeshId);
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
     * Compress the current mesh
     * TODO: Implement actual compression logic
     */
    private compressMesh(): void {
        if (!this.currentMeshId) {
            appLogger.warn('No mesh loaded to compress');
            this.statusBar?.updateStats({ status: '⚠️ Load a mesh first' });
            return;
        }

        appLogger.info('Compressing mesh...', { meshId: this.currentMeshId });
        
        // TODO: Call compression algorithm
        // For now, just update status
        this.isCompressed = true;
        this.statusBar?.updateStats({ status: '⚡ Mesh compressed (placeholder)' });
        
        appLogger.info('Mesh compression complete (placeholder)');
    }

    /**
     * Decompress the current mesh
     * TODO: Implement actual decompression logic
     */
    private decompressMesh(): void {
        if (!this.isCompressed) {
            appLogger.warn('No compressed mesh to decompress');
            this.statusBar?.updateStats({ status: '⚠️ Compress a mesh first' });
            return;
        }

        appLogger.info('Decompressing mesh...', { meshId: this.currentMeshId });
        
        // TODO: Call decompression algorithm
        // For now, just update status
        this.isCompressed = false;
        this.statusBar?.updateStats({ status: '📦 Mesh decompressed (placeholder)' });
        
        appLogger.info('Mesh decompression complete (placeholder)');
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
                this.meshPanel?.removeMesh(this.currentMeshId);
            }
            
            // Generate unique mesh ID
            this.currentMeshId = `mesh-${Date.now()}`;
            
            // Call WASM function to load mesh
            this.viewer.load_mesh(this.currentMeshId, content);
            
            // Get detailed mesh info from viewer
            const details = this.viewer.mesh_details(this.currentMeshId);
            const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
            
            // Add mesh to MeshPanel
            this.meshPanel?.addMesh({
                id: this.currentMeshId,
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
                status: `✅ Loaded ${filename} - Ready to compress`,
                vertices: Math.round(vertices),
                triangles: Math.round(triangles)
            });
            
            // Reset compression state
            this.isCompressed = false;
            
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
}
