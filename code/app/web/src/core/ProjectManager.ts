/**
 * Project Manager
 * 
 * Orchestrates project lifecycle: registration, switching, updates.
 * Manages the currently active project and coordinates with UIManager.
 */

import { BaseProject } from './BaseProject';
import { appLogger } from '../utils/logger';

export class ProjectManager {
    private projects: Map<string, BaseProject> = new Map();
    private currentProject: BaseProject | null = null;
    private viewer: any; // ViewerHandle from WASM
    private onProjectChange?: (projectId: string) => void;

    /**
     * Create a new ProjectManager
     * 
     * @param viewer - The WebGPU viewer instance
     */
    constructor(viewer: any) {
        this.viewer = viewer;
        appLogger.info('ProjectManager initialized');
    }

    /**
     * Register a project
     * 
     * @param project - Project instance to register
     */
    registerProject(project: BaseProject): void {
        const id = project.getId();
        
        if (this.projects.has(id)) {
            appLogger.warn(`Project '${id}' already registered, replacing...`);
        }

        this.projects.set(id, project);
        appLogger.info(`Project registered: ${project.getName()} (${id})`);
    }

    /**
     * Get all registered projects
     */
    getProjects(): BaseProject[] {
        return Array.from(this.projects.values());
    }

    /**
     * Get currently active project
     */
    getCurrentProject(): BaseProject | null {
        return this.currentProject;
    }

    /**
     * Set callback for project changes
     * Used to notify UI when project switches
     */
    setOnProjectChange(callback: (projectId: string) => void): void {
        this.onProjectChange = callback;
    }

    /**
     * Switch to a different project
     * 
     * @param projectId - ID of the project to switch to
     */
    async switchToProject(projectId: string): Promise<void> {
        const project = this.projects.get(projectId);
        
        if (!project) {
            appLogger.error(`Cannot switch to unknown project: ${projectId}`);
            throw new Error(`Unknown project: ${projectId}`);
        }

        // Skip if already active
        if (this.currentProject === project) {
            appLogger.debug(`Project '${projectId}' already active`);
            return;
        }

        appLogger.info(`Switching to project: ${project.getName()} (${projectId})`);

        // Deactivate current project
        if (this.currentProject) {
            appLogger.debug(`Deactivating project: ${this.currentProject.getId()}`);
            this.currentProject.setActive(false);
            this.currentProject.onDeactivate?.();
            this.currentProject.cleanup();
        }

        // Activate new project
        try {
            await project.init(this.viewer);
            project.setActive(true);
            project.onActivate?.();
            this.currentProject = project;
            
            appLogger.info(`Project activated: ${project.getName()}`);

            // Notify UI
            this.onProjectChange?.(projectId);
        } catch (error) {
            appLogger.error(`Failed to switch to project '${projectId}'`, { error });
            throw error;
        }
    }

    /**
     * Update current project
     * Called every frame from animation loop
     * 
     * @param deltaTime - Time elapsed since last frame (seconds)
     */
    update(deltaTime: number): void {
        if (this.currentProject && this.currentProject.isActive()) {
            this.currentProject.update(deltaTime);
        }
    }

    /**
     * Cleanup all projects
     * Called on app shutdown
     */
    cleanup(): void {
        appLogger.info('Cleaning up ProjectManager...');
        
        if (this.currentProject) {
            this.currentProject.cleanup();
        }

        this.projects.clear();
        this.currentProject = null;
    }
}
