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
  TILE_HEIGHT,
  BLOCK_HEIGHT,
  GRID_SPACING,
  type IsoPoint,
} from '@/lib/utils/pixi-isometric';
import { drawSmokeParticles } from './pixi/effects/SmokeParticles';
import { drawCrystalGlow } from './pixi/effects/GlowEffect';
import { type GameSpriteTextures, loadGameSpriteTextures } from './pixi/assets';
import { CLOUD_DATA } from './pixi/effects/Starfield';

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
  textures,
}: PixiIsometricMapProps & { textures: GameSpriteTextures }) {
  const timeRef = useRef(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Animated effects graphics ref (redrawn each frame)
  const effectsRef = useRef<Graphics | null>(null);

  // Center of the canvas
  const MAP_OFFSET_X = 0;
  const MAP_OFFSET_Y = -10;

  const origin = useMemo<IsoPoint>(
    () => ({ x: width / 2 + MAP_OFFSET_X, y: height / 2 + MAP_OFFSET_Y }),
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
        drawSmokeParticles(g, pos.x, pos.y + 18, timeRef.current);
      }

      if (entity.type === 'crystal') {
        drawCrystalGlow(g, pos.x, pos.y, entity.color, timeRef.current);
      }
    });
  });

  const isTopLeftBridge = useCallback((fromId: string, toId: string) => {
    const key = [fromId, toId].sort().join('-');
    return key === 'e1-e2' || key === 'e3-e4';
  }, []);

  const getBuildingTexture = useCallback(
    (entity: GameEntity) => {
      if (entity.type === 'crystal') return textures.shard;
      if (entity.type === 'bank') return textures.treasury;
      if (entity.type === 'factory') {
        return entity.protocol === 'uniswap' ? textures.building1 : textures.building2;
      }
      return textures.building1;
    },
    [textures]
  );

  const PLATFORM_SPRITE_HEIGHT = 112;
  const BUILDING_SPRITE_SIZE = 64;
  const PLATFORM_SPRITE_SCALE =
    ((TILE_HEIGHT + BLOCK_HEIGHT) / PLATFORM_SPRITE_HEIGHT) * 1.75;
  const BUILDING_SPRITE_SCALE = ((TILE_HEIGHT * 1.2) / BUILDING_SPRITE_SIZE) * 0.75;
  const BUILDING_HOVER_SCALE = 1.08;
  const BRIDGE_SPRITE_HEIGHT = 48;
  const BRIDGE_SPRITE_SCALE = (TILE_HEIGHT / BRIDGE_SPRITE_HEIGHT) * 0.9 * GRID_SPACING;
  const BRIDGE_OFFSET_Y = -8;
  const PLATFORM_BASE_OFFSET_Y = TILE_HEIGHT / 2 + BLOCK_HEIGHT;
  const BUILDING_BASE_OFFSET_Y = -20;
  const CLOUD_BASE_WIDTH = 64;
  const CLOUD_BASE_HEIGHT = 40;

  return (
    <>
      {/* Cloud layer (behind bridges and islands) */}
      {CLOUD_DATA.map((cloud, i) => {
        const texture =
          i % 3 === 0 ? textures.cloud1 : i % 3 === 1 ? textures.cloud2 : textures.cloud3;
        const scaleX = cloud.width / CLOUD_BASE_WIDTH;
        const scaleY = cloud.height / CLOUD_BASE_HEIGHT;

        return (
          <pixiSprite
            key={`cloud-${i}`}
            texture={texture}
            x={cloud.x * width}
            y={cloud.y * height}
            anchor={{ x: 0.5, y: 0.5 }}
            scale={{ x: scaleX, y: scaleY }}
            alpha={0.35}
          />
        );
      })}

      {/* Bridges layer (rendered first, behind everything) */}
      {connections.map((conn) => {
        const start = entityPositions.get(conn.from);
        const end = entityPositions.get(conn.to);

        if (!start || !end) return null;

        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2 + BRIDGE_OFFSET_Y;
        const bridgeTexture = isTopLeftBridge(conn.from, conn.to)
          ? textures.stairsTopLeft
          : textures.stairsTopRight;

        return (
          <pixiSprite
            key={`bridge-${conn.from}-${conn.to}`}
            texture={bridgeTexture}
            x={midX}
            y={midY}
            anchor={{ x: 0.5, y: 0.5 }}
            scale={{ x: BRIDGE_SPRITE_SCALE, y: BRIDGE_SPRITE_SCALE }}
          />
        );
      })}

      {/* Entities layer (platforms + buildings, depth sorted) */}
      {sortedEntities.map((entity) => {
        const pos = gridToScreen(entity.position.x, entity.position.y, origin);
        const buildingTexture = getBuildingTexture(entity);

        return (
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
            <pixiSprite
              texture={textures.island}
              x={pos.x}
              y={pos.y + PLATFORM_BASE_OFFSET_Y}
              anchor={{ x: 0.5, y: 1 }}
              scale={{ x: PLATFORM_SPRITE_SCALE, y: PLATFORM_SPRITE_SCALE }}
            />
            <pixiSprite
              texture={buildingTexture}
              x={pos.x}
              y={pos.y + BUILDING_BASE_OFFSET_Y}
              anchor={{ x: 0.5, y: 1 }}
              scale={{
                x: BUILDING_SPRITE_SCALE * (hoveredId === entity.id ? BUILDING_HOVER_SCALE : 1),
                y: BUILDING_SPRITE_SCALE * (hoveredId === entity.id ? BUILDING_HOVER_SCALE : 1),
              }}
            />
          </pixiContainer>
        );
      })}

      {/* Animated effects layer (smoke, glow — redrawn each frame by useTick) */}
      <pixiGraphics
        ref={effectsRef}
        draw={() => {/* initial draw is no-op; useTick redraws imperatively */}}
      />
    </>
  );
}

export function PixiIsometricMap(props: PixiIsometricMapProps) {
  const [textures, setTextures] = useState<GameSpriteTextures | null>(null);

  // Load textures after the PixiJS Application (and its WebGL context) has initialized.
  // Loading before this point creates textures without a GPU context, rendering them blank.
  const handleAppInit = useCallback(() => {
    loadGameSpriteTextures()
      .then((loaded) => {
        setTextures(loaded);
      })
      .catch((err) => {
        console.error('Failed to load game sprites:', err);
      });
  }, []);

  return (
    <PixiApplication
      width={props.width}
      height={props.height}
      onInit={handleAppInit}
    >
      {textures && <IsometricScene {...props} textures={textures} />}
    </PixiApplication>
  );
}

export default PixiIsometricMap;
