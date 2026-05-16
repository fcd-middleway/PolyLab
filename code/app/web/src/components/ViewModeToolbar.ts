/**
 * ViewModeToolbar Component
 * 
 * Toolbar for switching between different view modes (Scene, Stereo, Depth Analysis, etc.)
 */

import type { UIComponent } from '../types/ui.types';

export type ViewMode = 'scene' | 'stereo' | 'depth' | 'full-grid' | 'point-cloud';

export interface ViewModeConfig {
    id: ViewMode;
    label: string;
    icon: string;
    enabled: boolean;
}

export class ViewModeToolbar implements UIComponent {
    element: HTMLElement;
    private currentMode: ViewMode = 'scene';
    private modes: ViewModeConfig[] = [];
    private onModeChange: ((mode: ViewMode) => void) | null = null;

    constructor() {
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'view-mode-toolbar-wrapper';
        return container;
    }

    /**
     * Set available view modes
     */
    setModes(modes: ViewModeConfig[]): void {
        this.modes = modes;
        this.render();
    }

    /**
     * Set callback for mode changes
     */
    onModeChangeCallback(callback: (mode: ViewMode) => void): void {
        this.onModeChange = callback;
    }

    /**
     * Get current active mode
     */
    getCurrentMode(): ViewMode {
        return this.currentMode;
    }

    /**
     * Set active mode programmatically
     */
    setMode(mode: ViewMode): void {
        if (this.currentMode !== mode) {
            this.currentMode = mode;
            this.render();
            if (this.onModeChange) {
                this.onModeChange(mode);
            }
        }
    }

    render(): void {
        if (!this.element) return;

        this.element.innerHTML = `
            <div class="view-mode-toolbar">
                ${this.modes.map(mode => this.renderModeButton(mode)).join('')}
            </div>
        `;

        // Attach event listeners
        this.modes.forEach(mode => {
            const button = this.element?.querySelector(`[data-mode="${mode.id}"]`);
            if (button && mode.enabled) {
                button.addEventListener('click', () => this.handleModeClick(mode.id));
            }
        });
    }

    private renderModeButton(mode: ViewModeConfig): string {
        const isActive = mode.id === this.currentMode;
        const disabledClass = !mode.enabled ? 'disabled' : '';
        const activeClass = isActive ? 'active' : '';
        
        return `
            <button 
                class="view-mode-btn ${activeClass} ${disabledClass}"
                data-mode="${mode.id}"
                ${!mode.enabled ? 'disabled' : ''}
                title="${mode.label}"
            >
                <span class="mode-icon">${mode.icon}</span>
                <span class="mode-label">${mode.label}</span>
            </button>
        `;
    }

    private handleModeClick(mode: ViewMode): void {
        this.setMode(mode);
    }

    destroy(): void {
        this.element.remove();
    }
}
