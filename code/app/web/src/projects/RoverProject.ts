/**
 * Rover Project
 * 
 * Stereoscopic vision and 3D reconstruction from dual cameras.
 * Simulates a rover with stereo cameras to generate depth maps and point clouds.
 */

import { BaseProject } from '../core/BaseProject';
import type { ProjectConfig } from '../core/types';
import type { StatusBar } from '../components/StatusBar';
import type { DetailsPanel } from '../components/DetailsPanel';
import type { MeshPanel } from '../components/MeshPanel';
import { appLogger } from '../utils/logger';

type ViewMode = 'scene' | 'stereo' | 'depth' | 'full-grid' | 'point-cloud';

export class RoverProject extends BaseProject {
    private statusBar: StatusBar | null = null;
    private detailsPanel: DetailsPanel | null = null;
    private meshPanel: MeshPanel | null = null;
    
    // Current view mode
    private currentViewMode: ViewMode = 'scene';
    
    // Store original canvas to restore when switching back to scene mode
    private originalCanvas: HTMLCanvasElement | null = null;
    
    // Rover state
    private roverPosition = { x: 0, y: 1, z: 5 }; // Start position
    private roverRotation = { yaw: 0, pitch: 0 }; // Orientation
    
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
            
            menuItems: [
                { 
                    label: 'Rover',
                    submenu: [
                        { label: 'Reset Position', action: () => this.resetRover() },
                        { label: 'Capture Stereo Pair', action: () => this.captureStereo() },
                        { separator: true },
                        { label: 'Process Depth Map', action: () => this.processDepthMap(), enabled: false },
                        { label: 'Generate Point Cloud', action: () => this.generatePointCloud(), enabled: false }
                    ]
                },
                {
                    label: 'View',
                    submenu: [
                        { label: '🎬 Scene Explorer', action: () => this.switchViewMode('scene') },
                        { label: '👁️ Stereo Vision', action: () => this.switchViewMode('stereo') },
                        { label: '🔬 Depth Analysis', action: () => this.switchViewMode('depth') },
                        { separator: true },
                        { label: '🎯 Full Analysis Grid', action: () => this.switchViewMode('full-grid'), enabled: false },
                        { label: '🎨 Point Cloud Focus', action: () => this.switchViewMode('point-cloud'), enabled: false }
                    ]
                }
            ],

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

            panels: [
                {
                    id: 'mesh-list',
                    title: 'Meshes',
                    position: 'left',
                    component: null
                },
                {
                    id: 'rover-details',
                    title: 'Rover Info',
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
        appLogger.info('Initializing Rover project...');
        this.viewer = viewer;
        
        // Store original canvas reference
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            this.originalCanvas = canvasContainer.querySelector('canvas');
        }
        
        // Set up visibility toggle callback
        if (this.meshPanel) {
            this.meshPanel.setVisibilityCallback((id: string, visible: boolean) => {
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
    }

    onDeactivate(): void {
        appLogger.debug('Rover project deactivated');
    }

    /**
     * Reset rover to initial position and orientation
     */
    private resetRover(): void {
        appLogger.info('Resetting rover position...');
        
        this.roverPosition = { x: 0, y: 1, z: 5 };
        this.roverRotation = { yaw: 0, pitch: 0 };
        
        // TODO: Update camera to follow rover
        
        this.updateRoverInfo();
        
        if (this.statusBar) {
            this.statusBar.updateStats({ status: '🏠 Rover reset to origin' });
        }
    }

    /**
     * Capture stereo pair from current rover position
     */
    private captureStereo(): void {
        appLogger.info('Capturing stereo pair...', {
            position: this.roverPosition,
            rotation: this.roverRotation
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
    private switchViewMode(mode: ViewMode): void {
        if (this.currentViewMode === mode) return;
        
        appLogger.info(`Switching view mode: ${this.currentViewMode} → ${mode}`);
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
                this.setupStereoLayout(canvasContainer);
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
    private setupStereoLayout(container: HTMLElement): void {
        appLogger.debug('Setting up Stereo Vision layout');
        
        // TODO: Create two canvases for left/right cameras
        // For now, show placeholder
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = '1fr';
        container.style.gap = '2px';
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 48px;">📷</div>
                    <p style="margin-top: 16px;">Left Camera</p>
                    <p style="font-size: 12px; color: #444;">(Coming soon)</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #666;">
                <div style="text-align: center;">
                    <div style="font-size: 48px;">📷</div>
                    <p style="margin-top: 16px;">Right Camera</p>
                    <p style="font-size: 12px; color: #444;">(Coming soon)</p>
                </div>
            </div>
        `;
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
            if (this.meshPanel) {
                // Get details for each mesh
                const planeDetails = this.viewer.mesh_details('ground-plane');
                const wallyDetails = this.viewer.mesh_details('rover-wally');
                const cubeDetails = this.viewer.mesh_details('target-cube');
                
                this.meshPanel.addMesh({
                    id: 'ground-plane',
                    name: 'Ground Plane',
                    vertices: Math.round(planeDetails[0]),
                    triangles: Math.round(planeDetails[1]),
                    visible: true
                });
                
                this.meshPanel.addMesh({
                    id: 'rover-wally',
                    name: 'Wall-E Rover',
                    vertices: Math.round(wallyDetails[0]),
                    triangles: Math.round(wallyDetails[1]),
                    visible: true
                });
                
                this.meshPanel.addMesh({
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
        
        // Create rover info HTML
        const infoHTML = `
            <div class="rover-info">
                <h3>Position</h3>
                <p>X: ${this.roverPosition.x.toFixed(2)}m</p>
                <p>Y: ${this.roverPosition.y.toFixed(2)}m</p>
                <p>Z: ${this.roverPosition.z.toFixed(2)}m</p>
                
                <h3>Orientation</h3>
                <p>Yaw: ${(this.roverRotation.yaw * 180 / Math.PI).toFixed(1)}°</p>
                <p>Pitch: ${(this.roverRotation.pitch * 180 / Math.PI).toFixed(1)}°</p>
                
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
}
