/**
 * Rover UI Templates
 * 
 * HTML generation for Rover project UI elements.
 * Extracted from RoverProject to keep the main class focused on logic.
 */

export class RoverUITemplates {
    /**
     * Generate rover information panel HTML
     */
    static generateRoverInfo(data: {
        cameraBaseline: number;
        cameraFOV: number;
        leftCameraPos: { x: number; y: number; z: number };
        rightCameraPos: { x: number; y: number; z: number };
        leftCameraRot: { yaw: number; pitch: number };
        rightCameraRot: { yaw: number; pitch: number };
    }): string {
        return `
            <div class="info-section">
                <h3>🤖 Rover Configuration</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Camera Baseline:</span>
                        <span class="info-value">${data.cameraBaseline.toFixed(2)} m</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Field of View:</span>
                        <span class="info-value">${data.cameraFOV}°</span>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h3>📷 Left Camera</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Position:</span>
                        <span class="info-value">
                            (${data.leftCameraPos.x.toFixed(2)}, 
                             ${data.leftCameraPos.y.toFixed(2)}, 
                             ${data.leftCameraPos.z.toFixed(2)})
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Yaw:</span>
                        <span class="info-value">${(data.leftCameraRot.yaw * 180 / Math.PI).toFixed(1)}°</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Pitch:</span>
                        <span class="info-value">${(data.leftCameraRot.pitch * 180 / Math.PI).toFixed(1)}°</span>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h3>📷 Right Camera</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Position:</span>
                        <span class="info-value">
                            (${data.rightCameraPos.x.toFixed(2)}, 
                             ${data.rightCameraPos.y.toFixed(2)}, 
                             ${data.rightCameraPos.z.toFixed(2)})
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Yaw:</span>
                        <span class="info-value">${(data.rightCameraRot.yaw * 180 / Math.PI).toFixed(1)}°</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Pitch:</span>
                        <span class="info-value">${(data.rightCameraRot.pitch * 180 / Math.PI).toFixed(1)}°</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate stereo view layout HTML
     */
    static generateStereoViewHTML(): string {
        return `
            <div class="stereo-container">
                <div class="stereo-view">
                    <h3>📷 Left Camera</h3>
                    <canvas id="stereo-canvas-left"></canvas>
                </div>
                <div class="stereo-view">
                    <h3>📷 Right Camera</h3>
                    <canvas id="stereo-canvas-right"></canvas>
                </div>
            </div>
        `;
    }

    /**
     * Generate depth view layout HTML
     */
    static generateDepthViewHTML(): string {
        return `
            <div class="depth-container">
                <h3>🔬 Depth Map</h3>
                <canvas id="depth-canvas"></canvas>
                <div class="depth-controls">
                    <button id="compute-depth">Compute Depth</button>
                    <div class="depth-info">
                        <span>Min Depth: <span id="min-depth">-</span></span>
                        <span>Max Depth: <span id="max-depth">-</span></span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate full grid view layout HTML  
     */
    static generateFullGridHTML(): string {
        return `
            <div class="grid-container">
                <div class="grid-view">
                    <h3>🎬 Scene</h3>
                    <canvas id="grid-canvas-scene"></canvas>
                </div>
                <div class="grid-view">
                    <h3>📷 Left</h3>
                    <canvas id="grid-canvas-left"></canvas>
                </div>
                <div class="grid-view">
                    <h3>📷 Right</h3>
                    <canvas id="grid-canvas-right"></canvas>
                </div>
                <div class="grid-view">
                    <h3>🔬 Depth</h3>
                    <canvas id="grid-canvas-depth"></canvas>
                </div>
            </div>
        `;
    }

    /**
     * Generate point cloud view layout HTML
     */
    static generatePointCloudHTML(): string {
        return `
            <div class="pointcloud-container">
                <h3>🎯 Point Cloud Reconstruction</h3>
                <canvas id="pointcloud-canvas"></canvas>
                <div class="pointcloud-controls">
                    <button id="generate-pointcloud">Generate Point Cloud</button>
                    <div class="pointcloud-info">
                        <span>Points: <span id="point-count">0</span></span>
                    </div>
                </div>
            </div>
        `;
    }
}
