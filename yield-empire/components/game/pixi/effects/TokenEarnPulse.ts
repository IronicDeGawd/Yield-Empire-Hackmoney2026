/**
 * TokenEarnPulse - Subtle expanding ring on buildings earning yield
 * Pre-computed for deterministic rendering
 */

import { Graphics } from 'pixi.js';

const MIN_RADIUS = 5;
const MAX_RADIUS = 20;
const BASE_ALPHA = 0.4;
const PULSE_COLOR = 0x22D3EE; // cyan (matches $EMPIRE token theme)

/**
 * Draw token earn pulse effect
 * @param g - Graphics object to draw on
 * @param x - Building center screen X
 * @param y - Building base screen Y (adjusted)
 * @param progress - Animation progress (0-1)
 */
export function drawTokenEarnPulse(
  g: Graphics,
  x: number,
  y: number,
  progress: number
): void {
  const radius = MIN_RADIUS + progress * (MAX_RADIUS - MIN_RADIUS);
  const alpha = BASE_ALPHA * (1 - progress);

  if (alpha > 0.02) {
    g.circle(x, y, radius);
    g.stroke({ color: PULSE_COLOR, alpha, width: 2 });
  }
}
