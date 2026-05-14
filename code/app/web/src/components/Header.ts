import type { UIComponent } from '../types/ui.types';

/**
 * Header component - Top bar with title and utility icons
 */
export class Header implements UIComponent {
    element: HTMLElement;

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
    }

    private createElement(): HTMLElement {
        const header = document.createElement('header');
        header.className = 'app-header';

        header.innerHTML = `
            <div class="header-left">
                <div class="logo">🦀</div>
                <h1 class="title">PolyLab</h1>
            </div>
            <div class="header-right">
                <button class="icon-btn" id="theme-toggle" title="Toggle theme">
                    <span class="icon">🌙</span>
                </button>
                <button class="icon-btn" id="help-btn" title="Help">
                    <span class="icon">?</span>
                </button>
                <button class="icon-btn" id="github-btn" title="GitHub">
                    <span class="icon">⚙</span>
                </button>
            </div>
        `;

        return header;
    }

    private attachEventListeners(): void {
        // Theme toggle
        this.element.querySelector('#theme-toggle')?.addEventListener('click', () => {
            console.log('[Header] Theme toggle clicked');
        });

        // Help button
        this.element.querySelector('#help-btn')?.addEventListener('click', () => {
            console.log('[Header] Help button clicked');
        });

        // GitHub button
        this.element.querySelector('#github-btn')?.addEventListener('click', () => {
            console.log('[Header] GitHub button clicked');
        });
    }

    render(): void {
        // Header is static, no need for re-rendering
    }

    destroy(): void {
        this.element.remove();
    }
}
