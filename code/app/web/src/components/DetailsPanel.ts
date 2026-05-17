import type { UIComponent } from '../types/ui.types';

/**
 * Details Panel component - Right sidebar showing mesh details
 */
export class DetailsPanel implements UIComponent {
    element: HTMLElement;
    private vertices: number = 0;
    private triangles: number = 0;
    private sizeX: number = 0;
    private sizeY: number = 0;
    private sizeZ: number = 0;
    private isCollapsed: boolean = false;

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
    }

    private createElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'details-panel panel';

        panel.innerHTML = `
            <div class="panel-header">
                <h3>Details</h3>
                <button class="panel-collapse-btn" title="Toggle panel">
                    <span class="collapse-icon">◀</span>
                </button>
            </div>
            <div class="panel-content">
                <div class="detail-row">
                    <span class="detail-label">Vertices:</span>
                    <span class="detail-value" id="detail-vertices">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Triangles:</span>
                    <span class="detail-value" id="detail-triangles">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Size X:</span>
                    <span class="detail-value" id="detail-size-x">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Size Y:</span>
                    <span class="detail-value" id="detail-size-y">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Size Z:</span>
                    <span class="detail-value" id="detail-size-z">-</span>
                </div>
            </div>
        `;

        return panel;
    }

    /**
     * Update mesh details
     */
    updateDetails(data: {
        vertices?: number;
        triangles?: number;
        sizeX?: number;
        sizeY?: number;
        sizeZ?: number;
    }): void {
        if (data.vertices !== undefined) this.vertices = data.vertices;
        if (data.triangles !== undefined) this.triangles = data.triangles;
        if (data.sizeX !== undefined) this.sizeX = data.sizeX;
        if (data.sizeY !== undefined) this.sizeY = data.sizeY;
        if (data.sizeZ !== undefined) this.sizeZ = data.sizeZ;
        
        this.render();
    }

    render(): void {
        const getValue = (value: number) => value > 0 ? value.toLocaleString() : '-';
        const getSize = (value: number) => value > 0 ? value.toFixed(2) : '-';

        this.updateElement('#detail-vertices', getValue(this.vertices));
        this.updateElement('#detail-triangles', getValue(this.triangles));
        this.updateElement('#detail-size-x', getSize(this.sizeX));
        this.updateElement('#detail-size-y', getSize(this.sizeY));
        this.updateElement('#detail-size-z', getSize(this.sizeZ));
    }

    private updateElement(selector: string, value: string): void {
        const el = this.element.querySelector(selector);
        if (el) el.textContent = value;
    }

    private attachEventListeners(): void {
        const collapseBtn = this.element.querySelector('.panel-collapse-btn');
        collapseBtn?.addEventListener('click', () => this.toggle());
    }

    /**
     * Toggle panel collapsed state
     */
    toggle(): void {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.element.classList.add('collapsed');
        } else {
            this.element.classList.remove('collapsed');
        }
    }

    /**
     * Check if panel is collapsed
     */
    isCollapsedState(): boolean {
        return this.isCollapsed;
    }

    destroy(): void {
        this.element.remove();
    }
}
