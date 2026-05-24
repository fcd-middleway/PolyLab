/**
 * Camera Controls
 * 
 * Handles keyboard and mouse input for first-person camera control.
 * 
 * Controls:
 * - Arrow Up/Down: Move up/down (vertical)
 * - Arrow Left/Right: Strafe left/right
 * - Q/D: Rotate yaw (left/right)
 * - Z/S: Rotate pitch (up/down)
 * - Mouse Scroll: Move forward/backward
 * - Mouse Drag (left button): Orbital rotation around target
 */

import { appLogger } from './logger';

export interface CameraState {
    // Movement
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    
    // Rotation
    rotateLeft: boolean;
    rotateRight: boolean;
    rotateUp: boolean;
    rotateDown: boolean;
}

export class CameraControls {
    private viewer: any;
    private state: CameraState;
    private enabled: boolean = false;
    
    // Control sensitivity (reduced by 2 for finer control)
    private moveSpeed: number = 0.01; // Units per frame when key is held
    private rotationSpeed: number = 0.0025; // Radians per frame when key is held
    
    // Mouse orbital rotation state
    private isDragging: boolean = false;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    private mouseSensitivity: number = 0.00125; // Radians per pixel (÷4 for smooth orbital exploration)
    
    constructor(viewer: any) {
        this.viewer = viewer;
        this.state = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            moveUp: false,
            moveDown: false,
            rotateLeft: false,
            rotateRight: false,
            rotateUp: false,
            rotateDown: false,
        };
        
        this.setupEventListeners();
        appLogger.info('Camera controls initialized');
    }
    
    /**
     * Enable camera controls
     */
    enable(): void {
        this.enabled = true;
        appLogger.debug('Camera controls enabled');
    }
    
    /**
     * Disable camera controls
     */
    disable(): void {
        this.enabled = false;
        // Reset state
        Object.keys(this.state).forEach(key => {
            (this.state as any)[key] = false;
        });
        appLogger.debug('Camera controls disabled');
    }
    
    /**
     * Check if controls are enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Update camera based on current input state
     * Call this every frame from the animation loop
     */
    update(deltaTime: number): void {
        if (!this.enabled) return;
        
        // Movement (scaled by deltaTime for frame-rate independence)
        const moveAmount = this.moveSpeed * deltaTime * 60; // Normalize to 60fps baseline
        
        if (this.state.moveForward) {
            this.viewer.camera_move_forward(moveAmount);
        }
        if (this.state.moveBackward) {
            this.viewer.camera_move_forward(-moveAmount);
        }
        if (this.state.moveRight) {
            this.viewer.camera_move_right(moveAmount);
        }
        if (this.state.moveLeft) {
            this.viewer.camera_move_right(-moveAmount);
        }
        if (this.state.moveUp) {
            this.viewer.camera_move_up(moveAmount);
        }
        if (this.state.moveDown) {
            this.viewer.camera_move_up(-moveAmount);
        }
        
        // Rotation (scaled by deltaTime for frame-rate independence)
        const rotateAmount = this.rotationSpeed * deltaTime * 60; // Normalize to 60fps baseline
        
        if (this.state.rotateLeft) {
            this.viewer.camera_rotate_yaw(-rotateAmount);
        }
        if (this.state.rotateRight) {
            this.viewer.camera_rotate_yaw(rotateAmount);
        }
        if (this.state.rotateUp) {
            this.viewer.camera_rotate_pitch(rotateAmount);
        }
        if (this.state.rotateDown) {
            this.viewer.camera_rotate_pitch(-rotateAmount);
        }
    }
    
    /**
     * Setup keyboard and mouse event listeners
     * 
     * TODO: MEMORY LEAK - Store bound functions as class properties to allow proper cleanup
     * Currently bind() creates new functions each time, making removeEventListener impossible.
     * Should be: this.boundOnKeyDown = this.onKeyDown.bind(this); then use this.boundOnKeyDown
     */
    private setupEventListeners(): void {
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu
        appLogger.debug('Keyboard, mouse, and wheel event listeners attached');
    }
    
    /**
     * Handle key down event
     */
    private onKeyDown(event: KeyboardEvent): void {
        if (!this.enabled) return;
        
        // Prevent default browser behavior for camera control keys
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (controlKeys.includes(event.key)) {
            event.preventDefault();
        }
        
        switch (event.key) {
            // Vertical movement - Arrow Up/Down
            case 'ArrowUp':
                this.state.moveUp = true;
                break;
            case 'ArrowDown':
                this.state.moveDown = true;
                break;
            
            // Horizontal strafing - Arrow Left/Right
            case 'ArrowLeft':
                this.state.moveLeft = true;
                break;
            case 'ArrowRight':
                this.state.moveRight = true;
                break;
            
            // Rotation - Q/D for yaw, Z/S for pitch
            case 'q':
            case 'Q':
                this.state.rotateLeft = true;
                break;
            case 'd':
            case 'D':
                this.state.rotateRight = true;
                break;
            case 'z':
            case 'Z':
                this.state.rotateUp = true;
                break;
            case 's':
            case 'S':
                this.state.rotateDown = true;
                break;
        }
    }
    
    /**
     * Handle key up event
     */
    private onKeyUp(event: KeyboardEvent): void {
        if (!this.enabled) return;
        
        switch (event.key) {
            // Vertical movement - Arrow Up/Down
            case 'ArrowUp':
                this.state.moveUp = false;
                break;
            case 'ArrowDown':
                this.state.moveDown = false;
                break;
            
            // Horizontal strafing - Arrow Left/Right
            case 'ArrowLeft':
                this.state.moveLeft = false;
                break;
            case 'ArrowRight':
                this.state.moveRight = false;
                break;
            
            // Rotation - Q/D for yaw, Z/S for pitch
            case 'q':
            case 'Q':
                this.state.rotateLeft = false;
                break;
            case 'd':
            case 'D':
                this.state.rotateRight = false;
                break;
            case 'z':
            case 'Z':
                this.state.rotateUp = false;
                break;
            case 's':
            case 'S':
                this.state.rotateDown = false;
                break;
        }
    }
    
    /**
     * Handle mouse down event (start orbital rotation)
     */
    private onMouseDown(event: MouseEvent): void {
        if (!this.enabled) return;
        
        // ONLY allow rotation when clicking on the canvas element
        const target = event.target as HTMLElement;
        if (target.tagName !== 'CANVAS') {
            return;
        }
        
        // Left mouse button for orbital rotation
        if (event.button === 0) {
            this.isDragging = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            appLogger.debug('Started orbital rotation drag');
        }
    }
    
    /**
     * Handle mouse move event (perform orbital rotation)
     */
    private onMouseMove(event: MouseEvent): void {
        if (!this.enabled || !this.isDragging) return;
        
        // Calculate mouse delta
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        
        // Apply orbital rotation (yaw = horizontal, pitch = vertical)
        const deltaYaw = deltaX * this.mouseSensitivity;
        const deltaPitch = -deltaY * this.mouseSensitivity; // Invert Y for natural feel
        
        this.viewer.camera_orbit_around(deltaYaw, deltaPitch);
        
        // Update last position
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    
    /**
     * Handle mouse up event (end orbital rotation)
     */
    private onMouseUp(event: MouseEvent): void {
        if (event.button === 0 && this.isDragging) {
            this.isDragging = false;
            appLogger.debug('Ended orbital rotation drag');
        }
    }
    
    /**
     * Handle mouse wheel event (forward/backward movement)
     */
    private onWheel(event: WheelEvent): void {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        // Scroll up = forward (negative deltaY), scroll down = backward (positive deltaY)
        // Scale by moveSpeed * 2 for comfortable zoom speed
        const scrollAmount = -event.deltaY * this.moveSpeed * 0.05;
        this.viewer.camera_move_forward(scrollAmount);
    }
    
    /**
     * Set movement speed
     */
    setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
        appLogger.debug('Camera move speed set to', { speed });
    }
    
    /**
     * Set rotation speed
     */
    setRotationSpeed(speed: number): void {
        this.rotationSpeed = speed;
        appLogger.debug('Camera rotation speed set to', { speed });
    }
    
    /**
     * Get camera position (for debugging)
     */
    getCameraPosition(): { x: number; y: number; z: number } {
        const [x, y, z] = this.viewer.camera_position();
        return { x, y, z };
    }
    
    /**
     * Cleanup event listeners
     * 
     * TODO: CRITICAL BUG - This does NOT work! bind() creates NEW functions,
     * so these removeEventListener calls remove nothing. The original listeners stay in memory.
     * 
     * Fix: Store bound functions as properties in constructor:
     *   private boundOnKeyDown = this.onKeyDown.bind(this);
     *   private boundOnKeyUp = this.onKeyUp.bind(this);
     *   // ... etc for all listeners
     * Then use: window.removeEventListener('keydown', this.boundOnKeyDown);
     */
    destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown.bind(this));
        window.removeEventListener('keyup', this.onKeyUp.bind(this));
        appLogger.info('Camera controls destroyed');
    }
}
