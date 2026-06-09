import type { UIComponent } from '../types/ui.types';
import { appLogger } from '../utils/logger';

/**
 * CompressionStageParameters - Shows parameters for each pipeline stage
 */
export class CompressionStageParameters implements UIComponent {
    element: HTMLElement;
    private currentStageId: string = 'load';

    constructor() {
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'compression-stage-parameters';
        container.innerHTML = `
            <div id="stage-params-content">
                <!-- Parameters will be injected here -->
            </div>
        `;
        return container;
    }

    /**
     * Show parameters for a specific stage
     */
    showStage(stageId: string): void {
        this.currentStageId = stageId;
        const content = this.element.querySelector('#stage-params-content');
        if (!content) return;

        switch (stageId) {
            case 'load':
                content.innerHTML = this.renderLoadParams();
                break;
            case 'aif':
                content.innerHTML = this.renderAIFParams();
                break;
            case 'preprocess':
                content.innerHTML = this.renderPreprocessParams();
                break;
            case 'simplify':
                content.innerHTML = this.renderSimplifyParams();
                break;
            case 'export':
                content.innerHTML = this.renderExportParams();
                break;
            default:
                content.innerHTML = '<p class="param-empty">Select a stage to view parameters</p>';
        }

        appLogger.debug('Stage parameters updated', { stageId });
    }

    private renderLoadParams(): string {
        return `
            <div class="stage-params-section">
                <h4>📂 Load Mesh</h4>
                <p class="param-description">Load an OBJ file from disk to begin the compression pipeline.</p>
                <div class="param-item">
                    <label>Supported formats:</label>
                    <span class="param-value">OBJ</span>
                </div>
                <div class="param-hint">
                    💡 Use the file toolbar button or drag & drop an OBJ file
                </div>
            </div>
        `;
    }

    private renderAIFParams(): string {
        return `
            <div class="stage-params-section">
                <h4>🔄 Convert to AIF</h4>
                <p class="param-description">Convert mesh to Already-Indexed Format (AIF) for efficient topology operations.</p>
                <div class="param-item">
                    <label>Storage:</label>
                    <span class="param-value">SlotMap (vertices, edges, faces, corners)</span>
                </div>
                <div class="param-hint">
                    💡 AIF enables fast edge collapse and topology queries
                </div>
            </div>
        `;
    }

    private renderPreprocessParams(): string {
        return `
            <div class="stage-params-section">
                <h4>🔍 Pre-process</h4>
                <p class="param-description">Analyze topology, detect manifold properties, validate mesh structure.</p>
                <div class="param-group">
                    <div class="param-item">
                        <label>Topology analysis:</label>
                        <span class="param-value">Manifold detection, boundary detection</span>
                    </div>
                    <div class="param-item">
                        <label>Validation:</label>
                        <span class="param-value">Degenerate faces, isolated vertices, zero-length edges</span>
                    </div>
                </div>
                <div class="param-hint">
                    💡 See thesis for detailed pre-processing steps
                </div>
            </div>
        `;
    }

    private renderSimplifyParams(): string {
        return `
            <div class="stage-params-section">
                <h4>⚡ Simplify</h4>
                <p class="param-description">Progressive mesh simplification via edge collapse.</p>
                <div class="param-group">
                    <div class="param-item">
                        <label for="target-ratio">Target ratio:</label>
                        <input type="range" id="target-ratio" min="0.1" max="1.0" step="0.05" value="0.9" />
                        <span id="target-ratio-value" class="param-value">0.9 (90%)</span>
                    </div>
                    <div class="param-item">
                        <label for="metric-type">Metric:</label>
                        <select id="metric-type" class="param-select">
                            <option value="Random">Random</option>
                            <option value="EdgeLength" selected>Edge Length</option>
                            <option value="QEM">Quadric Error (WIP)</option>
                        </select>
                    </div>
                </div>
                <div class="param-hint">
                    💡 Lower ratio = more aggressive simplification
                </div>
            </div>
        `;
    }

    private renderExportParams(): string {
        return `
            <div class="stage-params-section">
                <h4>💾 Export</h4>
                <p class="param-description">Export simplified mesh to disk.</p>
                <div class="param-item">
                    <label for="export-format">Format:</label>
                    <select id="export-format" class="param-select">
                        <option value="obj" selected>OBJ</option>
                        <option value="compressed" disabled>Compressed (WIP)</option>
                    </select>
                </div>
                <div class="param-hint">
                    💡 Export will download the simplified mesh
                </div>
            </div>
        `;
    }

    /**
     * Get current stage parameters
     */
    getStageParameters(stageId: string): Record<string, any> {
        const params: Record<string, any> = {};

        if (stageId === 'simplify') {
            const ratioInput = this.element.querySelector('#target-ratio') as HTMLInputElement;
            const metricSelect = this.element.querySelector('#metric-type') as HTMLSelectElement;
            
            if (ratioInput) params.targetRatio = parseFloat(ratioInput.value);
            if (metricSelect) params.metric = metricSelect.value;
        }

        if (stageId === 'export') {
            const formatSelect = this.element.querySelector('#export-format') as HTMLSelectElement;
            if (formatSelect) params.format = formatSelect.value;
        }

        return params;
    }

    destroy(): void {
        this.element.remove();
    }
}
