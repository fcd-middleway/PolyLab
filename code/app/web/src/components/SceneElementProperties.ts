/**
 * Scene Element Properties Component
 * 
 * Displays and allows editing of properties for selected scene elements
 * (meshes, cameras, lights) in the Properties Panel.
 */

import type { UIComponent } from '../types/ui.types';
import type { SceneNode } from '../types/scene.types';

export interface SceneElementCallbacks {
    onRename?: (nodeId: string, newName: string) => void;
    onToggleVisibility?: (nodeId: string, visible: boolean) => void;
    onRemove?: (nodeId: string) => void;
    onSave?: (nodeId: string) => void;
    // Camera-specific callbacks
    onUpdateCameraPosition?: (nodeId: string, position: [number, number, number]) => void;
    onUpdateCameraTarget?: (nodeId: string, target: [number, number, number]) => void;
    onUpdateCameraFov?: (nodeId: string, fov: number) => void;
    onResetCamera?: (nodeId: string) => void;
    // Light-specific callbacks
    onUpdateLightDirection?: (nodeId: string, direction: [number, number, number]) => void;
    onUpdateLightColor?: (nodeId: string, color: [number, number, number]) => void;
    onUpdateLightIntensity?: (nodeId: string, intensity: number) => void;
    onResetLight?: (nodeId: string) => void;
    // Ambient Light-specific callbacks
    onUpdateAmbientColor?: (nodeId: string, color: [number, number, number]) => void;
    onUpdateAmbientIntensity?: (nodeId: string, intensity: number) => void;
    onResetAmbient?: (nodeId: string) => void;
}

export class SceneElementProperties implements UIComponent {
    element: HTMLElement;
    private currentNode: SceneNode | null = null;
    private callbacks: SceneElementCallbacks = {};

    constructor() {
        this.element = this.createElement();
    }

    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'scene-element-properties';
        return container;
    }

    /**
     * Set callbacks for property changes and actions
     */
    setCallbacks(callbacks: SceneElementCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Display properties for a selected scene element
     */
    showElement(node: SceneNode): void {
        this.currentNode = node;
        this.render();
    }

    /**
     * Clear displayed properties
     */
    clear(): void {
        this.currentNode = null;
        this.render();
    }

    /**
     * Validate and clamp numeric input value
     */
    private validateNumber(value: number, min: number = -Infinity, max: number = Infinity): number {
        if (isNaN(value) || !isFinite(value)) {
            return Math.max(min, Math.min(max, 0));
        }
        return Math.max(min, Math.min(max, value));
    }

    render(): void {
        if (!this.currentNode) {
            this.element.innerHTML = '<div class="empty-state">No element selected</div>';
            return;
        }

        const node = this.currentNode;
        
        // Build HTML based on element type
        let html = `
            <div class="property-section">
                <div class="property-group">
                    <div class="property-header">
                        <span class="property-icon">${node.icon}</span>
                        <span class="property-type">${this.getTypeLabel(node.type)}</span>
                    </div>
                </div>

                <div class="property-group">
                    <label class="property-label">Name</label>
                    <input 
                        type="text" 
                        class="property-input" 
                        value="${node.name}" 
                        data-action="rename"
                        placeholder="Enter name"
                    />
                </div>
        `;

        // Add type-specific properties
        if (node.type === 'mesh') {
            html += this.renderMeshProperties(node);
        } else if (node.type === 'camera' && node.metadata) {
            html += this.renderCameraProperties(node);
        } else if (node.type === 'light' && node.metadata) {
            // Differentiate between directional and ambient lights
            if (node.metadata.lightType === 'ambient') {
                html += this.renderAmbientLightProperties(node);
            } else {
                html += this.renderLightProperties(node);
            }
        } else if (node.type === 'root') {
            html += this.renderRootProperties(node);
        }

        html += '</div>'; // Close property-section

        this.element.innerHTML = html;
        this.attachEventListeners();
    }

    private renderMeshProperties(node: SceneNode): string {
        const meta = node.metadata || {};
        return `
            <div class="property-group">
                <label class="property-label">Visibility</label>
                <div class="property-toggle">
                    <label class="toggle-switch">
                        <input 
                            type="checkbox" 
                            ${node.visible ? 'checked' : ''} 
                            data-action="toggle-visibility"
                        />
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">${node.visible ? 'Visible' : 'Hidden'}</span>
                </div>
            </div>

            ${meta.vertices !== undefined ? `
            <div class="property-group">
                <label class="property-label">Vertices</label>
                <div class="property-value property-readonly">${meta.vertices.toLocaleString()}</div>
            </div>
            ` : ''}

            ${meta.triangles !== undefined ? `
            <div class="property-group">
                <label class="property-label">Triangles</label>
                <div class="property-value property-readonly">${meta.triangles.toLocaleString()}</div>
            </div>
            ` : ''}

            ${meta.sizeX !== undefined && meta.sizeY !== undefined && meta.sizeZ !== undefined ? `
            <div class="property-group">
                <label class="property-label">Dimensions</label>
                <div class="property-value property-readonly">
                    ${meta.sizeX.toFixed(2)} × ${meta.sizeY.toFixed(2)} × ${meta.sizeZ.toFixed(2)}
                </div>
            </div>
            ` : ''}

            <div class="property-actions">
                <button class="property-btn property-btn-danger" data-action="remove">
                    <span class="btn-icon">🗑️</span>
                    Remove
                </button>
                <button class="property-btn property-btn-primary" data-action="save">
                    <span class="btn-icon">💾</span>
                    Save
                </button>
            </div>
        `;
    }

    private renderCameraProperties(node: SceneNode): string {
        const meta = node.metadata || {};
        const position = meta.position || [0, 0, 0];
        const target = meta.target || [0, 0, 0];
        const fov = meta.fov !== undefined ? meta.fov : 45;

        return `
            <div class="property-group">
                <label class="property-label">Position</label>
                <div class="property-vector3">
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${position[0].toFixed(2)}" 
                        step="0.1"
                        data-action="update-camera-position"
                        data-axis="0"
                        placeholder="X"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${position[1].toFixed(2)}" 
                        step="0.1"
                        data-action="update-camera-position"
                        data-axis="1"
                        placeholder="Y"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${position[2].toFixed(2)}" 
                        step="0.1"
                        data-action="update-camera-position"
                        data-axis="2"
                        placeholder="Z"
                    />
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Target</label>
                <div class="property-vector3">
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${target[0].toFixed(2)}" 
                        step="0.1"
                        data-action="update-camera-target"
                        data-axis="0"
                        placeholder="X"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${target[1].toFixed(2)}" 
                        step="0.1"
                        data-action="update-camera-target"
                        data-axis="1"
                        placeholder="Y"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${target[2].toFixed(2)}" 
                        step="0.1"
                        data-action="update-camera-target"
                        data-axis="2"
                        placeholder="Z"
                    />
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Field of View</label>
                <div class="property-slider">
                    <input 
                        type="range" 
                        class="property-range" 
                        min="10" 
                        max="120" 
                        step="1"
                        value="${fov}"
                        data-action="update-camera-fov"
                    />
                    <span class="property-slider-value">${fov}°</span>
                </div>
            </div>

            <div class="property-actions">
                <button class="property-btn property-btn-secondary" data-action="reset-camera">
                    <span class="btn-icon">🔄</span>
                    Reset
                </button>
            </div>
        `;
    }

    private renderLightProperties(node: SceneNode): string {
        const meta = node.metadata!;
        const direction = meta.direction || [0, -1, 0];
        const color = meta.color || [1.0, 1.0, 1.0];
        const intensity = meta.intensity !== undefined ? meta.intensity : 1.0;
        
        return `
            <div class="property-group">
                <label class="property-label">Direction</label>
                <div class="property-vector3">
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${direction[0].toFixed(2)}" 
                        step="0.1"
                        data-action="update-light-direction"
                        data-axis="0"
                        placeholder="X"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${direction[1].toFixed(2)}" 
                        step="0.1"
                        data-action="update-light-direction"
                        data-axis="1"
                        placeholder="Y"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${direction[2].toFixed(2)}" 
                        step="0.1"
                        data-action="update-light-direction"
                        data-axis="2"
                        placeholder="Z"
                    />
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Color</label>
                <div class="property-vector3">
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${(color[0] * 255).toFixed(0)}" 
                        min="0" 
                        max="255"
                        step="1"
                        data-action="update-light-color"
                        data-axis="0"
                        placeholder="R"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${(color[1] * 255).toFixed(0)}" 
                        min="0" 
                        max="255"
                        step="1"
                        data-action="update-light-color"
                        data-axis="1"
                        placeholder="G"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${(color[2] * 255).toFixed(0)}" 
                        min="0" 
                        max="255"
                        step="1"
                        data-action="update-light-color"
                        data-axis="2"
                        placeholder="B"
                    />
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Intensity</label>
                <div class="property-slider">
                    <input 
                        type="range" 
                        class="property-range" 
                        min="0" 
                        max="5" 
                        step="0.1" 
                        value="${intensity}"
                        data-action="update-light-intensity"
                    />
                    <span class="property-value">${intensity.toFixed(1)}</span>
                </div>
            </div>

            <div class="property-actions">
                <button class="property-btn property-btn-secondary" data-action="reset-light">
                    Reset Light
                </button>
            </div>
        `;
    }

    private renderAmbientLightProperties(node: SceneNode): string {
        const meta = node.metadata!;
        const color = meta.color || [0.8, 0.85, 0.9];
        const intensity = meta.intensity !== undefined ? meta.intensity : 0.3;
        
        return `
            <div class="property-group">
                <label class="property-label">Color</label>
                <div class="property-vector3">
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${(color[0] * 255).toFixed(0)}" 
                        min="0" 
                        max="255"
                        step="1"
                        data-action="update-ambient-color"
                        data-axis="0"
                        placeholder="R"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${(color[1] * 255).toFixed(0)}" 
                        min="0" 
                        max="255"
                        step="1"
                        data-action="update-ambient-color"
                        data-axis="1"
                        placeholder="G"
                    />
                    <input 
                        type="number" 
                        class="property-input property-input-small" 
                        value="${(color[2] * 255).toFixed(0)}" 
                        min="0" 
                        max="255"
                        step="1"
                        data-action="update-ambient-color"
                        data-axis="2"
                        placeholder="B"
                    />
                </div>
            </div>

            <div class="property-group">
                <label class="property-label">Intensity</label>
                <div class="property-slider">
                    <input 
                        type="range" 
                        class="property-range" 
                        min="0" 
                        max="2" 
                        step="0.1" 
                        value="${intensity}"
                        data-action="update-ambient-intensity"
                    />
                    <span class="property-value">${intensity.toFixed(1)}</span>
                </div>
            </div>

            <div class="property-actions">
                <button class="property-btn property-btn-secondary" data-action="reset-ambient">
                    Reset Ambient
                </button>
            </div>
        `;
    }

    private renderRootProperties(node: SceneNode): string {
        const meta = node.metadata || {};
        const meshCount = meta.meshCount || 0;
        const cameraCount = meta.cameraCount || 0;
        const lightCount = meta.lightCount || 0;
        const boundingBox = meta.boundingBox;

        return `
            <div class="property-group">
                <label class="property-label">Contents</label>
                <div class="property-value property-readonly">
                    ${meshCount} mesh${meshCount !== 1 ? 'es' : ''}, 
                    ${cameraCount} camera${cameraCount !== 1 ? 's' : ''}, 
                    ${lightCount} light${lightCount !== 1 ? 's' : ''}
                </div>
            </div>

            ${boundingBox ? `
            <div class="property-group">
                <label class="property-label">Bounding Box</label>
                <div class="property-value property-readonly">
                    Min: (${boundingBox.min.map((v: number) => v.toFixed(2)).join(', ')})<br/>
                    Max: (${boundingBox.max.map((v: number) => v.toFixed(2)).join(', ')})<br/>
                    Size: (${boundingBox.size.map((v: number) => v.toFixed(2)).join(', ')})
                </div>
            </div>
            ` : ''}
        `;
    }

    private getTypeLabel(type: string): string {
        switch (type) {
            case 'mesh': return 'Mesh';
            case 'camera': return 'Camera';
            case 'light': return 'Light';
            case 'folder': return 'Folder';
            case 'root': return 'Scene';
            default: return type;
        }
    }

    /**
     * Attach event listeners for interactive elements
     */
    private attachEventListeners(): void {
        if (!this.currentNode) return;

        const nodeId = this.currentNode.id;

        // Name input (rename)
        const nameInput = this.element.querySelector('[data-action="rename"]') as HTMLInputElement;
        if (nameInput) {
            nameInput.addEventListener('blur', () => {
                const newName = nameInput.value.trim();
                if (newName && newName !== this.currentNode?.name) {
                    this.callbacks.onRename?.(nodeId, newName);
                }
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    nameInput.blur();
                }
            });
        }

        // Visibility toggle
        const visibilityToggle = this.element.querySelector('[data-action="toggle-visibility"]') as HTMLInputElement;
        if (visibilityToggle) {
            visibilityToggle.addEventListener('change', () => {
                const visible = visibilityToggle.checked;
                this.callbacks.onToggleVisibility?.(nodeId, visible);
                
                // Update label
                const label = this.element.querySelector('.toggle-label');
                if (label) {
                    label.textContent = visible ? 'Visible' : 'Hidden';
                }
            });
        }

        // Remove button
        const removeBtn = this.element.querySelector('[data-action="remove"]');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                if (confirm(`Remove "${this.currentNode?.name}"?`)) {
                    this.callbacks.onRemove?.(nodeId);
                }
            });
        }

        // Save button
        const saveBtn = this.element.querySelector('[data-action="save"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.callbacks.onSave?.(nodeId);
            });
        }

        // Camera position inputs
        const positionInputs = this.element.querySelectorAll('[data-action="update-camera-position"]');
        if (positionInputs.length > 0) {
            const updatePosition = () => {
                const position: [number, number, number] = [0, 0, 0];
                positionInputs.forEach((input, index) => {
                    const rawValue = parseFloat((input as HTMLInputElement).value);
                    // Clamp position to reasonable bounds (-10000 to 10000)
                    position[index] = this.validateNumber(rawValue, -10000, 10000);
                    
                    // Update input value if it was clamped
                    const htmlInput = input as HTMLInputElement;
                    if (position[index] !== rawValue) {
                        htmlInput.value = position[index].toString();
                        htmlInput.classList.add('error');
                        setTimeout(() => htmlInput.classList.remove('error'), 500);
                    }
                });
                this.callbacks.onUpdateCameraPosition?.(nodeId, position);
            };

            positionInputs.forEach(input => {
                input.addEventListener('change', updatePosition);
                input.addEventListener('keydown', (e) => {
                    if ((e as KeyboardEvent).key === 'Enter') {
                        (input as HTMLInputElement).blur();
                    }
                });
            });
        }

        // Camera target inputs
        const targetInputs = this.element.querySelectorAll('[data-action="update-camera-target"]');
        if (targetInputs.length > 0) {
            const updateTarget = () => {
                const target: [number, number, number] = [0, 0, 0];
                targetInputs.forEach((input, index) => {
                    const rawValue = parseFloat((input as HTMLInputElement).value);
                    // Clamp target to reasonable bounds (-10000 to 10000)
                    target[index] = this.validateNumber(rawValue, -10000, 10000);
                    
                    // Update input value if it was clamped
                    const htmlInput = input as HTMLInputElement;
                    if (target[index] !== rawValue) {
                        htmlInput.value = target[index].toString();
                        htmlInput.classList.add('error');
                        setTimeout(() => htmlInput.classList.remove('error'), 500);
                    }
                });
                this.callbacks.onUpdateCameraTarget?.(nodeId, target);
            };

            targetInputs.forEach(input => {
                input.addEventListener('change', updateTarget);
                input.addEventListener('keydown', (e) => {
                    if ((e as KeyboardEvent).key === 'Enter') {
                        (input as HTMLInputElement).blur();
                    }
                });
            });
        }

        // Camera FOV slider
        const fovSlider = this.element.querySelector('[data-action="update-camera-fov"]') as HTMLInputElement;
        if (fovSlider) {
            const fovValueDisplay = this.element.querySelector('.property-slider-value');
            
            fovSlider.addEventListener('input', () => {
                const fov = parseInt(fovSlider.value);
                if (fovValueDisplay) {
                    fovValueDisplay.textContent = `${fov}°`;
                }
            });

            fovSlider.addEventListener('change', () => {
                const fov = parseInt(fovSlider.value);
                this.callbacks.onUpdateCameraFov?.(nodeId, fov);
            });
        }

        // Reset camera button
        const resetCameraBtn = this.element.querySelector('[data-action="reset-camera"]');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                this.callbacks.onResetCamera?.(nodeId);
            });
        }

        // Light direction inputs
        const lightDirectionInputs = this.element.querySelectorAll('[data-action="update-light-direction"]');
        if (lightDirectionInputs.length > 0) {
            const direction: [number, number, number] = [0, 0, 0];
            
            lightDirectionInputs.forEach((input) => {
                const axis = parseInt((input as HTMLElement).dataset.axis || '0');
                const rawValue = parseFloat((input as HTMLInputElement).value);
                direction[axis] = this.validateNumber(rawValue, -10, 10);
                
                input.addEventListener('change', () => {
                    const htmlInput = input as HTMLInputElement;
                    const rawValue = parseFloat(htmlInput.value);
                    direction[axis] = this.validateNumber(rawValue, -10, 10);
                    
                    // Update input if clamped
                    if (direction[axis] !== rawValue) {
                        htmlInput.value = direction[axis].toFixed(2);
                        htmlInput.classList.add('error');
                        setTimeout(() => htmlInput.classList.remove('error'), 500);
                    }
                    
                    this.callbacks.onUpdateLightDirection?.(nodeId, [...direction] as [number, number, number]);
                });
            });
        }

        // Light color inputs (RGB 0-255)
        const lightColorInputs = this.element.querySelectorAll('[data-action="update-light-color"]');
        if (lightColorInputs.length > 0) {
            const color: [number, number, number] = [255, 255, 255];
            
            lightColorInputs.forEach((input) => {
                const axis = parseInt((input as HTMLElement).dataset.axis || '0');
                const rawValue = parseFloat((input as HTMLInputElement).value);
                color[axis] = this.validateNumber(rawValue, 0, 255);
                
                input.addEventListener('change', () => {
                    const htmlInput = input as HTMLInputElement;
                    const rawValue = parseFloat(htmlInput.value);
                    color[axis] = this.validateNumber(rawValue, 0, 255);
                    
                    // Update input if clamped
                    if (color[axis] !== rawValue) {
                        htmlInput.value = Math.round(color[axis]).toString();
                        htmlInput.classList.add('error');
                        setTimeout(() => htmlInput.classList.remove('error'), 500);
                    }
                    
                    // Convert 0-255 to 0.0-1.0 for Rust
                    const normalizedColor: [number, number, number] = [
                        color[0] / 255,
                        color[1] / 255,
                        color[2] / 255
                    ];
                    this.callbacks.onUpdateLightColor?.(nodeId, normalizedColor);
                });
            });
        }

        // Light intensity slider
        const intensitySlider = this.element.querySelector('[data-action="update-light-intensity"]') as HTMLInputElement;
        if (intensitySlider) {
            const intensityValueDisplay = intensitySlider.parentElement?.querySelector('.property-value');
            
            intensitySlider.addEventListener('input', () => {
                const intensity = parseFloat(intensitySlider.value);
                if (intensityValueDisplay) {
                    intensityValueDisplay.textContent = intensity.toFixed(1);
                }
            });

            intensitySlider.addEventListener('change', () => {
                const intensity = parseFloat(intensitySlider.value);
                this.callbacks.onUpdateLightIntensity?.(nodeId, intensity);
            });
        }

        // Reset light button
        const resetLightBtn = this.element.querySelector('[data-action="reset-light"]');
        if (resetLightBtn) {
            resetLightBtn.addEventListener('click', () => {
                this.callbacks.onResetLight?.(nodeId);
            });
        }

        // Ambient color inputs (RGB 0-255)
        const ambientColorInputs = this.element.querySelectorAll('[data-action="update-ambient-color"]');
        if (ambientColorInputs.length > 0) {
            const color: [number, number, number] = [255, 255, 255];
            
            ambientColorInputs.forEach((input) => {
                const axis = parseInt((input as HTMLElement).dataset.axis || '0');
                const rawValue = parseFloat((input as HTMLInputElement).value);
                color[axis] = this.validateNumber(rawValue, 0, 255);
                
                input.addEventListener('change', () => {
                    const htmlInput = input as HTMLInputElement;
                    const rawValue = parseFloat(htmlInput.value);
                    color[axis] = this.validateNumber(rawValue, 0, 255);
                    
                    // Update input if clamped
                    if (color[axis] !== rawValue) {
                        htmlInput.value = Math.round(color[axis]).toString();
                        htmlInput.classList.add('error');
                        setTimeout(() => htmlInput.classList.remove('error'), 500);
                    }
                    
                    // Convert 0-255 to 0.0-1.0 for Rust
                    const normalizedColor: [number, number, number] = [
                        color[0] / 255,
                        color[1] / 255,
                        color[2] / 255
                    ];
                    this.callbacks.onUpdateAmbientColor?.(nodeId, normalizedColor);
                });
            });
        }

        // Ambient intensity slider
        const ambientIntensitySlider = this.element.querySelector('[data-action="update-ambient-intensity"]') as HTMLInputElement;
        if (ambientIntensitySlider) {
            const intensityValueDisplay = ambientIntensitySlider.parentElement?.querySelector('.property-value');
            
            ambientIntensitySlider.addEventListener('input', () => {
                const intensity = parseFloat(ambientIntensitySlider.value);
                if (intensityValueDisplay) {
                    intensityValueDisplay.textContent = intensity.toFixed(1);
                }
            });

            ambientIntensitySlider.addEventListener('change', () => {
                const intensity = parseFloat(ambientIntensitySlider.value);
                this.callbacks.onUpdateAmbientIntensity?.(nodeId, intensity);
            });
        }

        // Reset ambient button
        const resetAmbientBtn = this.element.querySelector('[data-action="reset-ambient"]');
        if (resetAmbientBtn) {
            resetAmbientBtn.addEventListener('click', () => {
                this.callbacks.onResetAmbient?.(nodeId);
            });
        }
    }

    destroy(): void {
        this.element.remove();
    }
}
