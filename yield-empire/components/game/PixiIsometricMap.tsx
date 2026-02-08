'use client';

/**
 * PixiIsometricMap - Main PixiJS canvas renderer for isometric game view
 * Replaces SVG-based IsometricMap with canvas rendering
 * Includes animated effects (smoke, glow) and hover highlights
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container as PixiContainerClass, Graphics } from 'pixi.js';
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
import { CLOUD_DATA, type CloudData } from './pixi/effects/Starfield';

export interface HoverInfo {
  entity: GameEntity;
  screenX: number;
  screenY: number;
}

interface PixiIsometricMapProps {
  entities: GameEntity[];
  connections: Connection[];
  width: number;
  height: number;
  onEntityClick?: (entity: GameEntity) => void;
  onEntityHover?: (info: HoverInfo | null) => void;
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
  isUnmounted,
  onEntityClick,
  onEntityHover,
  textures,
}: PixiIsometricMapProps & { textures: GameSpriteTextures; isUnmounted: React.MutableRefObject<boolean> }) {
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
  const BRIDGE_OFFSET_Y = -48;
  const PLATFORM_BASE_OFFSET_Y = TILE_HEIGHT / 2 + BLOCK_HEIGHT;
  const BUILDING_BASE_OFFSET_Y = -45;

  // Cloud animation — imperatively updated each frame via container refs
  const cloudContainerRefs = useRef<(PixiContainerClass | null)[]>(
    new Array(CLOUD_DATA.length).fill(null)
  );
  const cloudOffsets = useRef(CLOUD_DATA.map((c) => c.startOffset));

  // Compute cloud pixel position from normalized offset
  // Uses lane for perpendicular offset to spread clouds across parallel paths
  const getCloudPos = useCallback(
    (cloud: CloudData, offset: number) => {
      const margin = 200;
      // Lane offset perpendicular to the diagonal direction
      const laneOffsetAmount = cloud.lane * (height * 0.5);

      if (cloud.direction === 'tr-bl') {
        // Top-right to bottom-left: lane shifts along the perpendicular (bottom-right to top-left)
        return {
          x: (width + margin) * (1 - offset) - margin / 2 + laneOffsetAmount * 0.7,
          y: (height + margin) * offset - margin / 2 + laneOffsetAmount * 0.7,
        };
      }
      // Top-left to bottom-right: lane shifts along the perpendicular (top-right to bottom-left)
      return {
        x: (width + margin) * offset - margin / 2 + laneOffsetAmount * 0.7,
        y: (height + margin) * offset - margin / 2 - laneOffsetAmount * 0.7,
      };
    },
    [width, height]
  );

  useTick((ticker) => {
    // Guard against operations after unmount (prevents crashes on page refresh)
    if (isUnmounted.current) return;

    timeRef.current += ticker.deltaTime / 60;
    const dt = ticker.deltaTime / 60;

    // Advance cloud offsets and update container positions
    const diagonal = Math.sqrt(width * width + height * height);
    CLOUD_DATA.forEach((cloud, i) => {
      const normalizedSpeed = cloud.speed / diagonal;
      cloudOffsets.current[i] += normalizedSpeed * dt;
      if (cloudOffsets.current[i] > 1.15) {
        cloudOffsets.current[i] = -0.15;
      }
      const container = cloudContainerRefs.current[i];
      if (container) {
        const pos = getCloudPos(cloud, cloudOffsets.current[i]);
        container.x = pos.x;
        container.y = pos.y;
      }
    });

    // Redraw effects (smoke, glow)
    const g = effectsRef.current;
    if (!g) return;
    g.clear();

    sortedEntities.forEach((entity) => {
      const pos = gridToScreen(entity.position.x, entity.position.y, origin);
      if (entity.type === 'factory') {
        drawSmokeParticles(g, pos.x, pos.y + 8, timeRef.current);
      }
      if (entity.type === 'crystal') {
        drawCrystalGlow(g, pos.x, pos.y, entity.color, timeRef.current);
      }
    });
  });

  const bgClouds = useMemo(() => {
    const result: { cloud: CloudData; index: number }[] = [];
    CLOUD_DATA.forEach((c, i) => { if (c.layer === 'bg') result.push({ cloud: c, index: i }); });
    return result;
  }, []);
  const fgClouds = useMemo(() => {
    const result: { cloud: CloudData; index: number }[] = [];
    CLOUD_DATA.forEach((c, i) => { if (c.layer === 'fg') result.push({ cloud: c, index: i }); });
    return result;
  }, []);

  return (
    <>
      {/* Background clouds — behind islands */}
      {bgClouds.map(({ cloud, index }) => (
        <pixiContainer
          key={`cloud-bg-${index}`}
          ref={(node: PixiContainerClass | null) => { cloudContainerRefs.current[index] = node; }}
        >
          <pixiSprite
            texture={cloud.direction === 'tr-bl' ? textures.cloud1 : textures.cloud2}
            anchor={{ x: 0.5, y: 0.5 }}
            scale={{ x: cloud.scale, y: cloud.scale }}
            alpha={cloud.alpha}
          />
        </pixiContainer>
      ))}

      {/* Bridges layer */}
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
            onPointerEnter={() => {
              setHoveredId(entity.id);
              onEntityHover?.({ entity, screenX: pos.x, screenY: pos.y + BUILDING_BASE_OFFSET_Y - 80 });
            }}
            onPointerLeave={() => {
              setHoveredId((prev) => (prev === entity.id ? null : prev));
              onEntityHover?.(null);
            }}
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

      {/* Animated effects layer (smoke, glow) */}
      <pixiGraphics
        ref={effectsRef}
        draw={() => {/* initial draw is no-op; useTick redraws imperatively */ }}
      />

      {/* Foreground clouds — over islands for depth */}
      {fgClouds.map(({ cloud, index }) => (
        <pixiContainer
          key={`cloud-fg-${index}`}
          ref={(node: PixiContainerClass | null) => { cloudContainerRefs.current[index] = node; }}
        >
          <pixiSprite
            texture={cloud.direction === 'tr-bl' ? textures.cloud1 : textures.cloud2}
            anchor={{ x: 0.5, y: 0.5 }}
            scale={{ x: cloud.scale, y: cloud.scale }}
            alpha={cloud.alpha}
          />
        </pixiContainer>
      ))}
    </>
  );
}

export function PixiIsometricMap(props: PixiIsometricMapProps) {
  const [textures, setTextures] = useState<GameSpriteTextures | null>(null);
  const isUnmountedRef = useRef(false);

  // Track unmount state to prevent operations after component is destroyed
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      // Clear textures to prevent stale WebGL references
      setTextures(null);
    };
  }, []);

  // Load textures after the PixiJS Application (and its WebGL context) has initialized.
  // Loading before this point creates textures without a GPU context, rendering them blank.
  const handleAppInit = useCallback(() => {
    // Don't load if already unmounted (can happen during fast refresh)
    if (isUnmountedRef.current) return;

    loadGameSpriteTextures()
      .then((loaded) => {
        // Guard against setting state after unmount
        if (!isUnmountedRef.current) {
          setTextures(loaded);
        }
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
      {textures && <IsometricScene {...props} textures={textures} isUnmounted={isUnmountedRef} />}
    </PixiApplication>
  );
}

export default PixiIsometricMap;
