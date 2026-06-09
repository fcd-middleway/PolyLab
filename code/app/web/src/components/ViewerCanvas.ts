import type { UIComponent } from '../types/ui.types';

/**
 * ViewerCanvas component - Manages the WebGPU canvas with optional banner injection
 */
export class ViewerCanvas implements UIComponent {
    element: HTMLElement;
    private canvas: HTMLCanvasElement;
    private bannerContainer: HTMLElement;
    private canvasWrapper: HTMLElement;
    private resizeObserver: ResizeObserver | null = null;
    private viewer: any = null; // Reference to WASM viewer for resize notifications

    constructor() {
        this.element = this.createElement();
        this.canvas = this.element.querySelector('canvas')!;
        this.bannerContainer = this.element.querySelector('.viewer-banner-container')!;
        this.canvasWrapper = this.element.querySelector('.viewer-canvas-wrapper')!;
        
        // Set up resize observer for automatic canvas resizing
        this.setupResizeObserver();
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'viewer-container';
        container.id = 'canvas-container';

        container.innerHTML = `
            <div class="viewer-banner-container"></div>
            <div class="viewer-canvas-wrapper">
                <canvas id="webgpu-canvas"></canvas>
            </div>
        `;

        return container;
    }

    /**
     * Set viewer reference for resize notifications
     */
    setViewer(viewer: any): void {
        this.viewer = viewer;
    }

    /**
     * Set up ResizeObserver to automatically resize canvas when wrapper changes
     */
    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === this.canvasWrapper) {
                    // Get the actual rendered size
                    const rect = this.canvasWrapper.getBoundingClientRect();
                    const width = Math.floor(rect.width);
                    const height = Math.floor(rect.height);
                    
                    if (width > 0 && height > 0) {
                        this.resize(width, height);
                    }
                }
            }
        });
        
        // Observe the canvas wrapper
        this.resizeObserver.observe(this.canvasWrapper);
    }

    /**
     * Inject a banner component above the canvas
     */
    setBanner(bannerElement: HTMLElement | null): void {
        this.bannerContainer.innerHTML = '';
        if (bannerElement) {
            this.bannerContainer.appendChild(bannerElement);
        }
    }

    /**
     * Clear banner
     */
    clearBanner(): void {
        this.bannerContainer.innerHTML = '';
    }

    /**
     * Get the canvas element for WebGPU initialization
     */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    /**
     * Resize canvas to fit container
     */
    resize(width: number, height: number): void {
        // Update canvas dimensions
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Notify WASM viewer about resize (if available)
        if (this.viewer && typeof this.viewer.resize === 'function') {
            try {
                this.viewer.resize(width, height);
            } catch (error) {
                console.warn('[ViewerCanvas] Failed to notify viewer of resize:', error);
            }
        }
        
        console.log(`[ViewerCanvas] Resized to ${width}x${height}`);
    }

    /**
     * Auto-resize canvas to fit its container
     */
    autoResize(): void {
        const rect = this.canvasWrapper.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        
        if (width > 0 && height > 0) {
            this.resize(width, height);
        }
    }

    render(): void {
        // Canvas rendering is handled by WebGPU
    }

    destroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.element.remove();
    }
}
