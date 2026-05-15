import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction } from '../core/types';
import { createFileInput, setupDropZone, type MeshLoadCallback, type ErrorCallback } from '../utils/meshLoader';

/**
 * Toolbar component - Dynamic action buttons bar
 */
export class Toolbar implements UIComponent {
    element: HTMLElement;
    private fileInput: HTMLInputElement | null = null;
    private onLoadCallback: MeshLoadCallback | null = null;
    private onErrorCallback: ErrorCallback | null = null;
    private actionsContainer: HTMLElement | null = null;
    private currentActions: Map<string, ToolbarAction> = new Map();

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
    }

    /**
     * Set the mesh loading callback
     * 
     * This is called when a file is successfully loaded.
     * The main app should set this after the viewer is initialized.
     */
    public setLoadCallback(onLoad: MeshLoadCallback, onError: ErrorCallback): void {
        this.onLoadCallback = onLoad;
        this.onErrorCallback = onError;

        // Create file input now that we have callbacks
        if (!this.fileInput) {
            this.fileInput = createFileInput(onLoad, onError);
            document.body.appendChild(this.fileInput);

            // Setup drop zone
            const dropZone = this.element.querySelector('#drop-zone');
            if (dropZone) {
                setupDropZone(dropZone as HTMLElement, onLoad, onError);
            }
        }
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

    private createElement(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';

        toolbar.innerHTML = `
            <div class="toolbar-actions" id="toolbar-actions">
                <!-- Dynamic buttons will be inserted here -->
            </div>
            <div class="toolbar-divider"></div>
            <div class="drop-zone" id="drop-zone">
                Drag & drop .obj files or click to browse
            </div>
        `;

        this.actionsContainer = toolbar.querySelector('#toolbar-actions');

        return toolbar;
    }

    private attachEventListeners(): void {
        // Click on drop zone triggers file picker
        const dropZone = this.element.querySelector('#drop-zone');
        dropZone?.addEventListener('click', () => {
            if (this.fileInput) {
                this.fileInput.click();
            } else {
                console.warn('[Toolbar] File input not initialized yet. Viewer might not be ready.');
            }
        });
    }

    render(): void {
        // Toolbar renders dynamically via setActions()
    }

    destroy(): void {
        if (this.fileInput) {
            this.fileInput.remove();
            this.fileInput = null;
        }
        this.element.remove();
    }
}
