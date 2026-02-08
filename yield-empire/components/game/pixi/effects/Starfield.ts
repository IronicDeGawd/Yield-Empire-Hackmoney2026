/**
 * Starfield - Pre-computed star positions for background effect
 * Static positions to avoid hydration mismatch (no Math.random())
 */

// Pre-computed star data (50 stars)
// Each star has: x (0-1), y (0-1), size (px), pulseSpeed (seconds)
export const STAR_DATA = [
  { x: 0.15, y: 0.25, size: 2, pulseSpeed: 3 },
  { x: 0.68, y: 0.45, size: 1.5, pulseSpeed: 4 },
  { x: 0.78, y: 0.12, size: 2.5, pulseSpeed: 2.5 },
  { x: 0.23, y: 0.89, size: 1.8, pulseSpeed: 3.5 },
  { x: 0.56, y: 0.34, size: 2.2, pulseSpeed: 4.5 },
  { x: 0.89, y: 0.56, size: 1.2, pulseSpeed: 3.2 },
  { x: 0.12, y: 0.78, size: 2.8, pulseSpeed: 2.8 },
  { x: 0.67, y: 0.45, size: 1.6, pulseSpeed: 4.2 },
  { x: 0.34, y: 0.9, size: 2.4, pulseSpeed: 3.8 },
  { x: 0.91, y: 0.23, size: 1.4, pulseSpeed: 2.2 },
  { x: 0.05, y: 0.5, size: 2.1, pulseSpeed: 3.6 },
  { x: 0.72, y: 0.82, size: 1.9, pulseSpeed: 4.8 },
  { x: 0.38, y: 0.15, size: 2.6, pulseSpeed: 2.6 },
  { x: 0.85, y: 0.72, size: 1.3, pulseSpeed: 3.4 },
  { x: 0.48, y: 0.08, size: 2.3, pulseSpeed: 4.4 },
  { x: 0.18, y: 0.62, size: 1.7, pulseSpeed: 2.4 },
  { x: 0.62, y: 0.95, size: 2.7, pulseSpeed: 3.9 },
  { x: 0.95, y: 0.38, size: 1.1, pulseSpeed: 4.1 },
  { x: 0.28, y: 0.05, size: 2.9, pulseSpeed: 2.9 },
  { x: 0.52, y: 0.48, size: 1.5, pulseSpeed: 3.3 },
  { x: 0.08, y: 0.32, size: 2.0, pulseSpeed: 3.7 },
  { x: 0.75, y: 0.18, size: 1.8, pulseSpeed: 4.3 },
  { x: 0.42, y: 0.68, size: 2.2, pulseSpeed: 2.7 },
  { x: 0.88, y: 0.85, size: 1.4, pulseSpeed: 3.1 },
  { x: 0.22, y: 0.42, size: 2.5, pulseSpeed: 4.6 },
  { x: 0.58, y: 0.28, size: 1.6, pulseSpeed: 2.3 },
  { x: 0.82, y: 0.62, size: 2.3, pulseSpeed: 3.5 },
  { x: 0.35, y: 0.78, size: 1.2, pulseSpeed: 4.0 },
  { x: 0.92, y: 0.15, size: 2.6, pulseSpeed: 2.5 },
  { x: 0.15, y: 0.92, size: 1.9, pulseSpeed: 3.8 },
  { x: 0.65, y: 0.55, size: 2.1, pulseSpeed: 4.2 },
  { x: 0.45, y: 0.22, size: 1.7, pulseSpeed: 2.8 },
  { x: 0.78, y: 0.42, size: 2.4, pulseSpeed: 3.4 },
  { x: 0.25, y: 0.58, size: 1.3, pulseSpeed: 4.7 },
  { x: 0.55, y: 0.85, size: 2.8, pulseSpeed: 2.6 },
  { x: 0.02, y: 0.72, size: 1.5, pulseSpeed: 3.2 },
  { x: 0.72, y: 0.02, size: 2.2, pulseSpeed: 4.4 },
  { x: 0.32, y: 0.35, size: 1.8, pulseSpeed: 2.9 },
  { x: 0.98, y: 0.48, size: 2.0, pulseSpeed: 3.6 },
  { x: 0.48, y: 0.98, size: 1.4, pulseSpeed: 4.1 },
  { x: 0.12, y: 0.18, size: 2.7, pulseSpeed: 2.4 },
  { x: 0.68, y: 0.72, size: 1.6, pulseSpeed: 3.9 },
  { x: 0.38, y: 0.52, size: 2.3, pulseSpeed: 4.5 },
  { x: 0.85, y: 0.28, size: 1.2, pulseSpeed: 2.7 },
  { x: 0.58, y: 0.08, size: 2.5, pulseSpeed: 3.3 },
  { x: 0.08, y: 0.88, size: 1.9, pulseSpeed: 4.8 },
  { x: 0.75, y: 0.38, size: 2.1, pulseSpeed: 2.2 },
  { x: 0.42, y: 0.82, size: 1.7, pulseSpeed: 3.7 },
  { x: 0.95, y: 0.65, size: 2.4, pulseSpeed: 4.3 },
  { x: 0.28, y: 0.25, size: 1.5, pulseSpeed: 3.0 },
];

// Animated cloud data
// direction: 'tr-bl' = top-right to bottom-left (uses cloud1 texture)
//            'tl-br' = top-left to bottom-right (uses cloud2 texture)
// layer: 'bg' = behind islands, 'fg' = in front of islands (creates depth)
// speed: pixels per second along the diagonal
// startOffset: 0-1 normalized position along the travel path at t=0
// lane: -1 to 1, perpendicular offset from center diagonal (spreads clouds across screen)
export const CLOUD_DATA: CloudData[] = [
  // Background clouds — spread across different lanes, mixed directions
  { startOffset: 0.1, scale: 2.2, speed: 12, direction: 'tr-bl', layer: 'bg', alpha: 0.75, lane: -0.5 },
  { startOffset: 0.6, scale: 2.8, speed: 8,  direction: 'tl-br', layer: 'bg', alpha: 0.7, lane: 0.4 },
  { startOffset: 0.35, scale: 2.0, speed: 10, direction: 'tr-bl', layer: 'bg', alpha: 0.65, lane: 0.7 },
  // Foreground clouds — spread across lanes, mixed directions
  { startOffset: 0.0, scale: 1.5, speed: 18, direction: 'tl-br', layer: 'fg', alpha: 0.5, lane: -0.3 },
  { startOffset: 0.75, scale: 1.8, speed: 15, direction: 'tr-bl', layer: 'fg', alpha: 0.45, lane: 0.5 },
  { startOffset: 0.45, scale: 1.6, speed: 20, direction: 'tl-br', layer: 'fg', alpha: 0.4, lane: -0.6 },
];

export interface StarData {
  x: number;
  y: number;
  size: number;
  pulseSpeed: number;
}

export interface CloudData {
  startOffset: number;
  scale: number;
  speed: number;
  direction: 'tr-bl' | 'tl-br';
  layer: 'bg' | 'fg';
  alpha: number;
  lane: number; // -1 to 1, perpendicular offset from center
}

