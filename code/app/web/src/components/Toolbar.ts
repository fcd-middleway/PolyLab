import type { UIComponent } from '../types/ui.types';
import type { ToolbarAction } from '../core/types';
import { FileToolbar } from './FileToolbar';
import { ViewToolbar } from './ViewToolbar';
import { ModeToolbar } from './ModeToolbar';
import { LayoutToolbar } from './LayoutToolbar';

/**
 * Toolbar component - Composed of 4 sections
 * 
 * Structure:
 * [FILE Section (FileToolbar)] | [VIEW Section (ViewToolbar)] | [MODE Section (ModeToolbar)] | [LAYOUT Section (LayoutToolbar)]
 */
export class Toolbar implements UIComponent {
    element: HTMLElement;
    
    // Section components
    private fileToolbar: FileToolbar;
    private viewToolbar: ViewToolbar;
    private modeToolbar: ModeToolbar;
    private layoutToolbar: LayoutToolbar;

    constructor() {
        this.element = this.createElement();
        
        // Create sub-components
        this.fileToolbar = new FileToolbar();
        this.viewToolbar = new ViewToolbar();
        this.modeToolbar = new ModeToolbar();
        this.layoutToolbar = new LayoutToolbar();
        
        // Add sections to toolbar
        this.element.appendChild(this.fileToolbar.element);
        this.element.appendChild(this.createDivider());
        this.element.appendChild(this.viewToolbar.element);
        this.element.appendChild(this.createDivider());
        this.element.appendChild(this.modeToolbar.element);
        this.element.appendChild(this.createDivider());
        this.element.appendChild(this.layoutToolbar.element);
    }

    /**
     * Create the base toolbar structure
     */
    private createElement(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        return toolbar;
    }

    /**
     * Create a divider element
     */
    private createDivider(): HTMLElement {
        const divider = document.createElement('div');
        divider.className = 'toolbar-divider';
        return divider;
    }

    /**
     * Set MODE-specific actions (called when project changes)
     */
    public setModeActions(actions: ToolbarAction[]): void {
        this.modeToolbar.setActions(actions);
    }

    /**
     * Set LAYOUT-specific actions (called when project changes)
     */
    public setLayoutActions(actions: ToolbarAction[]): void {
        this.layoutToolbar.setActions(actions);
    }

    /**
     * Set active layout button programmatically
     */
    public setActiveLayoutButton(actionId: string): void {
        this.layoutToolbar.setActiveButton(actionId);
    }

    /**
     * Configure FILE section callbacks
     */
    public configureFileCallbacks(callbacks: {
        onLoad?: (content: string, filename: string) => Promise<void>;
        onError?: (error: string) => void;
        onExport?: () => void;
        onImport?: (bytes: Uint8Array) => void;
    }): void {
        this.fileToolbar.configure(callbacks);
    }

    /**
     * Configure VIEW section callbacks
     */
    public configureViewCallbacks(callbacks: {
        onResetCamera?: () => void;
        onCenterMesh?: () => void;
        onRenderModeChange?: (modes: { solid: boolean; wireframe: boolean; vertices: boolean }) => void;
    }): void {
        this.viewToolbar.configure(callbacks);
    }

    /**
     * Get current render modes state
     */
    public getRenderModes(): { solid: boolean; wireframe: boolean; vertices: boolean } {
        return this.viewToolbar.getRenderModes();
    }

    render(): void {
        // Toolbar renders itself during construction
    }

    destroy(): void {
        this.fileToolbar.destroy();
        this.viewToolbar.destroy();
        this.modeToolbar.destroy();
        this.layoutToolbar.destroy();
        this.element.remove();
    }
}
