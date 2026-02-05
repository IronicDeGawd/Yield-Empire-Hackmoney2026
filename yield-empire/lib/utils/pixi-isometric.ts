/**
 * PixiJS-specific isometric projection utilities
 * Drawing helpers for isometric 3D boxes and coordinate conversion
 */

import { Graphics } from 'pixi.js';

// Tile dimensions for isometric grid (matching SVG implementation)
export const TILE_WIDTH = 200;
export const TILE_HEIGHT = 100;
export const BLOCK_HEIGHT = 35;

export interface IsoPoint {
  x: number;
  y: number;
}

/**
 * Converts 2D grid coordinates to screen coordinates (isometric projection)
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  origin: IsoPoint
): IsoPoint {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + origin.x,
    y: (gridX + gridY) * (TILE_HEIGHT / 2) + origin.y,
  };
}

/**
 * Sort entities by depth for painter's algorithm (back to front)
 */
export function sortByDepth<T extends { position: IsoPoint }>(entities: T[]): T[] {
  return [...entities].sort(
    (a, b) => a.position.x + a.position.y - (b.position.x + b.position.y)
  );
}

/**
 * Draw an isometric box (3D cube) on a Graphics object
 */
export function drawIsoBox(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  topColor: number,
  rightColor: number,
  leftColor: number
): void {
  const w = width / 2;
  const h = height / 2;

  // Left face (front-left side)
  g.poly([
    { x: x - w, y },
    { x, y: y + h },
    { x, y: y + h + depth },
    { x: x - w, y: y + depth },
  ]);
  g.fill({ color: leftColor });
  g.stroke({ color: 0x000000, alpha: 0.2, width: 0.5 });

  // Right face (front-right side)
  g.poly([
    { x: x + w, y },
    { x, y: y + h },
    { x, y: y + h + depth },
    { x: x + w, y: y + depth },
  ]);
  g.fill({ color: rightColor });
  g.stroke({ color: 0x000000, alpha: 0.2, width: 0.5 });

  // Top face (diamond)
  g.poly([
    { x, y: y - h },
    { x: x + w, y },
    { x, y: y + h },
    { x: x - w, y },
  ]);
  g.fill({ color: topColor });
  g.stroke({ color: 0xffffff, alpha: 0.1, width: 0.5 });
}

/**
 * Convert hex string (#RRGGBB) to number (0xRRGGBB)
 */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Adjust color brightness
 * @param color - Color as number (0xRRGGBB)
 * @param amount - Positive to lighten, negative to darken
 */
export function adjustColorNum(color: number, amount: number): number {
  let r = (color >> 16) + amount;
  let g = ((color >> 8) & 0xff) + amount;
  let b = (color & 0xff) + amount;

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return (r << 16) | (g << 8) | b;
}

/**
 * Convert hex string to adjusted color number
 */
export function adjustHexColor(hex: string, amount: number): number {
  return adjustColorNum(hexToNum(hex), amount);
}
