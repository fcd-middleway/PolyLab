import type { UIComponent } from '../types/ui.types';
import { appLogger } from '../utils/logger';

/**
 * Stage status indicator
 */
export type StageStatus = 'pending' | 'active' | 'completed' | 'failed';

/**
 * Pipeline stage definition for compression
 */
export interface CompressionStage {
    id: string;
    name: string;
    icon: string;
    status: StageStatus;
    description: string;
}

/**
 * Batch test result for a single mesh
 */
export interface BatchTestResult {
    meshName: string;
    success: boolean;
    failedStage?: string;
    error?: string;
    stats?: {
        vertices: number;
        faces: number;
        edges: number;
    };
}

/**
 * CompressionPipelineBanner - Pipeline for mesh compression workflow
 * Displays stages: Load → AIF → Pre-process → Simplify → Export
 */
export class CompressionPipelineBanner implements UIComponent {
    element: HTMLElement;
    private stages: CompressionStage[] = [];
    private selectedStageId: string | null = null;
    private batchMode: boolean = false;
    private batchResults: BatchTestResult[] = [];
    
    // Callbacks
    private onStageSelectCallback: ((stageId: string) => void) | null = null;
    private onExecuteCallback: (() => void) | null = null;
    private onExecuteAllCallback: (() => void) | null = null;
    private onBatchTestCallback: ((targetStage: string) => void) | null = null;

    constructor() {
        this.element = this.createElement();
        this.initializeStages();
        this.attachEventListeners();
        this.render();
    }

    /**
     * Initialize compression pipeline stages
     */
    private initializeStages(): void {
        this.stages = [
            { 
                id: 'load', 
                name: 'Load Mesh', 
                icon: '📂', 
                status: 'pending',
                description: 'Load OBJ file from disk'
            },
            { 
                id: 'aif', 
                name: 'Convert AIF', 
                icon: '🔄', 
                status: 'pending',
                description: 'Convert mesh to AIF data structure'
            },
            { 
                id: 'preprocess', 
                name: 'Pre-process', 
                icon: '🔍', 
                status: 'pending',
                description: 'Topology analysis, manifold detection, validation'
            },
            { 
                id: 'simplify', 
                name: 'Simplify', 
                icon: '⚡', 
                status: 'pending',
                description: 'Progressive edge collapse simplification'
            },
            { 
                id: 'export', 
                name: 'Export', 
                icon: '💾', 
                status: 'pending',
                description: 'Export simplified mesh (OBJ/compressed)'
            }
        ];
        // Select first stage by default
        this.selectedStageId = 'load';
    }

    private createElement(): HTMLElement {
        const banner = document.createElement('div');
        banner.className = 'compression-pipeline-banner';
        banner.innerHTML = `
            <div class="pipeline-header">
                <h3>🔧 Mesh Compression Pipeline</h3>
                <div class="pipeline-mode-selector">
                    <button class="mode-btn active" id="mode-manual">
                        <span class="btn-icon">👤</span>
                        <span class="btn-text">Manual</span>
                    </button>
                    <button class="mode-btn" id="mode-batch">
                        <span class="btn-icon">📦</span>
                        <span class="btn-text">Batch Test</span>
                    </button>
                </div>
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
            <div class="pipeline-batch-section" id="batch-section" style="display: none;">
                <div class="batch-controls">
                    <label for="target-stage-select">Run until stage:</label>
                    <select id="target-stage-select" class="batch-select">
                        ${this.stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                    <button class="batch-btn" id="batch-test-btn">
                        <span class="btn-icon">🧪</span>
                        <span class="btn-text">Run Batch Test</span>
                    </button>
                </div>
                <div class="batch-results" id="batch-results">
                    <!-- Results will appear here -->
                </div>
            </div>
        `;
        return banner;
    }

    private attachEventListeners(): void {
        // Mode selector
        const manualBtn = this.element.querySelector('#mode-manual');
        const batchBtn = this.element.querySelector('#mode-batch');
        const batchSection = this.element.querySelector('#batch-section');
        
        manualBtn?.addEventListener('click', () => {
            this.batchMode = false;
            manualBtn.classList.add('active');
            batchBtn?.classList.remove('active');
            if (batchSection) batchSection.setAttribute('style', 'display: none;');
        });
        
        batchBtn?.addEventListener('click', () => {
            this.batchMode = true;
            batchBtn.classList.add('active');
            manualBtn?.classList.remove('active');
            if (batchSection) batchSection.setAttribute('style', 'display: block;');
        });
        
        // Execute stage button
        const executeBtn = this.element.querySelector('#execute-stage-btn');
        executeBtn?.addEventListener('click', () => {
            if (this.onExecuteCallback) {
                this.onExecuteCallback();
            }
        });

        // Execute all button
        const executeAllBtn = this.element.querySelector('#execute-all-btn');
        executeAllBtn?.addEventListener('click', () => {
            if (this.onExecuteAllCallback) {
                this.onExecuteAllCallback();
            }
        });
        
        // Batch test button
        const batchTestBtn = this.element.querySelector('#batch-test-btn');
        batchTestBtn?.addEventListener('click', () => {
            const targetStageSelect = this.element.querySelector('#target-stage-select') as HTMLSelectElement;
            const targetStage = targetStageSelect?.value || 'simplify';
            if (this.onBatchTestCallback) {
                this.onBatchTestCallback(targetStage);
            }
        });
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
                        title="${stage.description}"
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

        appLogger.debug('Compression pipeline rendered', { stagesCount: this.stages.length });
    }

    /**
     * Get status icon for a stage
     */
    private getStatusIcon(status: StageStatus): string {
        switch (status) {
            case 'completed': return '✓';
            case 'active': return '⏸';
            case 'failed': return '✗';
            case 'pending': return '○';
            default: return '○';
        }
    }

    /**
     * Select a stage
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
     * Reset all stages to pending
     */
    reset(): void {
        this.stages.forEach(stage => stage.status = 'pending');
        this.selectedStageId = 'load';
        this.batchResults = [];
        this.render();
        this.renderBatchResults();
    }

    /**
     * Display batch test results
     */
    displayBatchResults(results: BatchTestResult[]): void {
        this.batchResults = results;
        this.renderBatchResults();
    }

    private renderBatchResults(): void {
        const resultsContainer = this.element.querySelector('#batch-results');
        if (!resultsContainer) return;

        if (this.batchResults.length === 0) {
            resultsContainer.innerHTML = '<p class="batch-empty">No batch tests run yet</p>';
            return;
        }

        const successCount = this.batchResults.filter(r => r.success).length;
        const failCount = this.batchResults.length - successCount;

        const resultsHTML = `
            <div class="batch-summary">
                <h4>Batch Test Results</h4>
                <div class="batch-stats">
                    <span class="stat success">✓ ${successCount} passed</span>
                    <span class="stat failed">✗ ${failCount} failed</span>
                    <span class="stat total">Total: ${this.batchResults.length}</span>
                </div>
            </div>
            <div class="batch-results-list">
                ${this.batchResults.map(result => `
                    <div class="batch-result-item ${result.success ? 'success' : 'failed'}">
                        <div class="result-header">
                            <span class="result-icon">${result.success ? '✓' : '✗'}</span>
                            <span class="result-name">${result.meshName}</span>
                            ${!result.success ? `<span class="result-stage">Failed at: ${result.failedStage}</span>` : ''}
                        </div>
                        ${result.stats ? `
                            <div class="result-stats">
                                ${result.stats.vertices} vertices, ${result.stats.faces} faces, ${result.stats.edges} edges
                            </div>
                        ` : ''}
                        ${result.error ? `
                            <div class="result-error">${result.error}</div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        resultsContainer.innerHTML = resultsHTML;
    }

    /**
     * Get selected stage ID
     */
    getSelectedStageId(): string | null {
        return this.selectedStageId;
    }

    /**
     * Check if in batch mode
     */
    isBatchMode(): boolean {
        return this.batchMode;
    }

    /**
     * Register callbacks
     */
    onStageSelect(callback: (stageId: string) => void): void {
        this.onStageSelectCallback = callback;
    }

    onExecute(callback: () => void): void {
        this.onExecuteCallback = callback;
    }

    onExecuteAll(callback: () => void): void {
        this.onExecuteAllCallback = callback;
    }

    onBatchTest(callback: (targetStage: string) => void): void {
        this.onBatchTestCallback = callback;
    }

    destroy(): void {
        this.element.remove();
    }
}
