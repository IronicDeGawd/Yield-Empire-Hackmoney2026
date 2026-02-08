/**
 * CompoundFlow - Particles streaming from center to all buildings
 * Pre-computed seed data for deterministic rendering
 */

import { Graphics } from 'pixi.js';

const PARTICLES_PER_TARGET = 2;
const STAGGER_TIME = 0.1; // seconds between particles
const PARTICLE_SIZE = 4;
const PARTICLE_COLOR = 0x22D3EE; // cyan (matches $EMPIRE token theme)
const BASE_ALPHA = 0.8;
const ARRIVAL_THRESHOLD = 0.85; // when to show arrival glow
const GLOW_MAX_RADIUS = 15;

// Pre-computed control point offsets for bezier curves (Y offset upward)
const CONTROL_OFFSETS = [
  { yOffset: -45, xVariance: -5 },
  { yOffset: -38, xVariance: 8 },
];

/**
 * Quadratic bezier interpolation
 */
function quadraticBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number
): number {
  const oneMinusT = 1 - t;
  return oneMinusT * oneMinusT * p0 + 2 * oneMinusT * t * p1 + t * t * p2;
}

/**
 * Draw compound flow effect
 * @param g - Graphics object to draw on
 * @param centerX - Center point screen X
 * @param centerY - Center point screen Y
 * @param targets - Array of {x, y} target building positions
 * @param progress - Animation progress (0-1)
 */
export function drawCompoundFlow(
  g: Graphics,
  centerX: number,
  centerY: number,
  targets: { x: number; y: number }[],
  progress: number
): void {
  targets.forEach((target, targetIdx) => {
    // Draw 2 particles per target
    for (let i = 0; i < PARTICLES_PER_TARGET; i++) {
      const stagger = (targetIdx * 0.05 + i * STAGGER_TIME) / 1.8; // normalize to 0-1
      const particleProgress = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger)));

      if (particleProgress <= 0) continue;

      // Control point for bezier curve
      const controlOffset = CONTROL_OFFSETS[i % CONTROL_OFFSETS.length];
      const controlX = (centerX + target.x) / 2 + controlOffset.xVariance;
      const controlY = (centerY + target.y) / 2 + controlOffset.yOffset;

      // Calculate particle position along bezier curve
      const particleX = quadraticBezier(particleProgress, centerX, controlX, target.x);
      const particleY = quadraticBezier(particleProgress, centerY, controlY, target.y);

      // Fade in last 20%
      let alpha = BASE_ALPHA;
      if (particleProgress > 0.8) {
        alpha = BASE_ALPHA * (1 - (particleProgress - 0.8) / 0.2);
      }

      if (alpha > 0.02) {
        g.circle(particleX, particleY, PARTICLE_SIZE);
        g.fill({ color: PARTICLE_COLOR, alpha });
      }

      // Arrival glow at target
      if (particleProgress > ARRIVAL_THRESHOLD) {
        const glowProgress = (particleProgress - ARRIVAL_THRESHOLD) / (1 - ARRIVAL_THRESHOLD);
        const glowRadius = glowProgress * GLOW_MAX_RADIUS;
        const glowAlpha = 0.4 * (1 - glowProgress);

        if (glowAlpha > 0.02) {
          g.circle(target.x, target.y, glowRadius);
          g.fill({ color: PARTICLE_COLOR, alpha: glowAlpha });
        }
      }
    }
  });
}
