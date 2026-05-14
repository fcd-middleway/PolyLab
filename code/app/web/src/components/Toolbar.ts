import type { UIComponent } from '../types/ui.types';

/**
 * Toolbar component - Action buttons bar
 */
export class Toolbar implements UIComponent {
    element: HTMLElement;

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
    }

    private createElement(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';

        toolbar.innerHTML = `
            <button class="toolbar-btn" id="load-btn" title="Load mesh file">
                <span class="icon">📁</span>
                <span class="label">Load</span>
            </button>
            <button class="toolbar-btn" id="rotate-btn" title="Rotate view">
                <span class="icon">🔄</span>
                <span class="label">Rotate</span>
            </button>
            <button class="toolbar-btn" id="screenshot-btn" title="Take screenshot">
                <span class="icon">📷</span>
                <span class="label">Screenshot</span>
            </button>
            <button class="toolbar-btn" id="measure-btn" title="Measure">
                <span class="icon">📏</span>
                <span class="label">Measure</span>
            </button>
            <button class="toolbar-btn" id="settings-btn" title="Settings">
                <span class="icon">⚙️</span>
                <span class="label">Settings</span>
            </button>
            <div class="toolbar-divider"></div>
            <div class="drop-zone" id="drop-zone">
                Drag & drop .obj files or click to browse
            </div>
        `;

        return toolbar;
    }

    private attachEventListeners(): void {
        // Load button
        this.element.querySelector('#load-btn')?.addEventListener('click', () => {
            console.log('[Toolbar] Load button clicked');
        });

        // Rotate button
        this.element.querySelector('#rotate-btn')?.addEventListener('click', () => {
            console.log('[Toolbar] Rotate button clicked');
        });

        // Screenshot button
        this.element.querySelector('#screenshot-btn')?.addEventListener('click', () => {
            console.log('[Toolbar] Screenshot button clicked');
        });

        // Measure button
        this.element.querySelector('#measure-btn')?.addEventListener('click', () => {
            console.log('[Toolbar] Measure button clicked');
        });

        // Settings button
        this.element.querySelector('#settings-btn')?.addEventListener('click', () => {
            console.log('[Toolbar] Settings button clicked');
        });

        // Drop zone
        const dropZone = this.element.querySelector('#drop-zone');
        dropZone?.addEventListener('click', () => {
            console.log('[Toolbar] Drop zone clicked');
        });

        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.add('drag-over');
        });

        dropZone?.addEventListener('dragleave', (e) => {
            (e.currentTarget as HTMLElement).classList.remove('drag-over');
        });

        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.remove('drag-over');
            console.log('[Toolbar] Files dropped:', (e as DragEvent).dataTransfer?.files);
        });
    }

    render(): void {
        // Toolbar is mostly static
    }

    destroy(): void {
        this.element.remove();
    }
}
