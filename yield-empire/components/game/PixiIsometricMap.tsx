'use client';

/**
 * PixiIsometricMap - Main PixiJS canvas renderer for isometric game view
 * Replaces SVG-based IsometricMap with canvas rendering
 */

import { useCallback, useMemo } from 'react';
import { Graphics } from 'pixi.js';
import { PixiApplication } from './pixi/PixiApplication';
import { GameEntity, Connection } from '@/lib/types';
import {
  gridToScreen,
  sortByDepth,
  type IsoPoint,
} from '@/lib/utils/pixi-isometric';
import { drawPlatform } from './pixi/buildings/Platform';
import { drawCrystalBuilding } from './pixi/buildings/CrystalBuilding';
import { drawFactoryBuilding } from './pixi/buildings/FactoryBuilding';
import { drawBankBuilding } from './pixi/buildings/BankBuilding';
import { drawBridge } from './pixi/Bridge';

interface PixiIsometricMapProps {
  entities: GameEntity[];
  connections: Connection[];
  width: number;
  height: number;
  onEntityClick?: (entity: GameEntity) => void;
}

export function PixiIsometricMap({
  entities,
  connections,
  width,
  height,
  onEntityClick,
}: PixiIsometricMapProps) {
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
    <PixiApplication width={width} height={height}>
      {/* Bridges layer (rendered first, behind everything) */}
      <pixiGraphics draw={drawBridges} />

      {/* Entities layer (platforms + buildings, depth sorted) */}
      {sortedEntities.map((entity) => (
        <pixiContainer
          key={entity.id}
          eventMode="static"
          cursor="pointer"
          onPointerDown={() => onEntityClick?.(entity)}
        >
          <pixiGraphics draw={(g: Graphics) => drawEntity(g, entity)} />
        </pixiContainer>
      ))}
    </PixiApplication>
  );
}

export default PixiIsometricMap;
