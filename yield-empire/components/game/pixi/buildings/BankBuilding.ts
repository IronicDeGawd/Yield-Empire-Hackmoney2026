/**
 * BankBuilding - Square vault building (Compound)
 * PixiJS drawing for bank-type buildings
 */

import { Graphics } from 'pixi.js';
import {
  drawIsoBox,
  hexToNum,
  adjustColorNum,
} from '@/lib/utils/pixi-isometric';

// Bank dimensions
const BANK_SIZE = 80;

/**
 * Draw a bank building at the given screen coordinates
 */
export function drawBankBuilding(
  g: Graphics,
  x: number,
  y: number,
  color: string
): void {
  const colorNum = hexToNum(color);
  const topY = y - BANK_SIZE;

  // Main vault body
  drawIsoBox(
    g,
    x,
    topY,
    BANK_SIZE,
    BANK_SIZE / 2,
    BANK_SIZE,
    adjustColorNum(colorNum, 20), // top
    adjustColorNum(colorNum, -40), // right
    adjustColorNum(colorNum, -20) // left
  );

  // Gold door/window on front face
  g.poly([
    { x: x - 15, y: y - 15 },
    { x: x + 15, y },
    { x: x + 15, y: y - 40 },
    { x: x - 15, y: y - 55 },
  ]);
  g.fill({ color: 0xfbbf24 }); // Gold color

  // Door frame
  g.poly([
    { x: x - 15, y: y - 15 },
    { x: x + 15, y },
    { x: x + 15, y: y - 40 },
    { x: x - 15, y: y - 55 },
  ]);
  g.stroke({ color: 0xd97706, width: 2 });
}
