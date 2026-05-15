import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction, DropZoneConfig } from '../core/types';
import { createFileInput, setupDropZone } from '../utils/meshLoader';

/**
 * Toolbar component - Dynamic action buttons bar with optional drop zone
 */
export class Toolbar implements UIComponent {
    element: HTMLElement;
    private actionsContainer: HTMLElement | null = null;
    private dropZoneElement: HTMLElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    private currentActions: Map<string, ToolbarAction> = new Map();

    constructor() {
        this.element = this.createElement();
    }

    /**
     * Set toolbar actions dynamically
     * Called by UIManager when project changes
     * 
     * @param actions - Array of toolbar actions to display
     */
    public setActions(actions: ToolbarAction[]): void {
        if (!this.actionsContainer) {
            console.warn('[Toolbar] Actions container not found');
            return;
        }

        // Clear current actions
        this.actionsContainer.innerHTML = '';
        this.currentActions.clear();

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

            button.addEventListener('click', () => {
                if (!button.disabled) {
                    action.action();
                }
            });

            this.actionsContainer!.appendChild(button);
            this.currentActions.set(action.id, action);
        });
    }

    /**
     * Update a specific action (e.g., enable/disable)
     * 
     * @param actionId - ID of the action to update
     * @param updates - Partial action updates
     */
    public updateAction(actionId: string, updates: Partial<ToolbarAction>): void {
        const button = this.element.querySelector(`#toolbar-${actionId}`) as HTMLButtonElement;
        if (!button) return;

        const action = this.currentActions.get(actionId);
        if (!action) return;

        // Update action properties
        Object.assign(action, updates);

        // Update button
        if (updates.enabled !== undefined) {
            button.disabled = !updates.enabled;
        }
        if (updates.icon) {
            const iconSpan = button.querySelector('.icon');
            if (iconSpan) iconSpan.textContent = updates.icon;
        }
        if (updates.tooltip) {
            button.title = updates.tooltip;
            const labelSpan = button.querySelector('.label');
            if (labelSpan) labelSpan.textContent = updates.tooltip;
        }
    }

    /**
     * Configure drop zone for file loading
     * Called by UIManager when project changes
     */
    public configureDropZone(config: DropZoneConfig | null): void {
        // Remove existing drop zone if any
        if (this.dropZoneElement) {
            this.dropZoneElement.remove();
            this.dropZoneElement = null;
        }

        // Remove existing file input
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }

        // If no config or disabled, hide drop zone
        if (!config || !config.enabled) {
            return;
        }

        // Create drop zone
        this.dropZoneElement = document.createElement('div');
        this.dropZoneElement.className = 'drop-zone';
        this.dropZoneElement.id = 'drop-zone';
        this.dropZoneElement.textContent = config.label || 'Drag & drop files here or click to browse';

        // Add to toolbar after actions
        const divider = document.createElement('div');
        divider.className = 'toolbar-divider';
        this.element.appendChild(divider);
        this.element.appendChild(this.dropZoneElement);

        // Create file input
        this.fileInput = createFileInput(config.onLoad, config.onError);
        document.body.appendChild(this.fileInput);

        // Setup drop zone
        setupDropZone(this.dropZoneElement, config.onLoad, config.onError);

        // Click to open file picker
        this.dropZoneElement.addEventListener('click', () => {
            this.fileInput?.click();
        });
    }

    private createElement(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';

        toolbar.innerHTML = `
            <div class="toolbar-actions" id="toolbar-actions">
                <!-- Dynamic buttons will be inserted here -->
            </div>
        `;

        this.actionsContainer = toolbar.querySelector('#toolbar-actions');

        return toolbar;
    }

    render(): void {
        // Toolbar renders dynamically via setActions()
    }

    destroy(): void {
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }
        if (this.dropZoneElement) {
            this.dropZoneElement.remove();
            this.dropZoneElement = null;
        }
        this.element.remove();
    }
}
