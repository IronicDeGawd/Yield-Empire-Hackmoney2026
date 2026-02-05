/**
 * CrystalBuilding - Tall vertical crystal tower (AAVE, Yearn)
 * PixiJS drawing for crystal-type buildings
 */

import { Graphics } from 'pixi.js';
import {
  drawIsoBox,
  hexToNum,
  adjustColorNum,
} from '@/lib/utils/pixi-isometric';

// Crystal dimensions
const CRYSTAL_HEIGHT = 120;
const CRYSTAL_WIDTH = 50;
const CRYSTAL_DEPTH = 50;

/**
 * Draw a crystal building at the given screen coordinates
 */
export function drawCrystalBuilding(
  g: Graphics,
  x: number,
  y: number,
  color: string
): void {
  const colorNum = hexToNum(color);
  const topY = y - CRYSTAL_HEIGHT;

  // Main crystal body
  drawIsoBox(
    g,
    x,
    topY,
    CRYSTAL_WIDTH,
    CRYSTAL_DEPTH,
    CRYSTAL_HEIGHT,
    adjustColorNum(colorNum, 20), // top (lighter)
    adjustColorNum(colorNum, -40), // right
    adjustColorNum(colorNum, -20) // left
  );

  // Glowing orb at center
  g.circle(x, y - CRYSTAL_HEIGHT / 2, 10);
  g.fill({ color: 0xffffff, alpha: 0.9 });

  // Inner glow
  g.circle(x, y - CRYSTAL_HEIGHT / 2, 6);
  g.fill({ color: colorNum, alpha: 0.7 });
}
