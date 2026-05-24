/**
 * Map Renderer Utilities
 * 
 * Generic utilities for rendering 2D scalar maps (heightmaps, slope maps, etc.)
 * to canvas with colormaps. Can be reused across different projects.
 */

import { appLogger } from './logger';

/**
 * Color interpolation between two RGB colors
 */
function lerpColor(color1: [number, number, number], color2: [number, number, number], t: number): [number, number, number] {
    return [
        Math.round(color1[0] + (color2[0] - color1[0]) * t),
        Math.round(color1[1] + (color2[1] - color1[1]) * t),
        Math.round(color1[2] + (color2[2] - color2[2]) * t)
    ];
}

/**
 * Colormap configuration
 */
export type ColormapConfig = {
    colors: [number, number, number][]; // RGB colors for gradient stops
    min?: number; // Minimum value (default: 0)
    max?: number; // Maximum value (default: 1)
};

/**
 * Predefined colormaps
 */
export const COLORMAPS = {
    // Blue → Cyan → Green → Yellow → Red (terrain elevation)
    TERRAIN: {
        colors: [
            [0, 0, 128],      // Deep blue (water)
            [0, 128, 255],    // Light blue (shallow)
            [0, 200, 0],      // Green (plains)
            [200, 200, 0],    // Yellow (hills)
            [255, 100, 0],    // Orange (mountains)
            [255, 255, 255]   // White (peaks)
        ]
    },
    
    // Black → White (slope/intensity)
    GRAYSCALE: {
        colors: [
            [0, 0, 0],        // Black (flat)
            [255, 255, 255]   // White (steep)
        ]
    },
    
    // Blue → White → Red (heat map)
    HEATMAP: {
        colors: [
            [0, 0, 255],      // Blue (cold)
            [0, 255, 255],    // Cyan
            [0, 255, 0],      // Green
            [255, 255, 0],    // Yellow
            [255, 0, 0]       // Red (hot)
        ]
    },
    
    // Viridis-like (perceptually uniform)
    VIRIDIS: {
        colors: [
            [68, 1, 84],      // Purple
            [59, 82, 139],    // Blue
            [33, 145, 140],   // Teal
            [94, 201, 98],    // Green
            [253, 231, 37]    // Yellow
        ]
    }
};

/**
 * Get color from colormap for a given normalized value [0, 1]
 */
export function getColorFromMap(value: number, colormap: ColormapConfig): [number, number, number] {
    const { colors, min = 0, max = 1 } = colormap;
    
    // Normalize value to [0, 1]
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // Find gradient segment
    const segments = colors.length - 1;
    const segment = Math.min(Math.floor(normalized * segments), segments - 1);
    const localT = (normalized * segments) - segment;
    
    return lerpColor(colors[segment], colors[segment + 1], localT);
}

/**
 * Render a scalar map to a canvas with a colormap
 */
export function renderScalarMap(
    canvas: HTMLCanvasElement,
    data: Float32Array,
    width: number,
    height: number,
    colormap: ColormapConfig
): void {
    appLogger.debug('[MapRenderer] Rendering scalar map', { width, height, dataLength: data.length });
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        appLogger.error('[MapRenderer] Failed to get 2D context');
        return;
    }
    
    // Create image data
    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;
    
    // Fill pixels with colormap
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const value = data[index];
            const color = getColorFromMap(value, colormap);
            
            const pixelIndex = (y * width + x) * 4;
            pixels[pixelIndex] = color[0];     // R
            pixels[pixelIndex + 1] = color[1]; // G
            pixels[pixelIndex + 2] = color[2]; // B
            pixels[pixelIndex + 3] = 255;      // A
        }
    }
    
    // Draw to canvas
    ctx.putImageData(imageData, 0, 0);
    
    appLogger.debug('[MapRenderer] Scalar map rendered');
}

/**
 * Compute statistics for a scalar map
 */
export type MapStats = {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
};

export function computeMapStats(data: Float32Array): MapStats {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    
    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        min = Math.min(min, value);
        max = Math.max(max, value);
        sum += value;
    }
    
    const mean = sum / data.length;
    
    // Compute standard deviation
    let variance = 0;
    for (let i = 0; i < data.length; i++) {
        const diff = data[i] - mean;
        variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / data.length);
    
    return { min, max, mean, stdDev };
}

/**
 * Render statistics overlay on canvas
 */
export function renderStatsOverlay(
    canvas: HTMLCanvasElement,
    stats: MapStats,
    title: string
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 90);
    
    // Text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(title, 20, 30);
    
    ctx.font = '12px monospace';
    ctx.fillText(`Min:  ${stats.min.toFixed(2)}`, 20, 50);
    ctx.fillText(`Max:  ${stats.max.toFixed(2)}`, 20, 65);
    ctx.fillText(`Mean: ${stats.mean.toFixed(2)}`, 20, 80);
    ctx.fillText(`σ:    ${stats.stdDev.toFixed(2)}`, 20, 95);
}

/**
 * Create a canvas element with proper styling
 */
export function createMapCanvas(id: string, width: number = 512, height: number = 512): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.backgroundColor = '#1a1a1a';
    return canvas;
}

/**
 * Render colormap legend
 */
export function renderColormapLegend(
    canvas: HTMLCanvasElement,
    colormap: ColormapConfig,
    title: string
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const legendHeight = 20;
    const legendWidth = canvas.width - 40;
    const legendX = 20;
    const legendY = canvas.height - 60;
    
    // Draw gradient bar
    for (let x = 0; x < legendWidth; x++) {
        const t = x / legendWidth;
        const color = getColorFromMap(t, { ...colormap, min: 0, max: 1 });
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fillRect(legendX + x, legendY, 1, legendHeight);
    }
    
    // Border
    ctx.strokeStyle = 'white';
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
    
    // Labels
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    ctx.fillText(title, legendX, legendY - 5);
    ctx.fillText((colormap.min ?? 0).toFixed(1), legendX, legendY + legendHeight + 12);
    ctx.fillText((colormap.max ?? 1).toFixed(1), legendX + legendWidth - 30, legendY + legendHeight + 12);
}
