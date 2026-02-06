/**
 * GlowEffect - Pulsing glow rings around crystal building orbs
 * Animated via PixiJS ticker for smooth pulsing
 */

import { Graphics } from 'pixi.js';
import { hexToNum } from '@/lib/utils/pixi-isometric';

// Crystal dimensions (matching CrystalBuilding.ts)
const CRYSTAL_HEIGHT = 120;

/**
 * Draw animated glow rings around a crystal building's orb
 * @param g - Graphics object to draw on
 * @param x - Building center screen X
 * @param y - Building base screen Y
 * @param color - Building color hex string
 * @param time - Elapsed time in seconds (from ticker)
 */
export function drawCrystalGlow(
  g: Graphics,
  x: number,
  y: number,
  color: string,
  time: number
): void {
  const colorNum = hexToNum(color);
  const orbY = y - CRYSTAL_HEIGHT / 2;

  // Outer pulsing ring
  const outerPulse = 0.3 + 0.25 * Math.sin(time * 2.0);
  const outerRadius = 16 + 4 * Math.sin(time * 1.5);
  g.circle(x, orbY, outerRadius);
  g.fill({ color: colorNum, alpha: outerPulse * 0.3 });

  // Middle ring (slightly offset phase)
  const midPulse = 0.4 + 0.3 * Math.sin(time * 2.5 + 1.0);
  g.circle(x, orbY, 12);
  g.fill({ color: colorNum, alpha: midPulse * 0.25 });

  // Inner bright core pulse
  const corePulse = 0.7 + 0.3 * Math.sin(time * 3.0 + 0.5);
  g.circle(x, orbY, 4);
  g.fill({ color: 0xffffff, alpha: corePulse });
}
