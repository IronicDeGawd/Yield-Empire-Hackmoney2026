/**
 * SettleConfetti - Falling particle celebration
 * Pre-computed seed data for deterministic rendering
 */

import { Graphics } from 'pixi.js';

// Pre-computed confetti particle seeds (30 particles)
// Each particle: startX (normalized 0-1), startY, hDrift, fallSpeed, color, size
const CONFETTI_SEEDS = [
  { startX: 0.12, startY: -15, hDrift: 0.3, fallSpeed: 95, color: 0xFFD700, size: 4.2 },
  { startX: 0.28, startY: -8, hDrift: -0.6, fallSpeed: 120, color: 0x22D3EE, size: 3.5 },
  { startX: 0.45, startY: -20, hDrift: 0.8, fallSpeed: 88, color: 0xA855F7, size: 5.1 },
  { startX: 0.63, startY: -5, hDrift: -0.4, fallSpeed: 145, color: 0xFFFFFF, size: 3.8 },
  { startX: 0.75, startY: -12, hDrift: 0.5, fallSpeed: 102, color: 0xFFD700, size: 4.8 },
  { startX: 0.88, startY: -18, hDrift: -0.7, fallSpeed: 135, color: 0x22D3EE, size: 3.2 },
  { startX: 0.05, startY: -10, hDrift: 0.2, fallSpeed: 108, color: 0xA855F7, size: 5.5 },
  { startX: 0.18, startY: -3, hDrift: -0.5, fallSpeed: 118, color: 0xFFFFFF, size: 4.5 },
  { startX: 0.35, startY: -16, hDrift: 0.7, fallSpeed: 92, color: 0xFFD700, size: 3.9 },
  { startX: 0.52, startY: -7, hDrift: -0.3, fallSpeed: 128, color: 0x22D3EE, size: 4.6 },
  { startX: 0.68, startY: -19, hDrift: 0.6, fallSpeed: 85, color: 0xA855F7, size: 5.3 },
  { startX: 0.82, startY: -11, hDrift: -0.8, fallSpeed: 155, color: 0xFFFFFF, size: 3.4 },
  { startX: 0.95, startY: -14, hDrift: 0.4, fallSpeed: 112, color: 0xFFD700, size: 4.4 },
  { startX: 0.08, startY: -6, hDrift: -0.2, fallSpeed: 98, color: 0x22D3EE, size: 5.0 },
  { startX: 0.22, startY: -17, hDrift: 0.9, fallSpeed: 142, color: 0xA855F7, size: 3.6 },
  { startX: 0.38, startY: -9, hDrift: -0.5, fallSpeed: 105, color: 0xFFFFFF, size: 4.7 },
  { startX: 0.55, startY: -13, hDrift: 0.3, fallSpeed: 125, color: 0xFFD700, size: 3.3 },
  { startX: 0.72, startY: -4, hDrift: -0.7, fallSpeed: 138, color: 0x22D3EE, size: 5.4 },
  { startX: 0.85, startY: -16, hDrift: 0.5, fallSpeed: 90, color: 0xA855F7, size: 4.1 },
  { startX: 0.15, startY: -8, hDrift: -0.4, fallSpeed: 115, color: 0xFFFFFF, size: 4.9 },
  { startX: 0.32, startY: -19, hDrift: 0.6, fallSpeed: 82, color: 0xFFD700, size: 5.2 },
  { startX: 0.48, startY: -11, hDrift: -0.8, fallSpeed: 148, color: 0x22D3EE, size: 3.7 },
  { startX: 0.65, startY: -15, hDrift: 0.4, fallSpeed: 122, color: 0xA855F7, size: 4.3 },
  { startX: 0.78, startY: -7, hDrift: -0.3, fallSpeed: 108, color: 0xFFFFFF, size: 5.6 },
  { startX: 0.92, startY: -12, hDrift: 0.7, fallSpeed: 95, color: 0xFFD700, size: 3.1 },
  { startX: 0.02, startY: -18, hDrift: -0.6, fallSpeed: 132, color: 0x22D3EE, size: 4.0 },
  { startX: 0.25, startY: -5, hDrift: 0.2, fallSpeed: 102, color: 0xA855F7, size: 5.8 },
  { startX: 0.42, startY: -14, hDrift: -0.5, fallSpeed: 118, color: 0xFFFFFF, size: 3.5 },
  { startX: 0.58, startY: -9, hDrift: 0.8, fallSpeed: 88, color: 0xFFD700, size: 4.6 },
  { startX: 0.88, startY: -16, hDrift: -0.4, fallSpeed: 125, color: 0x22D3EE, size: 5.1 },
];

const FADE_START = 0.7; // Start fading after 70% of duration
const WOBBLE_AMPLITUDE = 15;

/**
 * Draw settle confetti effect
 * @param g - Graphics object to draw on
 * @param width - Viewport width
 * @param height - Viewport height
 * @param progress - Animation progress (0-1)
 */
export function drawSettleConfetti(
  g: Graphics,
  width: number,
  height: number,
  progress: number
): void {
  CONFETTI_SEEDS.forEach((seed) => {
    // Position
    const startX = seed.startX * width;
    const yFall = seed.fallSpeed * progress * 1.2; // slight acceleration
    const wobble = Math.sin(progress * 4) * seed.hDrift * WOBBLE_AMPLITUDE;
    const particleX = startX + wobble;
    const particleY = seed.startY + yFall;

    // Skip if off-screen
    if (particleY > height + 20) return;

    // Alpha: solid until FADE_START, then fade out
    let alpha = 1.0;
    if (progress > FADE_START) {
      alpha = 1 - (progress - FADE_START) / (1 - FADE_START);
    }

    if (alpha > 0.02) {
      g.circle(particleX, particleY, seed.size);
      g.fill({ color: seed.color, alpha });
    }
  });
}
