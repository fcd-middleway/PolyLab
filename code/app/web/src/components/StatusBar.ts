import type { UIComponent, ViewerStats } from '../types/ui.types';

/**
 * Status Bar component - Bottom bar showing status and stats
 */
export class StatusBar implements UIComponent {
    element: HTMLElement;
    private stats: ViewerStats = {
        fps: 0,
        backend: 'Unknown',
        meshCount: 0,
        status: 'Initializing...'
    };

    constructor() {
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const statusBar = document.createElement('div');
        statusBar.className = 'status-bar';

        statusBar.innerHTML = `
            <span class="status-item" id="status-message">Initializing...</span>
            <span class="status-divider">|</span>
            <span class="status-item" id="status-backend">Backend: Unknown</span>
            <span class="status-divider">|</span>
            <span class="status-item" id="status-fps">0 FPS</span>
        `;

        return statusBar;
    }

    /**
     * Update status bar information
     */
    updateStats(stats: Partial<ViewerStats>): void {
        if (stats.fps !== undefined) this.stats.fps = stats.fps;
        if (stats.backend !== undefined) this.stats.backend = stats.backend;
        if (stats.meshCount !== undefined) this.stats.meshCount = stats.meshCount;
        if (stats.status !== undefined) this.stats.status = stats.status;
        
        this.render();
    }

    render(): void {
        this.updateElement('#status-message', this.stats.status);
        this.updateElement('#status-backend', `Backend: ${this.stats.backend}`);
        this.updateElement('#status-fps', `${Math.round(this.stats.fps)} FPS`);
    }

    private updateElement(selector: string, value: string): void {
        const el = this.element.querySelector(selector);
        if (el) el.textContent = value;
    }

    destroy(): void {
        this.element.remove();
    }
}
