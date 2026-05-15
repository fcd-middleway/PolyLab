import type { UIComponent } from '../types/ui.types';

/**
 * Header component - Top bar with title, project selector, and utility icons
 */
export class Header implements UIComponent {
    element: HTMLElement;
    private projectSelector: HTMLSelectElement | null = null;
    private onProjectChange: ((projectId: string) => void) | null = null;

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
            <div class="header-center">
                <select class="project-selector" id="project-selector">
                    <option value="">Select project...</option>
                </select>
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

        this.projectSelector = header.querySelector('#project-selector');

        return header;
    }

    /**
     * Set available projects in the selector
     * 
     * @param projects - Array of project objects with id, name, and icon
     */
    setProjects(projects: Array<{ id: string; name: string; icon: string }>): void {
        if (!this.projectSelector) return;

        // Clear existing options except the first placeholder
        this.projectSelector.innerHTML = '';

        // Add projects as options
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.icon} ${project.name}`;
            this.projectSelector!.appendChild(option);
        });
    }

    /**
     * Set the active project in the selector
     * 
     * @param projectId - ID of the project to select
     */
    setActiveProject(projectId: string): void {
        if (!this.projectSelector) return;
        this.projectSelector.value = projectId;
    }

    /**
     * Set callback for project change events
     * 
     * @param callback - Function to call when project selection changes
     */
    setOnProjectChange(callback: (projectId: string) => void): void {
        this.onProjectChange = callback;
    }

    private attachEventListeners(): void {
        // Project selector change
        this.projectSelector?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const projectId = target.value;
            if (projectId && this.onProjectChange) {
                this.onProjectChange(projectId);
            }
        });

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
