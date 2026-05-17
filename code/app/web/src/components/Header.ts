import type { UIComponent } from '../types/ui.types';
import { HelpOverlay } from './HelpOverlay';

/**
 * Header component - Top bar with title, project selector, and utility icons
 */
export class Header implements UIComponent {
    element: HTMLElement;
    private projectSelector: HTMLSelectElement | null = null;
    private onProjectChange: ((projectId: string) => void) | null = null;
    private themeToggleBtn: HTMLButtonElement | null = null;
    private currentTheme: 'light' | 'dark' = 'dark';
    private helpOverlay: HelpOverlay;

    constructor() {
        this.helpOverlay = new HelpOverlay();
        this.element = this.createElement();
        this.loadTheme();
        this.attachEventListeners();
        
        // Append help overlay to body (it's a modal)
        document.body.appendChild(this.helpOverlay.element);
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
                <button class="icon-btn" id="help-btn" title="Help (Ctrl+H)">
                    <span class="icon">?</span>
                </button>
                <button class="icon-btn" id="github-btn" title="View on GitHub">
                    <span class="icon">↗</span>
                </button>
            </div>
        `;

        this.projectSelector = header.querySelector('#project-selector');
        this.themeToggleBtn = header.querySelector('#theme-toggle');

        return header;
    }

    /**
     * Load theme from localStorage or use default (dark)
     */
    private loadTheme(): void {
        const savedTheme = localStorage.getItem('polylab-theme') as 'light' | 'dark' | null;
        this.currentTheme = savedTheme || 'dark';
        this.applyTheme(this.currentTheme);
    }

    /**
     * Apply theme to the document
     */
    private applyTheme(theme: 'light' | 'dark'): void {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            if (this.themeToggleBtn) {
                this.themeToggleBtn.querySelector('.icon')!.textContent = '☀️';
                this.themeToggleBtn.title = 'Switch to dark theme';
            }
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (this.themeToggleBtn) {
                this.themeToggleBtn.querySelector('.icon')!.textContent = '🌙';
                this.themeToggleBtn.title = 'Switch to light theme';
            }
        }
        this.currentTheme = theme;
    }

    /**
     * Toggle between light and dark theme
     */
    private toggleTheme(): void {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        localStorage.setItem('polylab-theme', newTheme);
        console.log(`[Header] Theme switched to ${newTheme}`);
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
            this.toggleTheme();
        });

        // Help button
        this.element.querySelector('#help-btn')?.addEventListener('click', () => {
            this.helpOverlay.toggle();
        });

        // GitHub button
        this.element.querySelector('#github-btn')?.addEventListener('click', () => {
            window.open('https://github.com/fcd-middleway/PolyLab', '_blank', 'noopener,noreferrer');
        });
    }

    render(): void {
        // Header is static, no need for re-rendering
    }

    destroy(): void {
        this.helpOverlay.destroy();
        this.element.remove();
    }
}
