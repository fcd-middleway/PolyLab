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
import { LayoutManager } from '../core/LayoutManager';
import { RoverUITemplates } from './RoverUITemplates';
import { appLogger } from '../utils/logger';

type ViewMode = 'scene' | 'stereo' | 'depth' | 'full-grid' | 'point-cloud';

export class RoverProject extends BaseProject {
    private statusBar: StatusBar | null = null;
    private detailsPanel: PropertiesPanel | null = null;
    private scenePanel: ScenePanel | null = null;
    
    // Layout management
    private layoutManager: LayoutManager | null = null;
    private currentViewMode: ViewMode = 'scene';
    private viewModeBadge: HTMLElement | null = null;
    
    // Stereo viewers for dual-camera mode
    private leftViewer: any | null = null;
    private rightViewer: any | null = null;
    private stereoCanvasLeft: HTMLCanvasElement | null = null;
    private stereoCanvasRight: HTMLCanvasElement | null = null;
    private stereoAnimationId: number | null = null;
    private fullGridAnimationId: number | null = null;
    
    // Rover handle (WASM)
    private rover: any | null = null; // RoverHandle from polylab-rover
    
    // Camera parameters
    private readonly cameraBaseline = 0.3; // Distance between left/right cameras (meters)
    private readonly cameraFOV = 60; // Field of view (degrees)
    
    // Rover controls
    private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
    private canvasKeyHandler: ((e: KeyboardEvent) => void) | null = null;
    private cameraControls: any | null = null; // Reference to global CameraControls to disable in Rover mode
    private keysPressed: Set<string> = new Set();
    private readonly moveSpeed = 2; // m/s
    private readonly rotateSpeed = 0.1; // rad/s
    private roverMeshContent: string = ''; // Store OBJ content for initial mesh load

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
                onError: (error: string) => {
                    appLogger.error('[RoverProject] Failed to load mesh', error);
                    this.statusBar?.updateStats({ status: `❌ Error: ${error}` });
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

    /**
     * Set camera controls reference
     * Called by main.ts to allow disabling global camera controls in Rover mode
     */
    setCameraControls(cameraControls: any): void {
        this.cameraControls = cameraControls;
    }

    async init(viewer: any): Promise<void> {
        appLogger.info('Initializing Rover project...');
        this.viewer = viewer;
        
        // Initialize LayoutManager
        // Store original canvas reference
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) {
            throw new Error('Canvas container not found');
        }
        
        // Initialize LayoutManager (it will handle canvas preservation)
        this.layoutManager = new LayoutManager(canvasContainer);
        this.registerLayouts();
        
        // Set up visibility toggle callback
        if (this.scenePanel) {
            this.scenePanel.setVisibilityCallback((id: string, visible: boolean) => {
                viewer.set_mesh_visibility(id, visible);
            });
        }
        
        // Initialize rover WASM module
        await this.initRover();
        
        // Load initial scene
        await this.loadInitialScene();
        
        // Set initial camera position (3rd person behind rover)
        this.updateCamera3rdPerson();
        
        appLogger.info('Rover project ready - use arrow keys to navigate');
    }
    
    /**
     * Initialize rover WASM module
     */
    private async initRover(): Promise<void> {
        try {
            // @ts-ignore - WASM module from relative path
            const roverModule = await import('../../../../crates/polylab-rover/pkg/polylab_rover.js');
            await roverModule.default();
            
            // Create rover at initial position (0, 0, -10) facing +Z
            appLogger.debug('Creating rover at (0, 0, -10)...');
            this.rover = roverModule.RoverHandle.at_position(0, 0, -10);
            this.rover.set_orientation(Math.PI, 0);
            this.rover.set_stereo_baseline(this.cameraBaseline);
            this.rover.set_eye_height(0.8); // Wall-E's eyes
            
            appLogger.debug(`Rover initialized: pos=(0, 0, -10), yaw=${(Math.PI/2).toFixed(2)} rad (facing +Z)`);
        } catch (error) {
            appLogger.error('Failed to initialize rover WASM module', error);
            throw error;
        }
    }

    /**
     * Register all available layouts with the LayoutManager
     */
    private registerLayouts(): void {
        if (!this.layoutManager) return;

        // Note: 'scene' mode is handled by restoreOriginal() in switchViewMode()
        // No need to register it as a layout

        // Stereo layout - dual camera views
        this.layoutManager.registerLayout({
            id: 'stereo',
            title: 'Stereo Vision',
            setup: async (container) => {
                appLogger.debug('[RoverProject] Setting up Stereo layout');
                container.innerHTML = RoverUITemplates.generateStereoViewHTML();
                await this.initStereoViewers();
            },
            cleanup: async () => {
                appLogger.debug('[RoverProject] Cleaning up Stereo layout');
                this.stopStereoRenderLoop();
                // Release viewers
                this.leftViewer = null;
                this.rightViewer = null;
            }
        });

        // Depth layout - depth map visualization
        this.layoutManager.registerLayout({
            id: 'depth',
            title: 'Depth Analysis',
            setup: (container) => {
                appLogger.debug('[RoverProject] Setting up Depth layout');
                container.innerHTML = RoverUITemplates.generateDepthViewHTML();
                // TODO: Wire up depth computation button
            }
        });

        // Full grid layout - all views at once
        this.layoutManager.registerLayout({
            id: 'full-grid',
            title: 'Full Analysis',
            setup: async (container) => {
                appLogger.debug('[RoverProject] Setting up Full Grid layout');
                await this.setupFullGridLayout(container);
            },
            cleanup: async () => {
                appLogger.debug('[RoverProject] Cleaning up Full Grid layout');
                this.stopFullGridRenderLoop();
                // Release stereo viewers
                this.leftViewer = null;
                this.rightViewer = null;
            }
        });

        // Point cloud layout - 3D reconstruction
        this.layoutManager.registerLayout({
            id: 'point-cloud',
            title: 'Point Cloud',
            setup: (container) => {
                appLogger.debug('[RoverProject] Setting up Point Cloud layout');
                container.innerHTML = RoverUITemplates.generatePointCloudHTML();
                // TODO: Wire up point cloud generation
            }
        });

        appLogger.info('[RoverProject] All layouts registered');
    }

    update(deltaTime: number): void {
        // Update rover position based on keyboard input
        if (this.rover && this.keysPressed.size > 0) {
            // deltaTime is already in seconds (from main.ts animation loop)
            let moved = false;
            
            // Forward/Backward
            if (this.keysPressed.has('ArrowUp')) {
                this.rover.move_forward(this.moveSpeed * deltaTime);
                moved = true;
            }
            if (this.keysPressed.has('ArrowDown')) {
                this.rover.move_forward(-this.moveSpeed * deltaTime);
                moved = true;
            }
            
            // Rotation
            if (this.keysPressed.has('ArrowLeft')) {
                this.rover.rotate(-this.rotateSpeed * deltaTime);
                moved = true;
            }
            if (this.keysPressed.has('ArrowRight')) {
                this.rover.rotate(this.rotateSpeed * deltaTime);
                moved = true;
            }
            
            if (moved) {
                // Update camera to follow rover (3rd person view)
                this.updateCamera3rdPerson();
                
                // Update rover mesh visual position (GPU-based, very fast)
                this.updateRoverMeshTransform();
                
                // Update rover info in details panel
                this.updateRoverInfo();
                
                // Update stereo cameras info in Properties Panel
                this.updateStereoCamerasInfo();
            }
        }
    }

    cleanup(): void {
        appLogger.info('Cleaning up Rover project...');
        
        // Stop all render loops
        this.stopStereoRenderLoop();
        this.stopFullGridRenderLoop();
        
        // Cleanup layout manager
        if (this.layoutManager) {
            this.layoutManager.destroy();
            this.layoutManager = null;
        }
    }

    onActivate(): void {
        appLogger.debug('Rover project activated');
        
        // Create view mode badge
        this.createViewModeBadge();
        
        // Disable global camera controls (they conflict with rover movement)
        if (this.cameraControls) {
            this.cameraControls.disable();
            appLogger.info('Global camera controls disabled for Rover mode');
        }
        
        // Update status bar
        if (this.statusBar) {
            this.statusBar.updateStats({ 
                status: '🤖 Rover Vision - Use arrow keys to move'
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
        
        // Show stereo cameras properties in Properties Panel
        this.showStereoCamerasProperties();
        
        // Setup keyboard controls for rover
        this.keyboardHandler = (e: KeyboardEvent) => {
            // Only handle arrow keys
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                
                if (e.type === 'keydown') {
                    this.keysPressed.add(e.key);
                } else if (e.type === 'keyup') {
                    this.keysPressed.delete(e.key);
                }
            }
        };
        
        // Use capture phase to intercept events before they reach the viewer
        document.addEventListener('keydown', this.keyboardHandler, true);
        document.addEventListener('keyup', this.keyboardHandler, true);
        
        // Also block default behavior on canvas to prevent scroll/navigation
        const canvas = document.querySelector('canvas');
        if (canvas) {
            this.canvasKeyHandler = (e: KeyboardEvent) => {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            canvas.addEventListener('keydown', this.canvasKeyHandler, true);
            canvas.addEventListener('keyup', this.canvasKeyHandler, true);
            canvas.tabIndex = 0; // Make canvas focusable
            appLogger.debug('Canvas keyboard blocker installed');
        }
        
        appLogger.info('Rover controls active - Arrow keys to move');
    }

    onDeactivate(): void {
        appLogger.debug('Rover project deactivated');
        
        // Remove view mode badge
        if (this.viewModeBadge) {
            this.viewModeBadge.remove();
            this.viewModeBadge = null;
        }
        
        // Re-enable global camera controls
        if (this.cameraControls) {
            this.cameraControls.enable();
            appLogger.info('Global camera controls re-enabled');
        }
        
        // Remove keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler, true);
            document.removeEventListener('keyup', this.keyboardHandler, true);
            this.keyboardHandler = null;
        }
                // Remove canvas keyboard blocker
        if (this.canvasKeyHandler) {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.removeEventListener('keydown', this.canvasKeyHandler, true);
                canvas.removeEventListener('keyup', this.canvasKeyHandler, true);
            }
            this.canvasKeyHandler = null;
        }
                // Clear pressed keys
        this.keysPressed.clear();
        
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
            this.rover.set_orientation(Math.PI / 2, 0); // 90° yaw (facing +Z), 0° pitch
            
            // Reset visual mesh (disabled - too slow)
            // this.updateRoverMeshTransform();
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
    /**
     * Switch between different view modes (scene, stereo, depth, etc.)
     */
    private async switchViewMode(mode: ViewMode): Promise<void> {
        if (this.currentViewMode === mode) return;
        if (!this.layoutManager) {
            appLogger.error('[RoverProject] LayoutManager not initialized');
            return;
        }
        
        appLogger.info(`[RoverProject] Switching view mode: ${this.currentViewMode} → ${mode}`);
        
        // UPDATE CURRENT VIEW MODE FIRST (before layout switch)
        // This is critical for render loops that check currentViewMode
        this.currentViewMode = mode;
        
        // Special case: 'scene' mode restores the original canvas
        if (mode === 'scene') {
            await this.layoutManager.restoreOriginal();
            
            // Ensure canvas has correct resolution for container
            const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
            const container = canvas?.parentElement;
            if (canvas && container) {
                const rect = container.getBoundingClientRect();
                canvas.width = rect.width * window.devicePixelRatio;
                canvas.height = rect.height * window.devicePixelRatio;
                appLogger.debug('[RoverProject] Scene canvas resized', {
                    width: canvas.width,
                    height: canvas.height,
                    devicePixelRatio: window.devicePixelRatio
                });
            }
        } else {
            // Switch to specialized layout
            await this.layoutManager.switchLayout(mode);
        }
        
        // Update view mode badge
        this.updateViewModeBadge(mode);
        
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
     * Create view mode badge overlay
     */
    private createViewModeBadge(): void {
        const canvasWrapper = document.querySelector('.viewer-canvas-wrapper');
        if (!canvasWrapper) {
            appLogger.error('[RoverProject] Canvas wrapper not found');
            return;
        }
        
        // Remove existing badge if any
        const existingBadge = canvasWrapper.querySelector('.view-mode-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Create new badge
        this.viewModeBadge = document.createElement('div');
        this.viewModeBadge.className = 'view-mode-badge';
        canvasWrapper.appendChild(this.viewModeBadge);
        
        // Initial update
        this.updateViewModeBadge(this.currentViewMode);
    }

    /**
     * Update view mode badge content
     */
    private updateViewModeBadge(mode: ViewMode): void {
        if (!this.viewModeBadge) {
            this.createViewModeBadge();
            if (!this.viewModeBadge) return; // Failed to create
        }
        
        const modeInfo: Record<ViewMode, { icon: string; label: string }> = {
            'scene': { icon: '🎬', label: 'Scene Explorer' },
            'stereo': { icon: '👁️', label: 'Stereo Vision' },
            'depth': { icon: '🔬', label: 'Depth Analysis' },
            'full-grid': { icon: '🎯', label: 'Full Grid' },
            'point-cloud': { icon: '🎨', label: 'Point Cloud' }
        };
        
        const info = modeInfo[mode];
        this.viewModeBadge.innerHTML = `
            <span class="icon">${info.icon}</span>
            <span class="label">${info.label}</span>
        `;
    }

    // ========================
    // Stereo Vision Management
    // ========================

    /**
     * Update stereo cameras info in Properties Panel
     */
    private updateStereoCamerasInfo(): void {
        if (!this.detailsPanel || !this.rover) return;

        // This will be called when rover moves to update the displayed camera info
        // For now, just trigger a redraw of the camera properties if they're visible
        this.showStereoCamerasProperties();
    }

    /**
     * Show stereo cameras properties in Properties Panel (editable)
     */
    private showStereoCamerasProperties(): void {
        if (!this.detailsPanel || !this.rover) return;

        // Get current camera positions from rover
        const leftPos = this.rover.get_left_camera_position();
        const rightPos = this.rover.get_right_camera_position();
        const roverPos = this.rover.get_position();
        const yaw = this.rover.get_yaw();
        const pitch = this.rover.get_pitch();
        const baseline = this.rover.get_stereo_baseline();
        const eyeHeight = this.rover.get_eye_height();

        // Calculate target point (where cameras are looking)
        const lookDistance = 5.0;
        const targetX = roverPos[0] + Math.sin(yaw) * Math.cos(pitch) * lookDistance;
        const targetY = roverPos[1] + Math.sin(pitch) * lookDistance;
        const targetZ = roverPos[2] + Math.cos(yaw) * Math.cos(pitch) * lookDistance;

        // Create editable properties HTML
        const propertiesHTML = `
            <div class="stereo-cameras-properties" style="padding: 16px;">
                <h2 style="margin-top: 0; color: var(--accent-color);">📹 Stereo Cameras</h2>
                
                <!-- LEFT CAMERA -->
                <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">⬅️ Left Camera</h3>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Position</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                            <div>
                                <label for="left-cam-x" style="font-size: 10px; color: var(--text-secondary);">X (m)</label>
                                <input type="number" id="left-cam-x" name="left-cam-x" step="0.01" value="${leftPos[0].toFixed(3)}" readonly 
                                       style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            </div>
                            <div>
                                <label for="left-cam-y" style="font-size: 10px; color: var(--text-secondary);">Y (m)</label>
                                <input type="number" id="left-cam-y" name="left-cam-y" step="0.01" value="${leftPos[1].toFixed(3)}" readonly
                                       style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            </div>
                            <div>
                                <label for="left-cam-z" style="font-size: 10px; color: var(--text-secondary);">Z (m)</label>
                                <input type="number" id="left-cam-z" name="left-cam-z" step="0.01" value="${leftPos[2].toFixed(3)}" readonly
                                       style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT CAMERA -->
                <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">➡️ Right Camera</h3>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Position</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                            <div>
                                <label for="right-cam-x" style="font-size: 10px; color: var(--text-secondary);">X (m)</label>
                                <input type="number" id="right-cam-x" name="right-cam-x" step="0.01" value="${rightPos[0].toFixed(3)}" readonly
                                       style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            </div>
                            <div>
                                <label for="right-cam-y" style="font-size: 10px; color: var(--text-secondary);">Y (m)</label>
                                <input type="number" id="right-cam-y" name="right-cam-y" step="0.01" value="${rightPos[1].toFixed(3)}" readonly
                                       style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            </div>
                            <div>
                                <label for="right-cam-z" style="font-size: 10px; color: var(--text-secondary);">Z (m)</label>
                                <input type="number" id="right-cam-z" name="right-cam-z" step="0.01" value="${rightPos[2].toFixed(3)}" readonly
                                       style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- EDITABLE PARAMETERS -->
                <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">⚙️ Camera Parameters</h3>
                    
                    <div style="margin-bottom: 12px;">
                        <label for="rover-baseline-input" style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Baseline (m)</label>
                        <input type="number" id="rover-baseline-input" name="baseline" step="0.01" value="${baseline.toFixed(3)}" 
                               style="width: 100%; padding: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <p style="margin: 4px 0 0 0; font-size: 10px; color: var(--text-secondary);">Distance between left and right cameras</p>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label for="rover-eyeheight-input" style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Eye Height (m)</label>
                        <input type="number" id="rover-eyeheight-input" name="eyeheight" step="0.01" value="${eyeHeight.toFixed(3)}" 
                               style="width: 100%; padding: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <p style="margin: 4px 0 0 0; font-size: 10px; color: var(--text-secondary);">Height of cameras above rover center</p>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label for="rover-fov-input" style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Field of View (°)</label>
                        <input type="number" id="rover-fov-input" name="fov" step="1" value="${this.cameraFOV}" readonly
                               style="width: 100%; padding: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); opacity: 0.6;">
                        <p style="margin: 4px 0 0 0; font-size: 10px; color: var(--text-secondary);">Camera field of view (not editable yet)</p>
                    </div>

                    <button id="rover-apply-params-btn" 
                            style="width: 100%; padding: 10px; background: var(--accent-color); border: 1px solid var(--accent-color); border-radius: 4px; color: var(--text-primary); font-weight: 600; cursor: pointer;">
                        Apply Changes
                    </button>
                </div>

                <!-- TARGET INFO -->
                <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 4px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">🎯 Look Target</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                        <div>
                            <label for="target-x" style="font-size: 10px; color: var(--text-secondary);">X (m)</label>
                            <input type="number" id="target-x" name="target-x" value="${targetX.toFixed(3)}" readonly
                                   style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); opacity: 0.6;">
                        </div>
                        <div>
                            <label for="target-y" style="font-size: 10px; color: var(--text-secondary);">Y (m)</label>
                            <input type="number" id="target-y" name="target-y" value="${targetY.toFixed(3)}" readonly
                                   style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); opacity: 0.6;">
                        </div>
                        <div>
                            <label for="target-z" style="font-size: 10px; color: var(--text-secondary);">Z (m)</label>
                            <input type="number" id="target-z" name="target-z" value="${targetZ.toFixed(3)}" readonly
                                   style="width: 100%; padding: 4px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); opacity: 0.6;">
                        </div>
                    </div>
                </div>

                <div style="margin-top: 16px; padding: 12px; background: rgba(74, 158, 255, 0.1); border-radius: 4px; border-left: 3px solid var(--accent-color);">
                    <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
                        💡 <strong>Tip:</strong> Adjust baseline and eye height, then click "Apply Changes" to update the cameras. Move the rover with arrow keys to see the effect.
                    </p>
                </div>
            </div>
        `;

        // Set the HTML in the panel content
        const mainContent = this.detailsPanel.element.querySelector('.panel-content');
        if (mainContent) {
            mainContent.innerHTML = propertiesHTML;

            // Attach event listener to Apply button
            const applyBtn = document.getElementById('rover-apply-params-btn');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => this.applyCameraParameters());
            }
        }
    }

    /**
     * Apply camera parameter changes to rover
     */
    private applyCameraParameters(): void {
        if (!this.rover) return;

        // Get values from inputs
        const baselineInput = document.getElementById('rover-baseline-input') as HTMLInputElement;
        const eyeHeightInput = document.getElementById('rover-eyeheight-input') as HTMLInputElement;

        if (baselineInput && eyeHeightInput) {
            const newBaseline = parseFloat(baselineInput.value);
            const newEyeHeight = parseFloat(eyeHeightInput.value);

            // Validate inputs
            if (isNaN(newBaseline) || isNaN(newEyeHeight)) {
                appLogger.error('[RoverProject] Invalid camera parameters');
                return;
            }

            // Apply to rover
            this.rover.set_stereo_baseline(newBaseline);
            this.rover.set_eye_height(newEyeHeight);

            // Update local cache
            // Note: cameraBaseline is readonly, but we can override it for display
            (this as any).cameraBaseline = newBaseline;

            appLogger.info('[RoverProject] Camera parameters updated', { 
                baseline: newBaseline, 
                eyeHeight: newEyeHeight,
                currentMode: this.currentViewMode,
                leftCameraPos: this.rover.get_left_camera_position(),
                rightCameraPos: this.rover.get_right_camera_position()
            });

            // Refresh the properties display to show new camera positions
            this.showStereoCamerasProperties();

            // Update status bar
            if (this.statusBar) {
                this.statusBar.updateStats({ 
                    status: `📹 Camera params updated: baseline=${newBaseline.toFixed(2)}m, height=${newEyeHeight.toFixed(2)}m - Switch to Stereo view to see changes`
                });
            }

            // If in stereo mode, the render loop will automatically use the new parameters
            // No need to manually trigger a render - requestAnimationFrame loop handles it
        }
    }

    /**
     * Create stereo viewers (shared logic for stereo and full-grid modes)
     * This ensures IDENTICAL configuration in both modes
     */
    private async createStereoViewers(): Promise<void> {
        appLogger.debug('[RoverProject] Creating stereo viewers...');
        
        // Import WASM modules
        // @ts-ignore
        const viewerModule = await import('../../../../crates/polylab-viewer/pkg/polylab_viewer.js');
        await viewerModule.default();
        
        if (!this.rover) {
            appLogger.error('[RoverProject] Rover not initialized');
            return;
        }
        
        // Get canvas references
        this.stereoCanvasLeft = document.getElementById('stereo-canvas-left') as HTMLCanvasElement;
        this.stereoCanvasRight = document.getElementById('stereo-canvas-right') as HTMLCanvasElement;
        
        if (!this.stereoCanvasLeft || !this.stereoCanvasRight) {
            appLogger.error('[RoverProject] Failed to get stereo canvas references');
            return;
        }
        
        // Set canvas resolution to match container size (fixes pixelation)
        const leftContainer = this.stereoCanvasLeft.parentElement;
        const rightContainer = this.stereoCanvasRight.parentElement;
        
        if (leftContainer && rightContainer) {
            const leftRect = leftContainer.getBoundingClientRect();
            const rightRect = rightContainer.getBoundingClientRect();
            
            this.stereoCanvasLeft.width = leftRect.width * window.devicePixelRatio;
            this.stereoCanvasLeft.height = leftRect.height * window.devicePixelRatio;
            
            this.stereoCanvasRight.width = rightRect.width * window.devicePixelRatio;
            this.stereoCanvasRight.height = rightRect.height * window.devicePixelRatio;
            
            appLogger.debug('[RoverProject] Stereo canvas sizes set', {
                left: { width: this.stereoCanvasLeft.width, height: this.stereoCanvasLeft.height },
                right: { width: this.stereoCanvasRight.width, height: this.stereoCanvasRight.height },
                devicePixelRatio: window.devicePixelRatio
            });
        }
        
        // Create viewers
        appLogger.debug('[RoverProject] Creating stereo viewers from canvas elements...');
        this.leftViewer = await viewerModule.ViewerHandle.create('stereo-canvas-left');
        this.rightViewer = await viewerModule.ViewerHandle.create('stereo-canvas-right');
        
        // Load scene meshes
        await this.loadSceneIntoViewer(this.leftViewer);
        await this.loadSceneIntoViewer(this.rightViewer);
        
        // Apply rover transformation
        this.updateRoverMeshTransform();
        
        appLogger.debug('[RoverProject] Stereo viewers created successfully');
    }
    
    /**
     * Initialize stereo viewers (always creates fresh viewers with current rover parameters)
     */
    private async initStereoViewers(): Promise<void> {
        appLogger.debug('[RoverProject] Initializing stereo viewers...');
        
        // Use shared creation logic
        await this.createStereoViewers();
        
        // Start render loop
        this.startStereoRenderLoop();
        
        appLogger.debug('[RoverProject] Stereo viewers initialized successfully');
    }
    
    /**
     * Start stereo render loop
     */
    private startStereoRenderLoop(): void {
        appLogger.debug('[RoverProject] Starting stereo render loop');
        this.stopStereoRenderLoop();
        this.renderStereoFrame();
    }
    
    /**
     * Stop stereo render loop
     */
    private stopStereoRenderLoop(): void {
        if (this.stereoAnimationId !== null) {
            cancelAnimationFrame(this.stereoAnimationId);
            this.stereoAnimationId = null;
        }
    }
    
    /**
     * Load scene meshes into a viewer
     */
    private async loadSceneIntoViewer(viewer: any): Promise<void> {
        // Load ground plane
        const planeResponse = await fetch('/assets/rover/plane.obj');
        const planeObj = await planeResponse.text();
        viewer.load_mesh_at('ground-plane', planeObj, 0, 0, 0);
        
        // Load Wall-E rover at ORIGIN without transformation
        // Transformation will be applied via GPU matrix in updateRoverMeshTransform()
        const wallyResponse = await fetch('/assets/rover/wally.obj');
        const wallyObj = await wallyResponse.text();
        viewer.load_mesh_at('rover-wally', wallyObj, 0, 0, 0);
        
        // Load target cube
        const cubeResponse = await fetch('/assets/rover/cube.obj');
        const cubeObj = await cubeResponse.text();
        viewer.load_mesh_at('target-cube', cubeObj, 0, 0.5, 10);
    }
    
    /**
     * Render frame for stereo viewers
     */
    private renderStereoFrame = (): void => {
        // Only render if still in stereo mode
        if (this.currentViewMode !== 'stereo') {
            this.stereoAnimationId = null;
            return;
        }
        
        if (!this.leftViewer || !this.rightViewer || !this.rover) return;
        
        try {
            // Sync rover mesh position in stereo viewers before rendering
            this.updateRoverMeshTransform();
            
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
            
        } catch (error) {
            appLogger.error('Stereo render error:', error);
        }
        
        // Continue rendering
        this.stereoAnimationId = requestAnimationFrame(this.renderStereoFrame);
    };

    // ========================
    // Full Grid Layout (Scene + Stereo)
    // ========================

    /**
     * Setup full grid layout (preserves original canvas, creates fresh stereo viewers)
     */
    private async setupFullGridLayout(container: HTMLElement): Promise<void> {
        appLogger.debug('[RoverProject] Setting up full grid layout...');
        
        if (!this.rover) {
            appLogger.error('[RoverProject] Rover not initialized');
            return;
        }
        
        // CRITICAL: Get the original webgpu-canvas BEFORE modifying HTML
        const webgpuCanvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        if (!webgpuCanvas) {
            appLogger.error('[RoverProject] webgpu-canvas not found');
            return;
        }
        
        // Remove canvas temporarily to preserve it
        webgpuCanvas.remove();
        
        // Build full grid HTML (does NOT include webgpu-canvas)
        container.innerHTML = RoverUITemplates.generateFullGridHTML();
        
        // Insert the ORIGINAL webgpu-canvas into the scene container
        const sceneContainer = container.querySelector('.grid-main-scene');
        if (sceneContainer) {
            sceneContainer.appendChild(webgpuCanvas);
        }
        
        // Do NOT resize the main canvas - keep it as is to preserve the viewer
        // The CSS will handle the display size
        
        // Create stereo viewers using EXACT same logic as stereo mode
        await this.createStereoViewers();
        
        // Start render loop
        this.startFullGridRenderLoop();
        
        appLogger.debug('[RoverProject] Full grid layout setup complete');
    }
    /**
     * Start full grid render loop
     */
    private startFullGridRenderLoop(): void {
        appLogger.debug('[RoverProject] Starting full grid render loop');
        this.stopFullGridRenderLoop();
        this.renderFullGridFrame();
    }
    
    /**
     * Stop full grid render loop
     */
    private stopFullGridRenderLoop(): void {
        if (this.fullGridAnimationId !== null) {
            cancelAnimationFrame(this.fullGridAnimationId);
            this.fullGridAnimationId = null;
        }
    }
    
    /**
     * Render frame for full grid mode
     */
    private renderFullGridFrame = (): void => {
        if (this.currentViewMode !== 'full-grid') {
            this.fullGridAnimationId = null;
            return;
        }
        
        if (!this.rover || !this.viewer || !this.leftViewer || !this.rightViewer) {
            return;
        }
        
        try {
            // Update rover mesh in all viewers
            this.updateRoverMeshTransform();
            
            // Render main scene
            const webgpuCanvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
            if (webgpuCanvas) {
                const sceneAspect = webgpuCanvas.width / webgpuCanvas.height;
                this.viewer.render(sceneAspect);
            }
            
            // Render stereo views
            if (this.stereoCanvasLeft && this.stereoCanvasRight) {
                const stereoAspect = this.stereoCanvasLeft.width / this.stereoCanvasLeft.height;
                
                const leftMatrix = this.rover.get_left_view_projection_matrix(stereoAspect);
                const rightMatrix = this.rover.get_right_view_projection_matrix(stereoAspect);
                
                this.leftViewer.render_with_matrix(leftMatrix);
                this.rightViewer.render_with_matrix(rightMatrix);
            }
        } catch (error) {
            appLogger.error('[RoverProject] Error in full grid render:', error);
        }
        
        this.fullGridAnimationId = requestAnimationFrame(this.renderFullGridFrame);
    };

    // ========================
    // Scene Loading
    // ========================

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
            
            // Load Wally (rover) at ORIGIN without transformation
            // Transformation will be applied via GPU matrix in updateRoverMeshTransform()
            const wallyResponse = await fetch('/assets/rover/wally.obj');
            const wallyContent = await wallyResponse.text();
            this.roverMeshContent = wallyContent; // Store for updates
            this.viewer.load_mesh_at('rover-wally', wallyContent, 0, 0, 0);
            appLogger.debug('Rover (Wally) loaded at origin, will be positioned via GPU matrix');
            
            // Apply initial transformation via GPU matrix
            this.updateRoverMeshTransform();
            
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
     * Update rover mesh visual transform based on rover logical position
     * 
     * Uses GPU-based transformation (updates only the model matrix uniform buffer),
     * which is much faster than CPU-side vertex transformation.
     */
    private updateRoverMeshTransform(): void {
        if (!this.rover) return;
        
        const pos = this.rover.get_position();
        const yaw = this.rover.get_yaw();
        
        // Convert yaw to degrees for mesh rotation
        // Unified convention: yaw=0 → -Z, yaw increases → rotates left (+X direction)
        // Wall-E OBJ mesh is rotated 90° right by default, so we add -90° offset
        const rotationDegrees = -(yaw * 180 / Math.PI - 90);
        
        try {
            // Update main viewer
            if (this.viewer) {
                this.viewer.update_mesh_transform_matrix(
                    'rover-wally',
                    pos[0], pos[1], pos[2],
                    rotationDegrees
                );
            }
            
            // Update stereo viewers (if active)
            // These are reused in both stereo and full-grid modes
            if (this.leftViewer) {
                this.leftViewer.update_mesh_transform_matrix(
                    'rover-wally',
                    pos[0], pos[1], pos[2],
                    rotationDegrees
                );
            }
            
            if (this.rightViewer) {
                this.rightViewer.update_mesh_transform_matrix(
                    'rover-wally',
                    pos[0], pos[1], pos[2],
                    rotationDegrees
                );
            }
        } catch (error) {
            appLogger.error('Failed to update rover mesh transform', error);
        }
    }
    
    /**
     * Update camera to follow rover in 3rd person view
     * Camera is positioned behind and above the rover, looking ahead
     */
    private updateCamera3rdPerson(): void {
        if (!this.viewer || !this.rover) return;
        
        const pos = this.rover.get_position();
        const yaw = this.rover.get_yaw();
        
        // Calculate forward vector based on rover yaw (unified convention with Camera)
        // yaw=0 → -Z, yaw increases → rotates left (+X)
        const forward = {
            x: Math.sin(yaw),
            z: -Math.cos(yaw)
        };
        
        // Camera offset from rover (behind and above)
        const cameraDistance = 8.0; // meters behind
        const cameraHeight = 4.0;   // meters above ground
        
        // Camera position = rover position - forward * distance + up * height
        const camX = pos[0] - forward.x * cameraDistance;
        const camY = cameraHeight;
        const camZ = pos[2] - forward.z * cameraDistance;
        
        // Target point = rover position + forward offset (look ahead)
        const lookAheadDistance = 3.0; // meters ahead of rover
        const targetX = pos[0] + forward.x * lookAheadDistance;
        const targetY = pos[1] + 0.5; // Look slightly above rover center
        const targetZ = pos[2] + forward.z * lookAheadDistance;
        
        // Update camera position and target
        this.viewer.camera_set_position(camX, camY, camZ);
        this.viewer.set_camera_target(targetX, targetY, targetZ);
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
            yaw = this.rover.get_yaw();
            pitch = this.rover.get_pitch();
            posX = pos[0];
            posY = pos[1];
            posZ = pos[2];
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
