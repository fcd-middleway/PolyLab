import type { UIComponent } from '../types/ui.types';

/**
 * ViewerCanvas component - Manages the WebGPU canvas with optional banner injection
 */
export class ViewerCanvas implements UIComponent {
    element: HTMLElement;
    private canvas: HTMLCanvasElement;
    private bannerContainer: HTMLElement;
    private canvasWrapper: HTMLElement;

    constructor() {
        this.element = this.createElement();
        this.canvas = this.element.querySelector('canvas')!;
        this.bannerContainer = this.element.querySelector('.viewer-banner-container')!;
        this.canvasWrapper = this.element.querySelector('.viewer-canvas-wrapper')!;
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
        this.canvas.width = width;
        this.canvas.height = height;
        console.log(`[ViewerCanvas] Resized to ${width}x${height}`);
    }

    /**
     * Auto-resize canvas to fit its container
     */
    autoResize(): void {
        const container = this.element;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.resize(width, height);
    }

    render(): void {
        // Canvas rendering is handled by WebGPU
    }

    destroy(): void {
        this.element.remove();
    }
}
