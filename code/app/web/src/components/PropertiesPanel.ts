import type { UIComponent } from '../types/ui.types';

/**
 * Properties Panel component - Right sidebar showing mesh properties
 */
export class PropertiesPanel implements UIComponent {
    element: HTMLElement;
    private vertices: number = 0;
    private triangles: number = 0;
    private sizeX: number = 0;
    private sizeY: number = 0;
    private sizeZ: number = 0;
    private isCollapsed: boolean = false;
    private isDetailsCollapsed: boolean = false;
    private isSettingsCollapsed: boolean = false;
    private title: string = 'Properties';

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
    }

    /**
     * Set panel title dynamically
     */
    setTitle(title: string): void {
        this.title = title;
        const titleElement = this.element.querySelector('.panel-header h3');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    /**
     * Set custom content for the Settings section
     */
    setSettingsContent(content: HTMLElement | string): void {
        const settingsContent = this.element.querySelector('#settings-content');
        if (settingsContent) {
            if (typeof content === 'string') {
                settingsContent.innerHTML = content;
            } else {
                settingsContent.innerHTML = '';
                settingsContent.appendChild(content);
            }
            // Show settings section if content is provided
            const settingsSection = this.element.querySelector('.settings-section');
            if (settingsSection) {
                (settingsSection as HTMLElement).style.display = 'block';
            }
        }
    }

    /**
     * Clear Settings section content
     */
    clearSettings(): void {
        const settingsContent = this.element.querySelector('#settings-content');
        if (settingsContent) {
            settingsContent.innerHTML = '<div class="empty-state">No settings available</div>';
        }
        // Hide settings section
        const settingsSection = this.element.querySelector('.settings-section');
        if (settingsSection) {
            (settingsSection as HTMLElement).style.display = 'none';
        }
    }

    private createElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'details-panel panel';

        panel.innerHTML = `
            <div class="panel-header">
                <h3>${this.title}</h3>
                <button class="panel-collapse-btn" title="Toggle panel">
                    <span class="collapse-icon">◀</span>
                </button>
            </div>
            <div class="panel-content">
                <!-- Details Section -->
                <div class="panel-section details-section">
                    <div class="section-header">
                        <h4>Details</h4>
                        <button class="section-collapse-btn" data-section="details" title="Toggle section">
                            <span class="collapse-icon">▼</span>
                        </button>
                    </div>
                    <div class="section-content" id="details-content">
                        <div class="detail-row">
                            <span class="detail-label">Vertices:</span>
                            <span class="detail-value" id="detail-vertices">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Triangles:</span>
                            <span class="detail-value" id="detail-triangles">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Size X:</span>
                            <span class="detail-value" id="detail-size-x">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Size Y:</span>
                            <span class="detail-value" id="detail-size-y">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Size Z:</span>
                            <span class="detail-value" id="detail-size-z">-</span>
                        </div>
                    </div>
                </div>

                <!-- Settings Section (hidden by default) -->
                <div class="panel-section settings-section" style="display: none;">
                    <div class="section-header">
                        <h4>Settings</h4>
                        <button class="section-collapse-btn" data-section="settings" title="Toggle section">
                            <span class="collapse-icon">▼</span>
                        </button>
                    </div>
                    <div class="section-content" id="settings-content">
                        <div class="empty-state">No settings available</div>
                    </div>
                </div>
            </div>
        `;

        return panel;
    }

    /**
     * Update mesh details
     */
    updateDetails(data: {
        vertices?: number;
        triangles?: number;
        sizeX?: number;
        sizeY?: number;
        sizeZ?: number;
    }): void {
        if (data.vertices !== undefined) this.vertices = data.vertices;
        if (data.triangles !== undefined) this.triangles = data.triangles;
        if (data.sizeX !== undefined) this.sizeX = data.sizeX;
        if (data.sizeY !== undefined) this.sizeY = data.sizeY;
        if (data.sizeZ !== undefined) this.sizeZ = data.sizeZ;
        
        this.render();
    }

    render(): void {
        const getValue = (value: number) => value > 0 ? value.toLocaleString() : '-';
        const getSize = (value: number) => value > 0 ? value.toFixed(2) : '-';

        this.updateElement('#detail-vertices', getValue(this.vertices));
        this.updateElement('#detail-triangles', getValue(this.triangles));
        this.updateElement('#detail-size-x', getSize(this.sizeX));
        this.updateElement('#detail-size-y', getSize(this.sizeY));
        this.updateElement('#detail-size-z', getSize(this.sizeZ));
    }

    private updateElement(selector: string, value: string): void {
        const el = this.element.querySelector(selector);
        if (el) el.textContent = value;
    }

    private attachEventListeners(): void {
        // Panel collapse button
        const collapseBtn = this.element.querySelector('.panel-collapse-btn');
        collapseBtn?.addEventListener('click', () => this.toggle());

        // Section collapse buttons
        const sectionButtons = this.element.querySelectorAll('.section-collapse-btn');
        sectionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget as HTMLElement;
                const section = button.dataset.section;
                if (section) {
                    this.toggleSection(section as 'details' | 'settings');
                }
            });
        });
    }

    /**
     * Toggle a specific section (Details or Settings)
     */
    private toggleSection(section: 'details' | 'settings'): void {
        const sectionElement = this.element.querySelector(`.${section}-section`);
        if (!sectionElement) return;

        if (section === 'details') {
            this.isDetailsCollapsed = !this.isDetailsCollapsed;
            if (this.isDetailsCollapsed) {
                sectionElement.classList.add('collapsed');
            } else {
                sectionElement.classList.remove('collapsed');
            }
        } else if (section === 'settings') {
            this.isSettingsCollapsed = !this.isSettingsCollapsed;
            if (this.isSettingsCollapsed) {
                sectionElement.classList.add('collapsed');
            } else {
                sectionElement.classList.remove('collapsed');
            }
        }
    }

    /**
     * Toggle panel collapsed state
     */
    toggle(): void {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.element.classList.add('collapsed');
        } else {
            this.element.classList.remove('collapsed');
        }
    }

    /**
     * Check if panel is collapsed
     */
    isCollapsedState(): boolean {
        return this.isCollapsed;
    }

    destroy(): void {
        this.element.remove();
    }
}
