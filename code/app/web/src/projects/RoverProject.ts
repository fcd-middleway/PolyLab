/**
 * Rover Project
 * 
 * Stereoscopic vision and 3D reconstruction from dual cameras.
 * Simulates a rover with stereo cameras to generate depth maps and point clouds.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { StatusBar } from '../components/StatusBar';
import type { PropertiesPanel } from '../components/PropertiesPanel';
import type { ScenePanel } from '../components/ScenePanel';
import { appLogger } from '../utils/logger';

type ViewMode = 'scene' | 'stereo' | 'depth' | 'full-grid' | 'point-cloud';

export class RoverProject extends BaseProject {
    private statusBar: StatusBar | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private scenePanel: ScenePanel | null = null;
    
    // Current view mode
    private currentViewMode: ViewMode = 'scene';
    
    // Store original canvas to restore when switching back to scene mode
    private originalCanvas: HTMLCanvasElement | null = null;
    
    // Stereo viewers for dual-camera mode
    private leftViewer: any | null = null;
    private rightViewer: any | null = null;
    private stereoCanvasLeft: HTMLCanvasElement | null = null;
    private stereoCanvasRight: HTMLCanvasElement | null = null;
    
    // Rover handle (WASM)
    private rover: any | null = null; // RoverHandle from polylab-rover
    
    // Camera parameters
    private readonly cameraBaseline = 0.3; // Distance between left/right cameras (meters)
    private readonly cameraFOV = 60; // Field of view (degrees)

    getId(): string {
        return 'rover';
    }

    getName(): string {
        return 'Rover Vision';
    }

    getConfig(): ProjectConfig {
        return {
            name: 'Rover Vision',
            icon: '🤖',
            
            fileCallbacks: {
                onLoad: (content: string, filename: string) => this.onMeshFileLoaded(content, filename),
                onError: (error: Error) => {
                    appLogger.error('[RoverProject] Failed to load mesh', error);
                    this.statusBar?.updateStats({ status: `❌ Error: ${error.message}` });
                }
            },
            
            // NOTE: viewCallbacks are now configured globally in UIManager.setViewer(),

            toolbarActions: [
                {
                    id: 'reset-rover',
                    icon: '🏠',
                    tooltip: 'Reset Rover Position',
                    action: () => this.resetRover()
                },
                {
                    id: 'capture-stereo',
                    icon: '📸',
                    tooltip: 'Capture Stereo Pair',
                    action: () => this.captureStereo()
                }
            ],

            layoutActions: [
                {
                    id: 'scene-view',
                    icon: '🎬',
                    tooltip: 'Scene',
                    action: () => this.switchViewMode('scene')
                },
                {
                    id: 'stereo-view',
                    icon: '👁️',
                    tooltip: 'Stereo',
                    action: () => this.switchViewMode('stereo')
                },
                {
                    id: 'depth-view',
                    icon: '🔬',
                    tooltip: 'Depth',
                    action: () => this.switchViewMode('depth')
                },
                {
                    id: 'grid-view',
                    icon: '🎯',
                    tooltip: 'Full Grid',
                    action: () => this.switchViewMode('full-grid')
                },
                {
                    id: 'cloud-view',
                    icon: '🎨',
                    tooltip: 'Point Cloud',
                    action: () => this.switchViewMode('point-cloud')
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
                    id: 'rover-details',
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
    }

    async init(viewer: any): Promise<void> {
        appLogger.info('Initializing Rover project...');
        this.viewer = viewer;
        
        // Store original canvas reference
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            this.originalCanvas = canvasContainer.querySelector('canvas');
        }
        
        // Set up visibility toggle callback
        if (this.scenePanel) {
            this.scenePanel.setVisibilityCallback((id: string, visible: boolean) => {
                viewer.set_mesh_visibility(id, visible);
            });
        }
        
        // Load initial scene
        await this.loadInitialScene();
        
        // Set initial view mode
        this.switchViewMode('scene');
        
        appLogger.info('Rover project ready - use arrow keys to navigate');
    }

    update(deltaTime: number): void {
        // TODO: Update rover position based on keyboard input
        // TODO: Update stereo camera positions/orientations
        // TODO: Capture frames if in continuous mode
    }

    cleanup(): void {
        appLogger.info('Cleaning up Rover project...');
        
        // Cleanup stereo viewers
        this.cleanupStereoViewers();
        
        // TODO: Remove rover meshes, camera visualizations, etc.
    }

    onActivate(): void {
        appLogger.debug('Rover project activated');
        
        // Update status bar
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '🤖 Rover Vision - Ready to explore'
            });
        }
        
        // Update details panel with rover info
        if (this.detailsPanel) {
            this.updateRoverInfo();
        }
        
        // Clear Settings section (not used in Rover mode)
        if (this.detailsPanel) {
            this.detailsPanel.clearSettings();
        }
    }

    onDeactivate(): void {
        appLogger.debug('Rover project deactivated');
        
        // Clear Settings section when deactivating
        if (this.detailsPanel) {
            this.detailsPanel.clearSettings();
        }
    }

    /**
     * Reset rover to initial position and orientation
     */
    private resetRover(): void {
        appLogger.info('Resetting rover position...');
        
        if (this.rover) {
            // Reset WASM rover to initial stereo position
            this.rover.set_position(0, 0, -10);
            this.rover.set_orientation(-Math.PI / 2, 0); // Facing +Z
        }
        
        this.updateRoverInfo();
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '🏠 Rover reset to origin' });
        }
    }

    /**
     * Capture stereo pair from current rover position
     */
    private captureStereo(): void {
        if (!this.rover) {
            appLogger.warn('Cannot capture stereo: rover not initialized');
            return;
        }
        
        const pos = this.rover.get_position();
        const orient = this.rover.get_orientation();
        
        appLogger.info('Capturing stereo pair...', {
            position: { x: pos[0], y: pos[1], z: pos[2] },
            orientation: { yaw: orient[0], pitch: orient[1] }
        });
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '📸 Capturing stereo images...' });
        }
        
        // TODO: Render from left camera
        // TODO: Render from right camera
        // TODO: Store images for processing
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '✅ Stereo pair captured' });
        }
    }

    /**
     * Process depth map from stereo pair
     */
    private processDepthMap(): void {
        appLogger.info('Processing depth map...');
        
        // TODO: Run stereo matching algorithm
        // TODO: Generate disparity map
        // TODO: Convert to depth map
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '⏳ Processing depth map...' });
        }
    }

    /**
     * Generate 3D point cloud from depth map
     */
    private generatePointCloud(): void {
        appLogger.info('Generating point cloud...');
        
        // TODO: Convert depth map to 3D points
        // TODO: Add color from camera images
        // TODO: Add to scene as point cloud mesh
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '⏳ Generating point cloud...' });
        }
    }

    /**
     * Switch to a different view mode
     */
    private async switchViewMode(mode: ViewMode): Promise<void> {
        if (this.currentViewMode === mode) return;
        
        appLogger.info(`Switching view mode: ${this.currentViewMode} → ${mode}`);
        
        // Cleanup previous mode
        if (this.currentViewMode === 'stereo') {
            await this.cleanupStereoViewers();
        }
        
        this.currentViewMode = mode;
        
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) {
            appLogger.error('Canvas container not found');
            return;
        }
        
        // Update layout based on mode
        switch (mode) {
            case 'scene':
                this.setupSceneLayout(canvasContainer);
                break;
            case 'stereo':
                await this.setupStereoLayout(canvasContainer);
                break;
            case 'depth':
                this.setupDepthLayout(canvasContainer);
                break;
            case 'full-grid':
                this.setupFullGridLayout(canvasContainer);
                break;
            case 'point-cloud':
                this.setupPointCloudLayout(canvasContainer);
                break;
        }
        
        // Update status bar
        const modeNames: Record<ViewMode, string> = {
            'scene': '🎬 Scene Explorer',
            'stereo': '👁️ Stereo Vision',
            'depth': '🔬 Depth Analysis',
            'full-grid': '🎯 Full Analysis',
            'point-cloud': '🎨 Point Cloud'
        };
        
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: `Mode: ${modeNames[mode]}`
            });
        }
    }
    
    /**
     * Setup Scene Explorer layout (single canvas, full size)
     */
    private setupSceneLayout(container: HTMLElement): void {
        appLogger.debug('Setting up Scene Explorer layout');
        
        // Clear container and restore original canvas
        container.innerHTML = '';
        
        if (this.originalCanvas) {
            container.appendChild(this.originalCanvas);
        }
        
        // Single canvas, full size
        container.style.display = 'block';
        container.style.gridTemplateColumns = '';
        container.style.gridTemplateRows = '';
        container.style.gap = '';
        
        const mainCanvas = container.querySelector('canvas');
        if (mainCanvas) {
            mainCanvas.style.display = 'block';
            mainCanvas.style.width = '100%';
            mainCanvas.style.height = '100%';
        }
    }
    
    /**
     * Setup Stereo Vision layout (two canvases side-by-side)
     */
    private async setupStereoLayout(container: HTMLElement): Promise<void> {
        appLogger.debug('Setting up Stereo Vision layout');
        
        // Clear existing content
        container.innerHTML = '';
        
        // Clean up existing stereo viewers
        await this.cleanupStereoViewers();
        
        // Create grid layout for two canvases
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = '1fr';
        container.style.gap = '2px';
        
        // Create left canvas
        const leftCanvas = document.createElement('canvas');
        leftCanvas.id = 'stereo-canvas-left';
        leftCanvas.style.width = '100%';
        leftCanvas.style.height = '100%';
        leftCanvas.style.display = 'block';
        
        // Create right canvas
        const rightCanvas = document.createElement('canvas');
        rightCanvas.id = 'stereo-canvas-right';
        rightCanvas.style.width = '100%';
        rightCanvas.style.height = '100%';
        rightCanvas.style.display = 'block';
        
        // Add to container
        container.appendChild(leftCanvas);
        container.appendChild(rightCanvas);
        
        // Store canvas references
        this.stereoCanvasLeft = leftCanvas;
        this.stereoCanvasRight = rightCanvas;
        
        // Initialize stereo viewers
        try {
            await this.initStereoViewers();
            appLogger.info('Stereo viewers initialized successfully');
        } catch (error) {
            appLogger.error('Failed to initialize stereo viewers:', error);
            
            // Show error message
            container.innerHTML = `
                <div style="grid-column: 1 / 3; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #ff6b6b;">
                    <div style="text-align: center;">
                        <div style="font-size: 48px;">⚠️</div>
                        <p style="margin-top: 16px;">Failed to initialize stereo cameras</p>
                        <p style="font-size: 12px; color: #999; margin-top: 8px;">Check console for details</p>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Initialize left and right viewers for stereo mode
     */
    private async initStereoViewers(): Promise<void> {
        // Import WASM modules
        const viewerModule = await import('../../public/wasm/viewer/polylab_viewer.js');
        await viewerModule.default();
        
        const roverModule = await import('../../public/wasm/rover/polylab_rover.js');
        await roverModule.default();
        
        // Create rover at Wall-E position (0, 0, -10) facing +Z
        appLogger.debug('Creating rover...');
        this.rover = roverModule.RoverHandle.at_position(0, 0, -10);
        this.rover.set_orientation(-Math.PI / 2, 0); // -90° yaw (facing +Z), 0° pitch
        this.rover.set_stereo_baseline(this.cameraBaseline);
        this.rover.set_eye_height(0.8); // Wall-E's eyes
        
        appLogger.debug(`Rover created at position (0, 0, -10) with yaw=${(-Math.PI/2).toFixed(2)} rad`);
        
        // Create left viewer
        appLogger.debug('Creating left viewer...');
        this.leftViewer = await viewerModule.ViewerHandle.create('stereo-canvas-left');
        
        // Create right viewer
        appLogger.debug('Creating right viewer...');
        this.rightViewer = await viewerModule.ViewerHandle.create('stereo-canvas-right');
        
        // Load scene meshes into both viewers
        await this.loadSceneIntoViewer(this.leftViewer);
        await this.loadSceneIntoViewer(this.rightViewer);
        
        // Start render loop for stereo viewers
        this.renderStereoFrame();
    }
    
    /**
     * Load scene meshes into a viewer
     */
    private async loadSceneIntoViewer(viewer: any): Promise<void> {
        // Load ground plane
        const planeResponse = await fetch('/assets/rover/plane.obj');
        const planeObj = await planeResponse.text();
        viewer.load_mesh_at('ground-plane', planeObj, 0, 0, 0);
        
        // Load Wall-E rover (rotated 90 degrees to face cube)
        const wallyResponse = await fetch('/assets/rover/wally.obj');
        const wallyObj = await wallyResponse.text();
        viewer.load_mesh_at_rotated('rover-wally', wallyObj, 0, 0, -10, -90.0);
        
        // Load target cube
        const cubeResponse = await fetch('/assets/rover/cube.obj');
        const cubeObj = await cubeResponse.text();
        viewer.load_mesh_at('target-cube', cubeObj, 0, 0.5, 10);
    }
    
    /**
     * Render frame for stereo viewers
     */
    private renderStereoFrame = (): void => {
        if (!this.leftViewer || !this.rightViewer || !this.rover) return;
        
        try {
            // Calculate aspect ratio from canvas dimensions
            const aspectRatio = this.stereoCanvasLeft 
                ? this.stereoCanvasLeft.width / this.stereoCanvasLeft.height 
                : 1.0;
            
            // Get view-projection matrices from rover for each eye
            const leftMatrix = this.rover.get_left_view_projection_matrix(aspectRatio);
            const rightMatrix = this.rover.get_right_view_projection_matrix(aspectRatio);
            
            // Render left eye
            this.leftViewer.render_with_matrix(leftMatrix);
            
            // Render right eye
            this.rightViewer.render_with_matrix(rightMatrix);
            
            // Continue rendering if still in stereo mode
            if (this.currentViewMode === 'stereo') {
                requestAnimationFrame(this.renderStereoFrame);
            }
        } catch (error) {
            appLogger.error('Stereo render error:', error);
        }
    }
    
    /**
     * Cleanup stereo viewers
     */
    private async cleanupStereoViewers(): Promise<void> {
        if (this.leftViewer || this.rightViewer) {
            appLogger.debug('Cleaning up stereo viewers');
            
            // Note: WASM ViewerHandle doesn't have explicit cleanup method
            // Resources will be released when objects are garbage collected
            this.leftViewer = null;
            this.rightViewer = null;
            this.stereoCanvasLeft = null;
            this.stereoCanvasRight = null;
        }
    }
    
    
    /**
     * Setup Depth Analysis layout (stereo pair + depth map + histogram)
     */
    private setupDepthLayout(container: HTMLElement): void {
        appLogger.debug('Setting up Depth Analysis layout');
        
        // TODO: Create layout with stereo pair (left), depth map (top right), histogram (bottom right)
        // For now, show placeholder
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '2fr 1fr';
        container.style.gridTemplateRows = '1fr 1fr';
        container.style.gap = '2px';
        
        container.innerHTML = `
            <div style="grid-row: 1 / 3; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 48px;">👁️👁️</div>
                    <p style="margin-top: 16px;">Stereo Pair</p>
                    <p style="font-size: 12px; color: #444;">(Left + Right)</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 48px;">🗺️</div>
                    <p style="margin-top: 16px;">Depth Map</p>
                    <p style="font-size: 12px; color: #444;">(Colorized)</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 48px;">📊</div>
                    <p style="margin-top: 16px;">Histogram</p>
                    <p style="font-size: 12px; color: #444;">(Depth distribution)</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup Full Grid layout (2x2 grid)
     */
    private setupFullGridLayout(container: HTMLElement): void {
        appLogger.debug('Setting up Full Grid layout');
        
        // TODO: Create 2x2 grid with scene, camera, point cloud, depth map
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = '1fr 1fr';
        container.style.gap = '2px';
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 32px;">🎬</div>
                    <p style="margin-top: 8px;">Scene 3D</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 32px;">📷</div>
                    <p style="margin-top: 8px;">Camera L</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 32px;">🎨</div>
                    <p style="margin-top: 8px;">Point Cloud</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 32px;">🗺️</div>
                    <p style="margin-top: 8px;">Depth Map</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup Point Cloud layout (single canvas optimized for points)
     */
    private setupPointCloudLayout(container: HTMLElement): void {
        appLogger.debug('Setting up Point Cloud layout');
        
        // TODO: Create optimized point cloud renderer
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr';
        container.style.gridTemplateRows = '1fr';
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 64px;">🎨</div>
                    <p style="margin-top: 16px; font-size: 18px;">Point Cloud Viewer</p>
                    <p style="font-size: 12px; color: #444; margin-top: 8px;">(Coming soon)</p>
                </div>
            </div>
        `;
    }

    /**
     * Load initial scene with ground plane, rover, and target cube
     */
    private async loadInitialScene(): Promise<void> {
        if (!this.viewer) return;
        
        appLogger.info('Loading initial rover scene...');
        
        try {
            // Load ground plane at origin (0, 0, 0)
            const planeResponse = await fetch('/assets/rover/plane.obj');
            const planeContent = await planeResponse.text();
            this.viewer.load_mesh_at('ground-plane', planeContent, 0, 0, 0);
            appLogger.debug('Ground plane loaded');
            
            // Load Wally (rover) at z=-10, rotated 90° right to face +Z (toward cube)
            // ROTATION: Change the 90.0 value here to adjust rover orientation
            //   0° = facing -Z (original orientation)
            //  90° = facing +Z (toward cube at z=10)
            // 180° = facing +Z (away from cube)
            // -90° = facing -Z (perpendicular)
            const wallyResponse = await fetch('/assets/rover/wally.obj');
            const wallyContent = await wallyResponse.text();
            this.viewer.load_mesh_at_rotated('rover-wally', wallyContent, 0, 0, -10, -90.0);
            appLogger.debug('Rover (Wally) loaded at z=-10, rotated 90° to face cube');
            
            // Load cube at z=+10, slightly above ground (cube center at y=0.5)
            const cubeResponse = await fetch('/assets/rover/cube.obj');
            const cubeContent = await cubeResponse.text();
            this.viewer.load_mesh_at('target-cube', cubeContent, 0, 0.5, 10);
            appLogger.debug('Target cube loaded at z=+10');
            
            // Add meshes to panel
            if (this.scenePanel) {
                // Get details for each mesh
                const planeDetails = this.viewer.mesh_details('ground-plane');
                const wallyDetails = this.viewer.mesh_details('rover-wally');
                const cubeDetails = this.viewer.mesh_details('target-cube');
                
                this.scenePanel.addMesh({
                    id: 'ground-plane',
                    name: 'Ground Plane',
                    vertices: Math.round(planeDetails[0]),
                    triangles: Math.round(planeDetails[1]),
                    visible: true
                });
                
                this.scenePanel.addMesh({
                    id: 'rover-wally',
                    name: 'Wall-E Rover',
                    vertices: Math.round(wallyDetails[0]),
                    triangles: Math.round(wallyDetails[1]),
                    visible: true
                });
                
                this.scenePanel.addMesh({
                    id: 'target-cube',
                    name: 'Target Cube',
                    vertices: Math.round(cubeDetails[0]),
                    triangles: Math.round(cubeDetails[1]),
                    visible: true
                });
            }
            
            // Position camera to see the scene
            // Camera at (0, 5, -15) looking at origin
            this.viewer.camera_set_position(0, 5, -15);
            
            if (this.statusBar) {
                this.statusBar.updateStats({ 
                    status: '✅ Scene loaded - Ground, Rover, and Target ready'
                });
            }
            
            appLogger.info('Initial scene loaded successfully');
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('Failed to load initial scene', { error: errorMsg });
            
            if (this.statusBar) {
                this.statusBar.updateStats({ 
                    status: `❌ Failed to load scene: ${errorMsg}`
                });
            }
        }
    }

    /**
     * Update details panel with current rover information
     */
    private updateRoverInfo(): void {
        if (!this.detailsPanel) return;
        
        // Get rover info if available
        let posX = 0, posY = 0, posZ = 0, yaw = 0, pitch = 0;
        
        if (this.rover) {
            const pos = this.rover.get_position();
            const orient = this.rover.get_orientation();
            posX = pos[0];
            posY = pos[1];
            posZ = pos[2];
            yaw = orient[0];
            pitch = orient[1];
        }
        
        // Create rover info HTML
        const infoHTML = `
            <div class="rover-info">
                <h3>Position</h3>
                <p>X: ${posX.toFixed(2)}m</p>
                <p>Y: ${posY.toFixed(2)}m</p>
                <p>Z: ${posZ.toFixed(2)}m</p>
                
                <h3>Orientation</h3>
                <p>Yaw: ${(yaw * 180 / Math.PI).toFixed(1)}°</p>
                <p>Pitch: ${(pitch * 180 / Math.PI).toFixed(1)}°</p>
                
                <h3>Stereo Camera</h3>
                <p>Baseline: ${this.cameraBaseline}m</p>
                <p>FOV: ${this.cameraFOV}°</p>
            </div>
        `;
        
        // Update details panel (simplified for now)
        this.detailsPanel.updateDetails({
            vertices: 0,
            triangles: 0,
            sizeX: 0,
            sizeY: 0,
            sizeZ: 0
        });
    }

    /**
     * Handle mesh file loaded from file picker (inherited from BaseProject)
     */
    protected async onMeshFileLoaded(content: string, filename: string): Promise<void> {
        try {
            appLogger.info('[RoverProject] Loading mesh from file picker', { filename, size: content.length });
            this.statusBar?.updateStats({ status: `Loading ${filename}...` });
            
            // Generate unique mesh ID
            const meshId = `mesh-${Date.now()}`;
            
            // Load mesh into appropriate viewer based on current mode
            if (this.currentViewMode === 'stereo' && this.leftViewer && this.rightViewer) {
                // Load in both stereo viewers
                this.leftViewer.load_mesh(meshId, content);
                this.rightViewer.load_mesh(meshId, content);
            } else if (this.viewer) {
                // Load in main viewer
                this.viewer.load_mesh(meshId, content);
            }
            
            // Get mesh details
            const viewer = this.viewer || this.leftViewer;
            if (viewer) {
                const details = viewer.mesh_details(meshId);
                const [vertices, triangles, sizeX, sizeY, sizeZ] = details;
                
                // Add mesh to MeshPanel
                this.scenePanel?.addMesh({
                    id: meshId,
                    name: filename,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles),
                    visible: true
                });
                
                // Update status bar
                this.statusBar?.updateStats({ 
                    status: `✅ Loaded ${filename}`,
                    vertices: Math.round(vertices),
                    triangles: Math.round(triangles)
                });
                
                appLogger.info('[RoverProject] Mesh loaded successfully', { 
                    meshId,
                    filename, 
                    vertices: Math.round(vertices), 
                    triangles: Math.round(triangles)
                });
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            appLogger.error('[RoverProject] Failed to load mesh', { filename, error: errorMsg });
            this.statusBar?.updateStats({ status: `❌ ${errorMsg}` });
        }
    }
}
