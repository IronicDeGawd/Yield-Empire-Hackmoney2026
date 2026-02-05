/**
 * Platform - Island base drawing for PixiJS
 * Draws the purple isometric platform that buildings sit on
 */

import { Graphics } from 'pixi.js';
import {
  drawIsoBox,
  hexToNum,
  adjustColorNum,
  TILE_WIDTH,
  TILE_HEIGHT,
  BLOCK_HEIGHT,
} from '@/lib/utils/pixi-isometric';
import { COLORS } from '@/lib/constants';

/**
 * Draw a platform (island base) at the given screen coordinates
 */
export function drawPlatform(g: Graphics, x: number, y: number): void {
  const baseColor = hexToNum(COLORS.islandBase);

  drawIsoBox(
    g,
    x,
    y,
    TILE_WIDTH,
    TILE_HEIGHT,
    BLOCK_HEIGHT,
    baseColor, // top face
    adjustColorNum(baseColor, -30), // right face (darker)
    adjustColorNum(baseColor, -50) // left face (darkest)
  );
}
