import type { UIComponent } from '../types/ui.types';
import { appLogger } from '../utils/logger';

/**
 * Stage status indicator
 */
export type StageStatus = 'pending' | 'active' | 'completed';

/**
 * Pipeline stage definition
 */
export interface PipelineStage {
    id: string;
    name: string;
    icon: string;
    status: StageStatus;
}

/**
 * TerrainPipelineBanner - Horizontal banner showing terrain generation pipeline
 * Displays above the viewer canvas for better visibility
 */
export class TerrainPipelineBanner implements UIComponent {
    element: HTMLElement;
    private stages: PipelineStage[] = [];
    private selectedStageId: string | null = null;
    private onStageSelectCallback: ((stageId: string) => void) | null = null;
    private onExecuteCallback: (() => void) | null = null;
    private onExecuteAllCallback: (() => void) | null = null;

    constructor() {
        this.element = this.createElement();
        this.initializeDefaultStages();
        this.attachEventListeners();
        this.render();
    }

    /**
     * Initialize default pipeline stages
     */
    private initializeDefaultStages(): void {
        this.stages = [
            { id: 'base', name: 'Base Terrain', icon: '🗺️', status: 'pending' },
            { id: 'noise', name: 'Perlin Noise', icon: '🌊', status: 'pending' },
            { id: 'slope', name: 'Slope Map', icon: '📐', status: 'pending' },
            { id: 'mesh', name: '3D Mesh', icon: '🏔️', status: 'pending' }
        ];
        // Select first stage by default
        this.selectedStageId = 'base';
    }

    private createElement(): HTMLElement {
        const banner = document.createElement('div');
        banner.className = 'terrain-pipeline-banner';
        banner.innerHTML = `
            <div class="pipeline-header">
                <h3>🏗️ Terrain Generation Pipeline</h3>
                <div class="pipeline-actions">
                    <button class="pipeline-btn pipeline-btn-primary" id="execute-stage-btn">
                        <span class="btn-icon">▶️</span>
                        <span class="btn-text">Execute Stage</span>
                    </button>
                    <button class="pipeline-btn pipeline-btn-accent" id="execute-all-btn">
                        <span class="btn-icon">⏭️</span>
                        <span class="btn-text">Run All</span>
                    </button>
                </div>
            </div>
            <div class="pipeline-stages-container" id="stages-container">
                <!-- Stages will be rendered here -->
            </div>
        `;
        return banner;
    }

    private attachEventListeners(): void {
        // Execute stage button
        const executeBtn = this.element.querySelector('#execute-stage-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                if (this.onExecuteCallback) {
                    this.onExecuteCallback();
                }
            });
        }

        // Execute all button
        const executeAllBtn = this.element.querySelector('#execute-all-btn');
        if (executeAllBtn) {
            executeAllBtn.addEventListener('click', () => {
                if (this.onExecuteAllCallback) {
                    this.onExecuteAllCallback();
                }
            });
        }
    }

    /**
     * Render pipeline stages
     */
    render(): void {
        const container = this.element.querySelector('#stages-container');
        if (!container) return;

        const stagesHTML = this.stages.map((stage, index) => {
            const isSelected = stage.id === this.selectedStageId;
            const statusIcon = this.getStatusIcon(stage.status);
            const isLast = index === this.stages.length - 1;

            return `
                <div class="pipeline-stage-wrapper">
                    <button 
                        class="pipeline-stage ${isSelected ? 'selected' : ''} ${stage.status}"
                        data-stage-id="${stage.id}"
                        title="${stage.name}"
                    >
                        <div class="stage-icon">${stage.icon}</div>
                        <div class="stage-name">${stage.name}</div>
                        <div class="stage-status">${statusIcon}</div>
                    </button>
                    ${!isLast ? '<div class="stage-arrow">→</div>' : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = stagesHTML;

        // Attach click handlers to stages
        container.querySelectorAll('.pipeline-stage').forEach(stageEl => {
            stageEl.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const stageId = target.dataset.stageId;
                if (stageId) {
                    this.selectStage(stageId);
                }
            });
        });

        appLogger.debug('Pipeline banner rendered', { stagesCount: this.stages.length });
    }

    /**
     * Get status icon for a stage
     */
    private getStatusIcon(status: StageStatus): string {
        switch (status) {
            case 'completed': return '✓';
            case 'active': return '⏸';
            case 'pending': return '○';
            default: return '○';
        }
    }

    /**
     * Select a stage (for parameter editing)
     */
    selectStage(stageId: string): void {
        this.selectedStageId = stageId;
        this.render();
        
        if (this.onStageSelectCallback) {
            this.onStageSelectCallback(stageId);
        }

        appLogger.debug('Stage selected', { stageId });
    }

    /**
     * Update stage status
     */
    updateStageStatus(stageId: string, status: StageStatus): void {
        const stage = this.stages.find(s => s.id === stageId);
        if (stage) {
            stage.status = status;
            this.render();
        }
    }

    /**
     * Update multiple stages from pipeline status
     */
    updateFromPipelineStatus(status: { current: number; total: number; completed: boolean[] }): void {
        this.stages.forEach((stage, index) => {
            if (status.completed[index]) {
                stage.status = 'completed';
            } else if (index === status.current) {
                stage.status = 'active';
            } else {
                stage.status = 'pending';
            }
        });
        this.render();
    }

    /**
     * Reset all stages to pending
     */
    reset(): void {
        this.stages.forEach(stage => stage.status = 'pending');
        this.selectedStageId = 'base';
        this.render();
    }

    /**
     * Get selected stage ID
     */
    getSelectedStageId(): string | null {
        return this.selectedStageId;
    }

    /**
     * Register callback for stage selection
     */
    onStageSelect(callback: (stageId: string) => void): void {
        this.onStageSelectCallback = callback;
    }

    /**
     * Register callback for execute button
     */
    onExecute(callback: () => void): void {
        this.onExecuteCallback = callback;
    }

    /**
     * Register callback for execute all button
     */
    onExecuteAll(callback: () => void): void {
        this.onExecuteAllCallback = callback;
    }

    destroy(): void {
        this.element.remove();
    }
}
