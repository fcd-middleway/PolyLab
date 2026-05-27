/**
 * Terrain View Layouts
 * 
 * Layout configurations for terrain visualization modes.
 * Each layout is a pure function that sets up a specific view:
 * - 3D: WebGPU mesh view (uses original canvas)
 * - Heightmap: 2D colormap visualization
 * - Slope: 2D grayscale visualization
 * - Future: Flow, Materials, etc.
 */

import { appLogger } from '../utils/logger';
import { 
    renderScalarMap, 
    computeMapStats, 
    renderStatsOverlay,
    renderColormapLegend,
    createMapCanvas,
    COLORMAPS 
} from '../utils/mapRenderer';

/**
 * Terrain map data container
 */
export type TerrainMapData = {
    heightmap: Float32Array | null;
    slopeMap: Float32Array | null;
    flowMap: Float32Array | null;
    width: number;
    height: number;
};

/**
 * Generate HTML for 2D map view with title
 */
function generate2DMapViewHTML(title: string, canvasId: string): string {
    return `
        <div style="
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #1a1a1a;
            color: white;
        ">
            <!-- Title bar -->
            <div style="
                padding: 10px 20px;
                background: linear-gradient(to bottom, #2a2a2a, #1a1a1a);
                border-bottom: 1px solid #3a3a3a;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            ">
                <h3 style="margin: 0; font-size: 16px; font-weight: 500;">${title}</h3>
            </div>
            
            <!-- Canvas container -->
            <div style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                overflow: hidden;
            ">
                <canvas id="${canvasId}" style="
                    max-width: 100%;
                    max-height: 100%;
                    image-rendering: pixelated;
                    border: 1px solid #3a3a3a;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                "></canvas>
            </div>
        </div>
    `;
}

/**
 * Setup function for heightmap view
 */
export function setupHeightmapView(container: HTMLElement, mapData: TerrainMapData): void {
    appLogger.debug('[TerrainLayouts] Setting up Heightmap view');
    
    container.innerHTML = generate2DMapViewHTML('🗺️ Heightmap', 'heightmap-canvas');
    
    const canvas = document.getElementById('heightmap-canvas') as HTMLCanvasElement;
    if (!canvas || !mapData.heightmap || mapData.heightmap.length === 0) {
        appLogger.warn('[TerrainLayouts] Missing canvas or heightmap data');
        return;
    }
    
    // Compute stats
    const stats = computeMapStats(mapData.heightmap);
    appLogger.debug('[TerrainLayouts] Heightmap stats', stats);
    
    // Render with terrain colormap
    renderScalarMap(
        canvas,
        mapData.heightmap,
        mapData.width,
        mapData.height,
        {
            ...COLORMAPS.TERRAIN,
            min: stats.min,
            max: stats.max
        }
    );
    
    // Add stats overlay
    renderStatsOverlay(canvas, stats, 'Heightmap');
    
    // Add colormap legend
    renderColormapLegend(
        canvas,
        { ...COLORMAPS.TERRAIN, min: stats.min, max: stats.max },
        'Elevation'
    );
}

/**
 * Setup function for slope map view
 */
export function setupSlopeMapView(container: HTMLElement, mapData: TerrainMapData): void {
    appLogger.debug('[TerrainLayouts] Setting up Slope view');
    
    container.innerHTML = generate2DMapViewHTML('📐 Slope Map', 'slope-canvas');
    
    const canvas = document.getElementById('slope-canvas') as HTMLCanvasElement;
    if (!canvas || !mapData.slopeMap || mapData.slopeMap.length === 0) {
        appLogger.warn('[TerrainLayouts] Missing canvas or slope data');
        return;
    }
    
    // Compute stats
    const stats = computeMapStats(mapData.slopeMap);
    appLogger.debug('[TerrainLayouts] Slope stats', stats);
    
    // Render with grayscale colormap
    renderScalarMap(
        canvas,
        mapData.slopeMap,
        mapData.width,
        mapData.height,
        {
            ...COLORMAPS.GRAYSCALE,
            min: stats.min,
            max: stats.max
        }
    );
    
    // Add stats overlay
    renderStatsOverlay(canvas, stats, 'Slope');
    
    // Add colormap legend
    renderColormapLegend(
        canvas,
        { ...COLORMAPS.GRAYSCALE, min: stats.min, max: stats.max },
        'Slope (degrees)'
    );
}

/**
 * Setup function for flow map view (placeholder for future)
 */
export function setupFlowMapView(container: HTMLElement, mapData: TerrainMapData): void {
    appLogger.debug('[TerrainLayouts] Setting up Flow view');
    
    container.innerHTML = generate2DMapViewHTML('💧 Flow Map', 'flow-canvas');
    
    const canvas = document.getElementById('flow-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    // TODO: Render flow direction arrows + accumulation
    const ctx = canvas.getContext('2d');
    if (ctx) {
        canvas.width = 512;
        canvas.height = 512;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#666';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Flow map not yet implemented', canvas.width / 2, canvas.height / 2);
        ctx.fillText('(Phase 2: Hydrology)', canvas.width / 2, canvas.height / 2 + 25);
    }
}

/**
 * Setup function for material map view (placeholder for future)
 */
export function setupMaterialMapView(container: HTMLElement, mapData: TerrainMapData): void {
    appLogger.debug('[TerrainLayouts] Setting up Material view');
    
    container.innerHTML = generate2DMapViewHTML('🎨 Material Map', 'material-canvas');
    
    const canvas = document.getElementById('material-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    // TODO: Render material splat map (RGB channels)
    const ctx = canvas.getContext('2d');
    if (ctx) {
        canvas.width = 512;
        canvas.height = 512;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#666';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Material map not yet implemented', canvas.width / 2, canvas.height / 2);
        ctx.fillText('(Phase 3: Materials)', canvas.width / 2, canvas.height / 2 + 25);
    }
}
