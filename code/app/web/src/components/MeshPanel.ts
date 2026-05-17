import type { UIComponent, MeshInfo } from '../types/ui.types';

/**
 * Mesh Panel component - Left sidebar showing loaded meshes
 */
export class MeshPanel implements UIComponent {
    element: HTMLElement;
    private meshes: MeshInfo[] = [];
    private visibilityCallback: ((id: string, visible: boolean) => void) | null = null;
    private isCollapsed: boolean = false;

    constructor() {
        this.element = this.createElement();
        this.attachEventListeners();
    }

    private createElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'mesh-panel panel';

        panel.innerHTML = `
            <div class="panel-header">
                <h3>Meshes</h3>
                <button class="panel-collapse-btn" title="Toggle panel">
                    <span class="collapse-icon">▶</span>
                </button>
            </div>
            <div class="panel-content" id="mesh-list">
                <div class="empty-state">
                    No meshes loaded
                </div>
            </div>
            <div class="panel-footer">
                <button class="panel-btn" id="add-mesh-btn">
                    <span class="icon">+</span> Add Mesh
                </button>
            </div>
        `;

        return panel;
    }

    private attachEventListeners(): void {
        this.element.querySelector('#add-mesh-btn')?.addEventListener('click', () => {
            console.log('[MeshPanel] Add mesh button clicked');
        });
        
        const collapseBtn = this.element.querySelector('.panel-collapse-btn');
        collapseBtn?.addEventListener('click', () => this.toggle());
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

    /**
     * Add a mesh to the panel
     */
    addMesh(mesh: MeshInfo): void {
        this.meshes.push(mesh);
        this.render();
    }

    /**
     * Remove a mesh from the panel
     */
    removeMesh(id: string): void {
        const index = this.meshes.findIndex(m => m.id === id);
        if (index !== -1) {
            this.meshes.splice(index, 1);
            this.render();
        }
    }

    /**
     * Clear all meshes
     */
    clearMeshes(): void {
        this.meshes = [];
        this.render();
    }

    /**
     * Set the visibility callback
     * 
     * This callback is called whenever a mesh visibility is toggled.
     */
    setVisibilityCallback(callback: (id: string, visible: boolean) => void): void {
        this.visibilityCallback = callback;
    }

    /**
     * Toggle mesh visibility
     */
    private toggleMesh(id: string): void {
        const mesh = this.meshes.find(m => m.id === id);
        if (mesh) {
            mesh.visible = !mesh.visible;
            console.log(`[MeshPanel] Toggled mesh ${mesh.name}: ${mesh.visible ? 'visible' : 'hidden'}`);
            
            // Call the visibility callback if set
            if (this.visibilityCallback) {
                this.visibilityCallback(id, mesh.visible);
            }
            
            this.render();
        }
    }

    render(): void {
        const meshList = this.element.querySelector('#mesh-list');
        if (!meshList) return;

        if (this.meshes.length === 0) {
            meshList.innerHTML = '<div class="empty-state">No meshes loaded</div>';
            return;
        }

        meshList.innerHTML = this.meshes.map(mesh => `
            <div class="mesh-item" data-id="${mesh.id}">
                <input 
                    type="checkbox" 
                    id="mesh-${mesh.id}" 
                    ${mesh.visible ? 'checked' : ''}
                    data-mesh-id="${mesh.id}"
                />
                <label for="mesh-${mesh.id}" class="mesh-name">${mesh.name}</label>
            </div>
        `).join('');

        // Attach checkbox listeners
        meshList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const meshId = target.dataset.meshId;
                if (meshId) {
                    this.toggleMesh(meshId);
                }
            });
        });
    }

    destroy(): void {
        this.element.remove();
    }
}
