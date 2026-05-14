import type { UIComponent } from '../types/ui.types';

/**
 * ViewerCanvas component - Manages the WebGPU canvas
 */
export class ViewerCanvas implements UIComponent {
    element: HTMLElement;
    private canvas: HTMLCanvasElement;

    constructor() {
        this.element = this.createElement();
        this.canvas = this.element.querySelector('canvas')!;
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'viewer-container';

        container.innerHTML = `
            <canvas id="webgpu-canvas"></canvas>
        `;

        return container;
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
