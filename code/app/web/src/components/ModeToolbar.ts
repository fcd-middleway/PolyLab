import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction } from '../core/types';

/**
 * Mode Toolbar Component
 * 
 * Handles mode-specific actions (dynamic buttons)
 */
export class ModeToolbar implements UIComponent {
    element: HTMLElement;

    constructor() {
        this.element = this.createElement();
    }

    /**
     * Create the mode toolbar section
     */
    private createElement(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'toolbar-section toolbar-section-mode';
        section.id = 'toolbar-section-mode';
        return section;
    }

    /**
     * Set mode-specific actions (called when project changes)
     */
    public setActions(actions: ToolbarAction[]): void {
        // Clear current mode-specific buttons
        this.element.innerHTML = '';

        // Create buttons for each action
        actions.forEach(action => {
            const button = document.createElement('button');
            button.className = 'toolbar-btn';
            button.id = `toolbar-${action.id}`;
            button.title = action.tooltip;
            button.disabled = action.enabled === false;

            button.innerHTML = `
                <span class="icon">${action.icon}</span>
                <span class="label">${action.tooltip}</span>
            `;

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!button.disabled) {
                    action.action();
                }
            });

            this.element.appendChild(button);
        });
    }

    render(): void {
        // Toolbar renders itself during construction
    }

    destroy(): void {
        this.element.remove();
    }
}
