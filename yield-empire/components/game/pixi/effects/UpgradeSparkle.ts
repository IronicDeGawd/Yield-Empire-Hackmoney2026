/**
 * UpgradeSparkle - Burst of particles celebrating a building upgrade
 * Pre-computed particle seeds for deterministic rendering
 */

import { Graphics } from 'pixi.js';

// Pre-computed sparkle particle seeds (12 particles in a ring)
// Each particle: angle (radians), speed factor (0.8-1.2), isWhite (last 4)
const SPARKLE_SEEDS = [
  { angle: 0.0, speedFactor: 1.05, color: 0xFFD700 },
  { angle: 0.524, speedFactor: 0.92, color: 0xFFD700 },
  { angle: 1.047, speedFactor: 1.13, color: 0xFFD700 },
  { angle: 1.571, speedFactor: 0.88, color: 0xFFD700 },
  { angle: 2.094, speedFactor: 1.18, color: 0xFFD700 },
  { angle: 2.618, speedFactor: 0.95, color: 0xFFD700 },
  { angle: 3.142, speedFactor: 1.08, color: 0xFFD700 },
  { angle: 3.665, speedFactor: 0.85, color: 0xFFD700 },
  { angle: 4.189, speedFactor: 1.15, color: 0xFFFFFF }, // white
  { angle: 4.712, speedFactor: 0.98, color: 0xFFFFFF }, // white
  { angle: 5.236, speedFactor: 1.02, color: 0xFFFFFF }, // white
  { angle: 5.760, speedFactor: 1.12, color: 0xFFFFFF }, // white
];

const MIN_DISTANCE = 40;
const MAX_DISTANCE = 60;

/**
 * Draw upgrade sparkle effect
 * @param g - Graphics object to draw on
 * @param x - Building center screen X
 * @param y - Building base screen Y (adjusted)
 * @param progress - Animation progress (0-1)
 */
export function drawUpgradeSparkle(
  g: Graphics,
  x: number,
  y: number,
  progress: number
): void {
  // Ease-out motion: 1 - (1-p)^2
  const easeOut = 1 - Math.pow(1 - progress, 2);

  // Center flash circle (first 30% of duration)
  if (progress < 0.3) {
    const flashProgress = progress / 0.3;
    const flashRadius = flashProgress * 30;
    const flashAlpha = 0.6 * (1 - flashProgress);

    if (flashAlpha > 0.02) {
      g.circle(x, y, flashRadius);
      g.fill({ color: 0xFFFFFF, alpha: flashAlpha });
    }
  }

  // Burst particles
  SPARKLE_SEEDS.forEach((seed) => {
    const distance = MIN_DISTANCE + (MAX_DISTANCE - MIN_DISTANCE) * seed.speedFactor * easeOut;
    const particleX = x + Math.cos(seed.angle) * distance;
    const particleY = y + Math.sin(seed.angle) * distance;

    // Shrink: 3px → 1px
    const radius = 3 - 2 * progress;

    // Fade out linearly
    const alpha = 1 - progress;

    if (alpha > 0.02 && radius > 0.2) {
      g.circle(particleX, particleY, radius);
      g.fill({ color: seed.color, alpha });
    }
  });
}
