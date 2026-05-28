import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction } from '../core/types';

/**
 * Layout Toolbar Component
 * 
 * Handles layout-specific actions (view mode switching buttons)
 */
export class LayoutToolbar implements UIComponent {
    element: HTMLElement;
    private activeButtonId: string | null = null;

    constructor() {
        this.element = this.createElement();
    }

    /**
     * Create the layout toolbar section
     */
    private createElement(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'toolbar-section toolbar-section-layout';
        section.id = 'toolbar-section-layout';
        return section;
    }

    /**
     * Set layout-specific actions (called when project changes)
     */
    public setActions(actions: ToolbarAction[]): void {
        // Clear current layout buttons
        this.element.innerHTML = '';
        this.activeButtonId = null;

        if (actions.length === 0) {
            return;
        }

        // Create buttons for each layout action
        actions.forEach((action, index) => {
            const button = document.createElement('button');
            button.className = 'toolbar-btn layout-btn';
            button.id = `toolbar-${action.id}`;
            button.title = action.tooltip;
            button.disabled = action.enabled === false;

            // Set first button as active by default
            if (index === 0 && !this.activeButtonId) {
                button.classList.add('active');
                this.activeButtonId = action.id;
            }

            button.innerHTML = `
                <span class="icon">${action.icon}</span>
                <span class="label">${action.tooltip}</span>
            `;

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!button.disabled) {
                    // Remove active class from all layout buttons
                    this.element.querySelectorAll('.layout-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });

                    // Add active class to clicked button
                    button.classList.add('active');
                    this.activeButtonId = action.id;

                    // Execute action
                    action.action();
                }
            });

            this.element.appendChild(button);
        });
    }

    /**
     * Set active button programmatically
     */
    public setActiveButton(actionId: string): void {
        this.activeButtonId = actionId;
        const button = this.element.querySelector(`#toolbar-${actionId}`);
        if (button) {
            // Remove active class from all layout buttons
            this.element.querySelectorAll('.layout-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to target button
            button.classList.add('active');
        }
    }

    render(): void {
        // Toolbar renders itself during construction
    }

    destroy(): void {
        this.element.remove();
    }
}
