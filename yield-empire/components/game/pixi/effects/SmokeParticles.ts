/**
 * SmokeParticles - Animated smoke rising from factory chimneys
 * Pre-computed seed positions for deterministic rendering
 */

import { Graphics } from 'pixi.js';

// Pre-computed smoke particle seeds (no Math.random at render time)
// Each particle: offsetX (-1 to 1 normalized), size (px), drift direction, speed factor
const SMOKE_SEEDS = [
  { offsetX: 0.0, size: 6, drift: -0.3, speed: 1.0 },
  { offsetX: 0.2, size: 5, drift: 0.4, speed: 0.8 },
  { offsetX: -0.15, size: 7, drift: -0.2, speed: 1.2 },
  { offsetX: 0.1, size: 4, drift: 0.5, speed: 0.9 },
  { offsetX: -0.25, size: 5.5, drift: -0.1, speed: 1.1 },
  { offsetX: 0.3, size: 6.5, drift: 0.3, speed: 0.7 },
  { offsetX: -0.05, size: 4.5, drift: -0.4, speed: 1.3 },
  { offsetX: 0.15, size: 5, drift: 0.2, speed: 1.0 },
];

// Chimney offset from building center (matches FactoryBuilding.ts)
const CHIMNEY_OFFSET_X = 25;
const MAIN_HEIGHT = 50;
const CHIMNEY_HEIGHT = 80;

/**
 * Draw animated smoke particles above a factory chimney
 * @param g - Graphics object to draw on
 * @param x - Building center screen X
 * @param y - Building base screen Y
 * @param time - Elapsed time in seconds (from ticker)
 */
export function drawSmokeParticles(
  g: Graphics,
  x: number,
  y: number,
  time: number
): void {
  const chimneyTopX = x + CHIMNEY_OFFSET_X;
  const chimneyTopY = y - MAIN_HEIGHT - CHIMNEY_HEIGHT;

  SMOKE_SEEDS.forEach((seed, i) => {
    // Each particle loops on its own phase cycle
    const phase = ((time * seed.speed * 0.4) + (i * 0.35)) % 1.0;

    // Rise height: 0 at chimney top, up to 60px above
    const riseY = phase * 60;

    // Drift sideways as it rises
    const driftX = seed.drift * phase * 20 + seed.offsetX * 8;

    // Expand as it rises
    const radius = seed.size * (1 + phase * 0.8);

    // Fade out as it rises
    const alpha = 0.45 * (1 - phase);

    if (alpha > 0.02) {
      g.circle(
        chimneyTopX + driftX,
        chimneyTopY - riseY - 8,
        radius
      );
      g.fill({ color: 0x9ca3af, alpha });
    }
  });
}
