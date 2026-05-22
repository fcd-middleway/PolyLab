import type { UIComponent } from '../types/ui.types';

/**
 * Help Overlay - Display keyboard shortcuts and controls
 */
export class HelpOverlay implements UIComponent {
    element: HTMLElement;
    private isVisible: boolean = false;

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
        this.setupGlobalKeyboardShortcut();
    }

    private createElement(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'help-overlay';
        overlay.style.display = 'none';

        overlay.innerHTML = `
            <div class="help-overlay-backdrop"></div>
            <div class="help-overlay-content">
                <div class="help-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button class="help-close-btn" title="Close (ESC)">✕</button>
                </div>
                
                <div class="help-sections">
                    <div class="help-section">
                        <h3>Camera Movement</h3>
                        <div class="help-grid">
                            <div class="help-item">
                                <kbd>↑</kbd>
                                <span>Move Up</span>
                            </div>
                            <div class="help-item">
                                <kbd>↓</kbd>
                                <span>Move Down</span>
                            </div>
                            <div class="help-item">
                                <kbd>←</kbd>
                                <span>Strafe Left</span>
                            </div>
                            <div class="help-item">
                                <kbd>→</kbd>
                                <span>Strafe Right</span>
                            </div>
                            <div class="help-item">
                                <kbd>Scroll</kbd>
                                <span>Move Forward/Backward</span>
                            </div>
                            <div class="help-item">
                                <kbd>Drag</kbd>
                                <span>Orbital Rotation</span>
                            </div>
                        </div>
                    </div>

                    <div class="help-section">
                        <h3>Camera Rotation</h3>
                        <div class="help-grid">
                            <div class="help-item">
                                <kbd>Q</kbd>
                                <span>Rotate Left (Yaw)</span>
                            </div>
                            <div class="help-item">
                                <kbd>D</kbd>
                                <span>Rotate Right (Yaw)</span>
                            </div>
                            <div class="help-item">
                                <kbd>Z</kbd>
                                <span>Rotate Up (Pitch)</span>
                            </div>
                            <div class="help-item">
                                <kbd>S</kbd>
                                <span>Rotate Down (Pitch)</span>
                            </div>
                        </div>
                    </div>

                    <div class="help-section">
                        <h3>General</h3>
                        <div class="help-grid">
                            <div class="help-item">
                                <kbd>Ctrl</kbd> + <kbd>H</kbd>
                                <span>Toggle Help</span>
                            </div>
                            <div class="help-item">
                                <kbd>ESC</kbd>
                                <span>Close Help</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return overlay;
    }

    /**
     * Setup global keyboard shortcut (Ctrl+H or Cmd+H)
     */
    private setupGlobalKeyboardShortcut(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // Ctrl+H or Cmd+H to toggle help
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.toggle();
            }
            
            // ESC to close help
            if (e.key === 'Escape' && this.isVisible) {
                e.preventDefault();
                this.hide();
            }
        });
    }

    private attachEventListeners(): void {
        // Close button
        this.element.querySelector('.help-close-btn')?.addEventListener('click', () => {
            this.hide();
        });

        // Click on backdrop to close
        this.element.querySelector('.help-overlay-backdrop')?.addEventListener('click', () => {
            this.hide();
        });

        // Enable mouse wheel scrolling on content
        const contentElement = this.element.querySelector('.help-overlay-content');
        if (contentElement) {
            // Ensure wheel events can scroll the content
            contentElement.addEventListener('wheel', (e: WheelEvent) => {
                // Stop propagation to prevent scrolling the page behind the overlay
                e.stopPropagation();
            });
        }
    }

    /**
     * Show the help overlay
     */
    show(): void {
        this.element.style.display = 'flex';
        this.isVisible = true;
        document.body.style.overflow = 'hidden'; // Prevent scrolling when overlay is open
    }

    /**
     * Hide the help overlay
     */
    hide(): void {
        this.element.style.display = 'none';
        this.isVisible = false;
        document.body.style.overflow = ''; // Restore scrolling
    }

    /**
     * Toggle the help overlay
     */
    toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    render(): void {
        // Static content, no need for re-rendering
    }

    destroy(): void {
        this.element.remove();
    }
}
