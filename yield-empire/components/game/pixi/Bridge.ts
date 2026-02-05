/**
 * Bridge - Connection paths between islands
 * PixiJS drawing for bridges connecting protocol buildings
 */

import { Graphics } from 'pixi.js';
import type { IsoPoint } from '@/lib/utils/pixi-isometric';

// Bridge styling
const BRIDGE_WIDTH = 24;
const BRIDGE_OFFSET_Y = 15; // Vertical offset from platform center
const SHADOW_OFFSET = 15;

/**
 * Draw a bridge connecting two screen positions
 */
export function drawBridge(
  g: Graphics,
  start: IsoPoint,
  end: IsoPoint
): void {
  // Bridge shadow (depth)
  g.moveTo(start.x, start.y + BRIDGE_OFFSET_Y + SHADOW_OFFSET);
  g.lineTo(end.x, end.y + BRIDGE_OFFSET_Y + SHADOW_OFFSET);
  g.stroke({ color: 0x4c1d95, width: BRIDGE_WIDTH, cap: 'round' });

  // Bridge top surface
  g.moveTo(start.x, start.y + BRIDGE_OFFSET_Y);
  g.lineTo(end.x, end.y + BRIDGE_OFFSET_Y);
  g.stroke({ color: 0x6b4c75, width: BRIDGE_WIDTH, cap: 'round' });

  // Dashed detail line
  // Note: PixiJS doesn't have native dashed lines, so we draw dots
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const segments = Math.floor(length / 24);

  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments;
    const px = start.x + dx * t;
    const py = start.y + (end.y - start.y) * t + BRIDGE_OFFSET_Y;

    g.circle(px, py, 2);
    g.fill({ color: 0xffffff, alpha: 0.3 });
  }
}

/**
 * Draw all bridges for a set of connections
 */
export function drawAllBridges(
  g: Graphics,
  connections: Array<{ from: string; to: string }>,
  entityPositions: Map<string, IsoPoint>
): void {
  connections.forEach((conn) => {
    const start = entityPositions.get(conn.from);
    const end = entityPositions.get(conn.to);

    if (start && end) {
      drawBridge(g, start, end);
    }
  });
}
