'use client';

/**
 * PixiIsometricMap - Main PixiJS canvas renderer for isometric game view
 * Replaces SVG-based IsometricMap with canvas rendering
 * Includes animated effects (smoke, glow) and hover highlights
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Graphics } from 'pixi.js';
import { useTick } from '@pixi/react';
import { PixiApplication } from './pixi/PixiApplication';
import { GameEntity, Connection } from '@/lib/types';
import {
  gridToScreen,
  sortByDepth,
  adjustColorNum,
  hexToNum,
  TILE_WIDTH,
  TILE_HEIGHT,
  type IsoPoint,
} from '@/lib/utils/pixi-isometric';
import { COLORS } from '@/lib/constants';
import { drawPlatform } from './pixi/buildings/Platform';
import { drawCrystalBuilding } from './pixi/buildings/CrystalBuilding';
import { drawFactoryBuilding } from './pixi/buildings/FactoryBuilding';
import { drawBankBuilding } from './pixi/buildings/BankBuilding';
import { drawBridge } from './pixi/Bridge';
import { drawSmokeParticles } from './pixi/effects/SmokeParticles';
import { drawCrystalGlow } from './pixi/effects/GlowEffect';

interface PixiIsometricMapProps {
  entities: GameEntity[];
  connections: Connection[];
  width: number;
  height: number;
  onEntityClick?: (entity: GameEntity) => void;
}

/**
 * Inner renderer component — must be a child of <Application>
 * so it can access useTick for animations
 */
function IsometricScene({
  entities,
  connections,
  width,
  height,
  onEntityClick,
}: PixiIsometricMapProps) {
  const timeRef = useRef(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Animated effects graphics ref (redrawn each frame)
  const effectsRef = useRef<Graphics | null>(null);

  // Center of the canvas
  const origin = useMemo<IsoPoint>(
    () => ({ x: width / 2, y: height / 2 }),
    [width, height]
  );

  // Sort entities by depth (painter's algorithm - back to front)
  const sortedEntities = useMemo(() => sortByDepth(entities), [entities]);

  // Build entity position map for bridge drawing
  const entityPositions = useMemo(() => {
    const map = new Map<string, IsoPoint>();
    entities.forEach((entity) => {
      const pos = gridToScreen(entity.position.x, entity.position.y, origin);
      map.set(entity.id, pos);
    });
    return map;
  }, [entities, origin]);

  // Tick animation — accumulate time and redraw effects layer
  useTick((ticker) => {
    timeRef.current += ticker.deltaTime / 60;
    const g = effectsRef.current;
    if (!g) return;

    g.clear();

    sortedEntities.forEach((entity) => {
      const pos = gridToScreen(entity.position.x, entity.position.y, origin);

      if (entity.type === 'factory') {
        drawSmokeParticles(g, pos.x, pos.y, timeRef.current);
      }

      if (entity.type === 'crystal') {
        drawCrystalGlow(g, pos.x, pos.y, entity.color, timeRef.current);
      }
    });
  });

  // Draw all bridges
  const drawBridges = useCallback(
    (g: Graphics) => {
      g.clear();
      connections.forEach((conn) => {
        const start = entityPositions.get(conn.from);
        const end = entityPositions.get(conn.to);
        if (start && end) {
          drawBridge(g, start, end);
        }
      });
    },
    [connections, entityPositions]
  );

  // Draw hover highlight on platform top face
  const drawHoverHighlight = useCallback(
    (g: Graphics, entity: GameEntity) => {
      g.clear();
      if (hoveredId !== entity.id) return;

      const pos = gridToScreen(entity.position.x, entity.position.y, origin);
      const baseColor = hexToNum(COLORS.islandBase);
      const highlightColor = adjustColorNum(baseColor, 40);

      const w = TILE_WIDTH / 2;
      const h = TILE_HEIGHT / 2;

      // Bright overlay on top face
      g.poly([
        { x: pos.x, y: pos.y - h },
        { x: pos.x + w, y: pos.y },
        { x: pos.x, y: pos.y + h },
        { x: pos.x - w, y: pos.y },
      ]);
      g.fill({ color: highlightColor, alpha: 0.3 });

      // White border highlight
      g.poly([
        { x: pos.x, y: pos.y - h },
        { x: pos.x + w, y: pos.y },
        { x: pos.x, y: pos.y + h },
        { x: pos.x - w, y: pos.y },
      ]);
      g.stroke({ color: 0xffffff, alpha: 0.5, width: 2 });
    },
    [hoveredId, origin]
  );

  // Draw a single entity (platform + building)
  const drawEntity = useCallback(
    (g: Graphics, entity: GameEntity) => {
      g.clear();
      const pos = gridToScreen(entity.position.x, entity.position.y, origin);

      // Draw platform base
      drawPlatform(g, pos.x, pos.y);

      // Draw building based on type
      switch (entity.type) {
        case 'crystal':
          drawCrystalBuilding(g, pos.x, pos.y, entity.color);
          break;
        case 'factory':
          drawFactoryBuilding(g, pos.x, pos.y, entity.color);
          break;
        case 'bank':
          drawBankBuilding(g, pos.x, pos.y, entity.color);
          break;
      }
    },
    [origin]
  );

  return (
    <>
      {/* Bridges layer (rendered first, behind everything) */}
      <pixiGraphics draw={drawBridges} />

      {/* Entities layer (platforms + buildings, depth sorted) */}
      {sortedEntities.map((entity) => (
        <pixiContainer
          key={entity.id}
          eventMode="static"
          cursor="pointer"
          onPointerDown={() => onEntityClick?.(entity)}
          onPointerEnter={() => setHoveredId(entity.id)}
          onPointerLeave={() =>
            setHoveredId((prev) => (prev === entity.id ? null : prev))
          }
        >
          <pixiGraphics draw={(g: Graphics) => drawEntity(g, entity)} />
          <pixiGraphics
            draw={(g: Graphics) => drawHoverHighlight(g, entity)}
          />
        </pixiContainer>
      ))}

      {/* Animated effects layer (smoke, glow — redrawn each frame by useTick) */}
      <pixiGraphics
        ref={effectsRef}
        draw={() => {/* initial draw is no-op; useTick redraws imperatively */}}
      />
    </>
  );
}

export function PixiIsometricMap(props: PixiIsometricMapProps) {
  return (
    <PixiApplication width={props.width} height={props.height}>
      <IsometricScene {...props} />
    </PixiApplication>
  );
}

export default PixiIsometricMap;
