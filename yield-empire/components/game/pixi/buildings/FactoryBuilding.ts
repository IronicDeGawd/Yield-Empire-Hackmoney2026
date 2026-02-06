/**
 * FactoryBuilding - Wide building with chimney (Uniswap, Curve)
 * PixiJS drawing for factory-type buildings
 */

import { Graphics } from 'pixi.js';
import {
  drawIsoBox,
  hexToNum,
  adjustColorNum,
} from '@/lib/utils/pixi-isometric';

// Main building dimensions
const MAIN_HEIGHT = 50;
const MAIN_WIDTH = 130;
const MAIN_DEPTH = 60;

// Chimney dimensions
const CHIMNEY_HEIGHT = 80;
const CHIMNEY_WIDTH = 25;
const CHIMNEY_DEPTH = 25;
const CHIMNEY_OFFSET_X = 25;

/**
 * Draw a factory building at the given screen coordinates
 */
export function drawFactoryBuilding(
  g: Graphics,
  x: number,
  y: number,
  color: string
): void {
  const colorNum = hexToNum(color);
  const mainTopY = y - MAIN_HEIGHT;

  // Main building body
  drawIsoBox(
    g,
    x,
    mainTopY,
    MAIN_WIDTH,
    MAIN_DEPTH,
    MAIN_HEIGHT,
    adjustColorNum(colorNum, 10), // top
    adjustColorNum(colorNum, -50), // right
    adjustColorNum(colorNum, -30) // left
  );

  // Chimney
  const chimX = x + CHIMNEY_OFFSET_X;
  const chimTopY = mainTopY - CHIMNEY_HEIGHT;

  drawIsoBox(
    g,
    chimX,
    chimTopY,
    CHIMNEY_WIDTH,
    CHIMNEY_DEPTH,
    CHIMNEY_HEIGHT,
    0x1f2937, // dark gray top
    0x374151, // right
    0x4b5563 // left
  );

}
