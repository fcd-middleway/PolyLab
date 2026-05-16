import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction, DropZoneConfig, MenuItem } from '../core/types';
import { createFileInput, setupDropZone } from '../utils/meshLoader';

/**
 * Toolbar component - Dynamic action buttons bar with optional drop zone
 */
export class Toolbar implements UIComponent {
    element: HTMLElement;
    private menuContainer: HTMLElement | null = null;
    private actionsContainer: HTMLElement | null = null;
    private dropZoneElement: HTMLElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    private currentActions: Map<string, ToolbarAction> = new Map();
    private activeMenu: HTMLElement | null = null; // Track currently open menu

    constructor() {
        this.element = this.createElement();
        this.attachGlobalListeners();
    }

    /**
     * Set toolbar menus dynamically
     * Called by UIManager when project changes
     * 
     * @param menuItems - Array of menu items to display
     */
    public setMenuItems(menuItems: MenuItem[]): void {
        if (!this.menuContainer) {
            console.warn('[Toolbar] Menu container not found');
            return;
        }

        // Clear current menus
        this.menuContainer.innerHTML = '';

        // Create menu for each top-level item
        menuItems.forEach(menuItem => {
            if (!menuItem.submenu) return; // Skip items without submenu

            const menuButton = document.createElement('button');
            menuButton.className = 'toolbar-menu-btn';
            menuButton.textContent = menuItem.label || 'Menu';

            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'toolbar-menu-dropdown';
            
            // Add submenu items
            menuItem.submenu.forEach(subItem => {
                if (subItem.separator) {
                    const separator = document.createElement('div');
                    separator.className = 'menu-separator';
                    dropdown.appendChild(separator);
                } else {
                    const item = document.createElement('button');
                    item.className = 'menu-item';
                    item.textContent = subItem.label || '';
                    item.disabled = subItem.enabled === false;
                    
                    if (!item.disabled && subItem.action) {
                        item.addEventListener('click', () => {
                            subItem.action!();
                            this.closeActiveMenu();
                        });
                    }
                    
                    dropdown.appendChild(item);
                }
            });

            // Create menu container
            const menuWrapper = document.createElement('div');
            menuWrapper.className = 'toolbar-menu';
            menuWrapper.appendChild(menuButton);
            menuWrapper.appendChild(dropdown);

            // Toggle dropdown on button click
            menuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu(menuWrapper);
            });

            this.menuContainer!.appendChild(menuWrapper);
        });
    }

    /**
     * Toggle menu dropdown
     */
    private toggleMenu(menuWrapper: HTMLElement): void {
        const isOpen = menuWrapper.classList.contains('open');
        
        // Close any currently open menu
        this.closeActiveMenu();
        
        if (!isOpen) {
            menuWrapper.classList.add('open');
            this.activeMenu = menuWrapper;
        }
    }

    /**
     * Close currently active menu
     */
    private closeActiveMenu(): void {
        if (this.activeMenu) {
            this.activeMenu.classList.remove('open');
            this.activeMenu = null;
        }
    }

    /**
     * Attach global listeners for closing menus
     */
    private attachGlobalListeners(): void {
        document.addEventListener('click', () => {
            this.closeActiveMenu();
        });
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
            <div class="toolbar-menus" id="toolbar-menus">
                <!-- Dynamic menus will be inserted here -->
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-actions" id="toolbar-actions">
                <!-- Dynamic buttons will be inserted here -->
            </div>
        `;

        this.menuContainer = toolbar.querySelector('#toolbar-menus');
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
