/**
 * Isometric projection utilities for the game map
 * Converts 2D grid coordinates to screen coordinates
 */

import { Coordinate } from '../types';

// Tile dimensions for isometric grid
export const TILE_WIDTH = 200;
export const TILE_HEIGHT = 100;
export const BLOCK_HEIGHT = 35;

/**
 * Converts 2D grid coordinates to screen coordinates (isometric projection)
 * @param gridX The x coordinate on the grid
 * @param gridY The y coordinate on the grid
 * @param originX The screen X offset (center of the map)
 * @param originY The screen Y offset (vertical center)
 */
export function toScreenCoordinate(
  gridX: number,
  gridY: number,
  originX: number,
  originY: number
): Coordinate {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + originX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) + originY;
  return { x: screenX, y: screenY };
}

/**
 * Generates SVG path commands for a 3D isometric box
 * @param x Center x of the top face
 * @param y Center y of the top face
 * @param width Width of the diamond (tile width)
 * @param height Height of the diamond (tile height)
 * @param depth Height of the extrusion (block height)
 */
export function getIsoBoxPath(
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number
): { topFace: string; rightFace: string; leftFace: string } {
  const w = width;
  const h = height;
  const d = depth;

  // Top face diamond
  const topFace = `M ${x} ${y - h / 2} L ${x + w / 2} ${y} L ${x} ${y + h / 2} L ${x - w / 2} ${y} Z`;

  // Right face (side visible from right)
  const rightFace = `M ${x + w / 2} ${y} L ${x + w / 2} ${y + d} L ${x} ${y + h / 2 + d} L ${x} ${y + h / 2} Z`;

  // Left face (side visible from left)
  const leftFace = `M ${x - w / 2} ${y} L ${x} ${y + h / 2} L ${x} ${y + h / 2 + d} L ${x - w / 2} ${y + d} Z`;

  return { topFace, rightFace, leftFace };
}

/**
 * Legacy wrapper for standard tiles - uses default tile dimensions
 */
export function getBlockPath(x: number, y: number): {
  topFace: string;
  rightFace: string;
  leftFace: string;
} {
  return getIsoBoxPath(x, y, TILE_WIDTH, TILE_HEIGHT, BLOCK_HEIGHT);
}

/**
 * Adjusts a hex color by a given amount
 * @param hex Hex color string (e.g., "#FF0000")
 * @param amount Positive to lighten, negative to darken
 */
export function adjustColor(hex: string, amount: number): string {
  let usePound = false;
  if (hex[0] === '#') {
    hex = hex.slice(1);
    usePound = true;
  }

  const num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return (usePound ? '#' : '') + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Sort entities by depth for painter's algorithm (back to front)
 */
export function sortByDepth<T extends { position: Coordinate }>(entities: T[]): T[] {
  return [...entities].sort(
    (a, b) => a.position.x + a.position.y - (b.position.x + b.position.y)
  );
}
