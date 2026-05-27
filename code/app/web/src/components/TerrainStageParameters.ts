import type { UIComponent } from '../types/ui.types';
import { appLogger } from '../utils/logger';

/**
 * Parameter definition
 */
export interface StageParameter {
    id: string;
    label: string;
    type: 'number' | 'slider' | 'toggle' | 'select';
    value: number | boolean | string;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ value: string; label: string }>;
}

/**
 * Stage configuration with parameters
 */
export interface StageConfig {
    id: string;
    name: string;
    icon: string;
    description: string;
    parameters: StageParameter[];
}

/**
 * TerrainStageParameters - Displays parameters for selected pipeline stage
 * Rendered in the PropertiesPanel
 */
export class TerrainStageParameters implements UIComponent {
    element: HTMLElement;
    private currentStageId: string | null = null;
    private stageConfigs: Map<string, StageConfig> = new Map();
    private onParameterChangeCallback: ((stageId: string, params: Record<string, any>) => void) | null = null;

    constructor() {
        this.element = this.createElement();
        this.initializeStageConfigs();
    }

    /**
     * Initialize parameter configurations for each stage
     */
    private initializeStageConfigs(): void {
        // Base Terrain Stage
        this.stageConfigs.set('base', {
            id: 'base',
            name: 'Base Terrain',
            icon: '🗺️',
            description: 'Create a flat heightmap as the foundation for terrain generation.',
            parameters: [
                {
                    id: 'size',
                    label: 'Grid Size',
                    type: 'select',
                    value: '256',
                    options: [
                        { value: '64', label: '64×64 (Fast)' },
                        { value: '128', label: '128×128' },
                        { value: '256', label: '256×256 (Default)' },
                        { value: '512', label: '512×512 (Detailed)' },
                        { value: '1024', label: '1024×1024 (Very Detailed)' }
                    ]
                },
                {
                    id: 'resolution',
                    label: 'Resolution (m)',
                    type: 'slider',
                    value: 1.0,
                    min: 0.1,
                    max: 5.0,
                    step: 0.1
                },
                {
                    id: 'seed',
                    label: 'Random Seed',
                    type: 'number',
                    value: 12345,
                    min: 0,
                    max: 999999
                }
            ]
        });

        // Perlin Noise Stage
        this.stageConfigs.set('noise', {
            id: 'noise',
            name: 'Perlin Noise',
            icon: '🌊',
            description: 'Apply Perlin noise to create natural height variations.',
            parameters: [
                {
                    id: 'frequency',
                    label: 'Frequency',
                    type: 'slider',
                    value: 0.05,
                    min: 0.01,
                    max: 0.2,
                    step: 0.01
                },
                {
                    id: 'octaves',
                    label: 'Octaves',
                    type: 'slider',
                    value: 6,
                    min: 1,
                    max: 10,
                    step: 1
                },
                {
                    id: 'persistence',
                    label: 'Persistence',
                    type: 'slider',
                    value: 0.5,
                    min: 0.1,
                    max: 1.0,
                    step: 0.05
                },
                {
                    id: 'lacunarity',
                    label: 'Lacunarity',
                    type: 'slider',
                    value: 2.0,
                    min: 1.5,
                    max: 3.5,
                    step: 0.1
                },
                {
                    id: 'heightScale',
                    label: 'Height Scale',
                    type: 'slider',
                    value: 10.0,
                    min: 1.0,
                    max: 50.0,
                    step: 1.0
                }
            ]
        });

        // Slope Stage
        this.stageConfigs.set('slope', {
            id: 'slope',
            name: 'Slope Map',
            icon: '📐',
            description: 'Calculate terrain steepness for each cell.',
            parameters: [
                // Slope calculation has no user-configurable parameters
            ]
        });

        // Mesh Stage
        this.stageConfigs.set('mesh', {
            id: 'mesh',
            name: '3D Mesh',
            icon: '🏔️',
            description: 'Build 3D geometry from heightmap and render in viewer.',
            parameters: [
                {
                    id: 'applyColor',
                    label: 'Apply Height-Based Colors',
                    type: 'toggle',
                    value: true
                },
                {
                    id: 'calculateNormals',
                    label: 'Calculate Normals',
                    type: 'toggle',
                    value: true
                }
            ]
        });
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'terrain-stage-parameters';
        container.innerHTML = `
            <div class="stage-params-empty">
                <p>Select a stage to configure its parameters</p>
            </div>
        `;
        return container;
    }

    /**
     * Show parameters for a specific stage
     */
    showStage(stageId: string): void {
        this.currentStageId = stageId;
        const config = this.stageConfigs.get(stageId);
        
        if (!config) {
            appLogger.warn('Unknown stage ID', { stageId });
            return;
        }

        this.render(config);
        appLogger.debug('Stage parameters displayed', { stageId });
    }

    /**
     * Render stage parameters
     */
    private render(config: StageConfig): void {
        const hasParams = config.parameters.length > 0;

        this.element.innerHTML = `
            <div class="stage-params-header">
                <div class="stage-icon-large">${config.icon}</div>
                <div class="stage-title-section">
                    <h3>${config.name}</h3>
                    <p class="stage-description">${config.description}</p>
                </div>
            </div>
            ${hasParams ? `
                <div class="stage-params-list">
                    ${config.parameters.map(param => this.renderParameter(param)).join('')}
                </div>
            ` : `
                <div class="stage-params-info">
                    <p>✅ This stage has no configurable parameters</p>
                </div>
            `}
        `;

        // Attach parameter change listeners
        if (hasParams) {
            this.attachParameterListeners();
        }
    }

    /**
     * Render a single parameter control
     */
    private renderParameter(param: StageParameter): string {
        switch (param.type) {
            case 'slider':
                return `
                    <div class="param-row">
                        <label class="param-label">${param.label}</label>
                        <div class="param-control">
                            <input 
                                type="range" 
                                class="param-slider" 
                                data-param-id="${param.id}"
                                min="${param.min}"
                                max="${param.max}"
                                step="${param.step}"
                                value="${param.value}"
                            />
                            <span class="param-value">${param.value}</span>
                        </div>
                    </div>
                `;
            
            case 'number':
                return `
                    <div class="param-row">
                        <label class="param-label">${param.label}</label>
                        <div class="param-control">
                            <input 
                                type="number" 
                                class="param-number" 
                                data-param-id="${param.id}"
                                min="${param.min}"
                                max="${param.max}"
                                value="${param.value}"
                            />
                        </div>
                    </div>
                `;
            
            case 'toggle':
                return `
                    <div class="param-row">
                        <label class="param-label">${param.label}</label>
                        <div class="param-control">
                            <label class="param-toggle">
                                <input 
                                    type="checkbox" 
                                    data-param-id="${param.id}"
                                    ${param.value ? 'checked' : ''}
                                />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                `;
            
            case 'select':
                const options = param.options || [];
                return `
                    <div class="param-row">
                        <label class="param-label">${param.label}</label>
                        <div class="param-control">
                            <select class="param-select" data-param-id="${param.id}">
                                ${options.map(opt => `
                                    <option value="${opt.value}" ${opt.value === param.value ? 'selected' : ''}>
                                        ${opt.label}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                `;
            
            default:
                return '';
        }
    }

    /**
     * Attach listeners to parameter inputs
     */
    private attachParameterListeners(): void {
        // Sliders
        this.element.querySelectorAll('.param-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const value = parseFloat(target.value);
                const valueSpan = target.nextElementSibling as HTMLSpanElement;
                if (valueSpan) {
                    valueSpan.textContent = value.toFixed(2);
                }
                this.updateParameter(target.dataset.paramId!, value);
            });
        });

        // Number inputs
        this.element.querySelectorAll('.param-number').forEach(input => {
            input.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = parseInt(target.value);
                this.updateParameter(target.dataset.paramId!, value);
            });
        });

        // Toggles
        this.element.querySelectorAll('.param-toggle input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                this.updateParameter(target.dataset.paramId!, target.checked);
            });
        });

        // Selects
        this.element.querySelectorAll('.param-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                this.updateParameter(target.dataset.paramId!, target.value);
            });
        });
    }

    /**
     * Update parameter value and notify callback
     */
    private updateParameter(paramId: string, value: any): void {
        if (!this.currentStageId) return;

        const config = this.stageConfigs.get(this.currentStageId);
        if (!config) return;

        const param = config.parameters.find(p => p.id === paramId);
        if (param) {
            param.value = value;
            appLogger.debug('Parameter updated', { stageId: this.currentStageId, paramId, value });
            
            // Notify callback
            if (this.onParameterChangeCallback) {
                this.onParameterChangeCallback(this.currentStageId, this.getStageParameters(this.currentStageId));
            }
        }
    }

    /**
     * Get current parameters for a stage
     */
    getStageParameters(stageId: string): Record<string, any> {
        const config = this.stageConfigs.get(stageId);
        if (!config) return {};

        const params: Record<string, any> = {};
        config.parameters.forEach(param => {
            params[param.id] = param.value;
        });
        return params;
    }

    /**
     * Register callback for parameter changes
     */
    onParameterChange(callback: (stageId: string, params: Record<string, any>) => void): void {
        this.onParameterChangeCallback = callback;
    }

    destroy(): void {
        this.element.remove();
    }
}
