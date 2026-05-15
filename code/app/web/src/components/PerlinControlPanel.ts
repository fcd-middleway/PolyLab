import type { UIComponent } from '../types/ui.types';
import { appLogger } from '../utils/logger';

/**
 * Terrain generation parameters
 */
export interface TerrainParams {
    seed: number;           // Random seed (0-999999)
    octaves: number;        // Number of noise layers (1-8)
    persistence: number;    // Amplitude decay per octave (0.1-1.0)
    scale: number;          // Noise frequency scale (1-100)
    width: number;          // Terrain width in world units
    depth: number;          // Terrain depth in world units
    widthSegments: number;  // Number of vertices along width
    depthSegments: number;  // Number of vertices along depth
}

/**
 * Perlin Control Panel component - Controls for terrain generation
 */
export class PerlinControlPanel implements UIComponent {
    element: HTMLElement;
    private params: TerrainParams;
    private onGenerate: ((params: TerrainParams) => void) | null = null;

    constructor(initialParams: TerrainParams) {
        this.params = { ...initialParams };
        this.element = this.createElement();
        this.attachEventListeners();
        this.updateDisplay();
    }

    private createElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'perlin-control-panel panel';

        panel.innerHTML = `
            <div class="panel-header">
                <h3>🏔️ Terrain Controls</h3>
            </div>
            <div class="panel-content">
                <!-- Seed -->
                <div class="control-group">
                    <label class="control-label">Seed</label>
                    <div class="control-row">
                        <input type="number" id="terrain-seed" class="control-input" min="0" max="999999" />
                        <button id="terrain-random-seed" class="btn-small" title="Random seed">🎲</button>
                    </div>
                </div>

                <!-- Octaves -->
                <div class="control-group">
                    <label class="control-label">
                        Octaves: <span id="terrain-octaves-value">4</span>
                    </label>
                    <input type="range" id="terrain-octaves" class="control-slider" min="1" max="8" step="1" />
                    <span class="control-hint">Noise layers (more = more detail)</span>
                </div>

                <!-- Persistence -->
                <div class="control-group">
                    <label class="control-label">
                        Persistence: <span id="terrain-persistence-value">0.5</span>
                    </label>
                    <input type="range" id="terrain-persistence" class="control-slider" min="0.1" max="1.0" step="0.05" />
                    <span class="control-hint">Amplitude decay (lower = smoother)</span>
                </div>

                <!-- Scale -->
                <div class="control-group">
                    <label class="control-label">
                        Scale: <span id="terrain-scale-value">20.0</span>
                    </label>
                    <input type="range" id="terrain-scale" class="control-slider" min="1" max="100" step="1" />
                    <span class="control-hint">Noise frequency (higher = zoomed out)</span>
                </div>

                <!-- Dimensions -->
                <div class="control-group">
                    <label class="control-label">Dimensions</label>
                    <div class="control-row">
                        <div class="control-col">
                            <label class="control-sublabel">Width</label>
                            <input type="number" id="terrain-width" class="control-input" min="1" max="200" step="1" />
                        </div>
                        <div class="control-col">
                            <label class="control-sublabel">Depth</label>
                            <input type="number" id="terrain-depth" class="control-input" min="1" max="200" step="1" />
                        </div>
                    </div>
                </div>

                <!-- Resolution -->
                <div class="control-group">
                    <label class="control-label">Resolution (segments)</label>
                    <div class="control-row">
                        <div class="control-col">
                            <label class="control-sublabel">Width</label>
                            <input type="number" id="terrain-width-segments" class="control-input" min="2" max="200" step="1" />
                        </div>
                        <div class="control-col">
                            <label class="control-sublabel">Depth</label>
                            <input type="number" id="terrain-depth-segments" class="control-input" min="2" max="200" step="1" />
                        </div>
                    </div>
                    <span class="control-hint">More segments = higher quality (slower)</span>
                </div>

                <!-- Generate Button -->
                <div class="control-group">
                    <button id="terrain-generate" class="btn-primary">Generate Terrain</button>
                </div>
            </div>
        `;

        return panel;
    }

    private attachEventListeners(): void {
        // Seed
        const seedInput = this.element.querySelector('#terrain-seed') as HTMLInputElement;
        seedInput?.addEventListener('change', () => {
            this.params.seed = parseInt(seedInput.value) || 0;
        });

        const randomSeedBtn = this.element.querySelector('#terrain-random-seed');
        randomSeedBtn?.addEventListener('click', () => {
            this.params.seed = Date.now() % 1000000;
            this.updateDisplay();
        });

        // Octaves
        const octavesSlider = this.element.querySelector('#terrain-octaves') as HTMLInputElement;
        octavesSlider?.addEventListener('input', () => {
            this.params.octaves = parseInt(octavesSlider.value);
            this.updateSliderValue('#terrain-octaves-value', this.params.octaves.toString());
        });

        // Persistence
        const persistenceSlider = this.element.querySelector('#terrain-persistence') as HTMLInputElement;
        persistenceSlider?.addEventListener('input', () => {
            this.params.persistence = parseFloat(persistenceSlider.value);
            this.updateSliderValue('#terrain-persistence-value', this.params.persistence.toFixed(2));
        });

        // Scale
        const scaleSlider = this.element.querySelector('#terrain-scale') as HTMLInputElement;
        scaleSlider?.addEventListener('input', () => {
            this.params.scale = parseFloat(scaleSlider.value);
            this.updateSliderValue('#terrain-scale-value', this.params.scale.toFixed(1));
        });

        // Width
        const widthInput = this.element.querySelector('#terrain-width') as HTMLInputElement;
        widthInput?.addEventListener('change', () => {
            this.params.width = parseFloat(widthInput.value) || 20.0;
        });

        // Depth
        const depthInput = this.element.querySelector('#terrain-depth') as HTMLInputElement;
        depthInput?.addEventListener('change', () => {
            this.params.depth = parseFloat(depthInput.value) || 20.0;
        });

        // Width segments
        const widthSegmentsInput = this.element.querySelector('#terrain-width-segments') as HTMLInputElement;
        widthSegmentsInput?.addEventListener('change', () => {
            this.params.widthSegments = parseInt(widthSegmentsInput.value) || 50;
        });

        // Depth segments
        const depthSegmentsInput = this.element.querySelector('#terrain-depth-segments') as HTMLInputElement;
        depthSegmentsInput?.addEventListener('change', () => {
            this.params.depthSegments = parseInt(depthSegmentsInput.value) || 50;
        });

        // Generate button
        const generateBtn = this.element.querySelector('#terrain-generate');
        generateBtn?.addEventListener('click', () => {
            if (this.onGenerate) {
                appLogger.info('Generating terrain with params:', this.params);
                this.onGenerate(this.params);
            }
        });
    }

    private updateSliderValue(selector: string, value: string): void {
        const el = this.element.querySelector(selector);
        if (el) el.textContent = value;
    }

    private updateDisplay(): void {
        // Update all input values
        (this.element.querySelector('#terrain-seed') as HTMLInputElement).value = this.params.seed.toString();
        (this.element.querySelector('#terrain-octaves') as HTMLInputElement).value = this.params.octaves.toString();
        (this.element.querySelector('#terrain-persistence') as HTMLInputElement).value = this.params.persistence.toString();
        (this.element.querySelector('#terrain-scale') as HTMLInputElement).value = this.params.scale.toString();
        (this.element.querySelector('#terrain-width') as HTMLInputElement).value = this.params.width.toString();
        (this.element.querySelector('#terrain-depth') as HTMLInputElement).value = this.params.depth.toString();
        (this.element.querySelector('#terrain-width-segments') as HTMLInputElement).value = this.params.widthSegments.toString();
        (this.element.querySelector('#terrain-depth-segments') as HTMLInputElement).value = this.params.depthSegments.toString();

        // Update slider labels
        this.updateSliderValue('#terrain-octaves-value', this.params.octaves.toString());
        this.updateSliderValue('#terrain-persistence-value', this.params.persistence.toFixed(2));
        this.updateSliderValue('#terrain-scale-value', this.params.scale.toFixed(1));
    }

    /**
     * Set callback for terrain generation
     */
    setGenerateCallback(callback: (params: TerrainParams) => void): void {
        this.onGenerate = callback;
    }

    /**
     * Get current parameters
     */
    getParams(): TerrainParams {
        return { ...this.params };
    }

    /**
     * Update parameters programmatically
     */
    setParams(params: Partial<TerrainParams>): void {
        this.params = { ...this.params, ...params };
        this.updateDisplay();
    }

    render(): void {
        // Component renders on creation and updates via event listeners
    }

    destroy(): void {
        this.element.remove();
    }
}
