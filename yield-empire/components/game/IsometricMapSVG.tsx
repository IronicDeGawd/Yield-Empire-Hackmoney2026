'use client';

/**
 * IsometricMap - SVG-based isometric game map with buildings and bridges
 * Renders the main game view with interactive DeFi protocol buildings
 */

import { useMemo } from 'react';
import { GameEntity, Connection } from '@/lib/types';
import {
  toScreenCoordinate,
  getBlockPath,
  getIsoBoxPath,
  adjustColor,
  sortByDepth,
  TILE_WIDTH,
  TILE_HEIGHT,
} from '@/lib/utils/isometric';
import { COLORS } from '@/lib/constants';

interface IsometricMapProps {
  entities: GameEntity[];
  connections: Connection[];
  width: number;
  height: number;
  onEntityClick?: (entity: GameEntity) => void;
}

export function IsometricMap({
  entities,
  connections,
  width,
  height,
  onEntityClick,
}: IsometricMapProps) {
  // Center of the canvas
  const originX = width / 2;
  const originY = height / 2;

  // Sort entities by depth (painter's algorithm)
  const sortedEntities = useMemo(() => sortByDepth(entities), [entities]);

  // Helper to get screen coordinates for a specific entity ID
  const getEntityCoords = (id: string) => {
    const entity = entities.find((e) => e.id === id);
    if (!entity) return null;
    return toScreenCoordinate(entity.position.x, entity.position.y, originX, originY);
  };

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        {/* Glow filter for crystals */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Bridge gradient */}
        <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6B4C75" />
          <stop offset="100%" stopColor="#4D3654" />
        </linearGradient>
      </defs>

      {/* Render Connections (Bridges) */}
      {connections.map((conn, idx) => {
        const start = getEntityCoords(conn.from);
        const end = getEntityCoords(conn.to);

        if (!start || !end) return null;

        const ySurface = 0;
        const yDepth = 15;

        return (
          <g key={`conn-${idx}`}>
            {/* Bridge Side (Thickness) */}
            <line
              x1={start.x}
              y1={start.y + yDepth + 15}
              x2={end.x}
              y2={end.y + yDepth + 15}
              stroke="#4C1D95"
              strokeWidth="24"
              strokeLinecap="round"
            />
            {/* Bridge Top */}
            <line
              x1={start.x}
              y1={start.y + ySurface + 15}
              x2={end.x}
              y2={end.y + ySurface + 15}
              stroke="url(#bridgeGradient)"
              strokeWidth="24"
              strokeLinecap="round"
            />
            {/* Dashed Detail */}
            <line
              x1={start.x}
              y1={start.y + ySurface + 15}
              x2={end.x}
              y2={end.y + ySurface + 15}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="12 12"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* Render Entities (Platforms + Buildings) */}
      {sortedEntities.map((entity) => {
        const { x, y } = toScreenCoordinate(
          entity.position.x,
          entity.position.y,
          originX,
          originY
        );

        // Platform uses island base color
        const { topFace, rightFace, leftFace } = getBlockPath(x, y);

        const sideColor = adjustColor(COLORS.islandBase, -30);
        const topColor = COLORS.islandBase;
        const frontColor = adjustColor(COLORS.islandBase, -50);

        return (
          <g
            key={entity.id}
            className="transition-transform duration-300 cursor-pointer group"
            onClick={() => onEntityClick?.(entity)}
            style={{ transform: 'scale(1)', transformOrigin: `${x}px ${y}px` }}
          >
            {/* Platform Base */}
            <path
              d={leftFace}
              fill={frontColor}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.5"
            />
            <path
              d={rightFace}
              fill={sideColor}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.5"
            />
            <path
              d={topFace}
              fill={topColor}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.5"
            />

            {/* Building Geometry based on Type */}
            <Building type={entity.type} x={x} y={y} color={entity.color} />

            {/* Hover Highlight */}
            <path
              d={topFace}
              fill="white"
              opacity="0"
              className="group-hover:opacity-20 transition-opacity"
            />
          </g>
        );
      })}
    </svg>
  );
}

// Building renderer component
interface BuildingProps {
  type: string;
  x: number;
  y: number;
  color: string;
}

function Building({ type, x, y, color }: BuildingProps) {
  if (type === 'crystal') {
    const h = 120;
    const w = 50;
    const d = 50;
    const topY = y - h;
    const paths = getIsoBoxPath(x, topY, w, d, h);

    return (
      <g>
        <path d={paths.leftFace} fill={adjustColor(color, -20)} />
        <path d={paths.rightFace} fill={adjustColor(color, -40)} />
        <path d={paths.topFace} fill={adjustColor(color, 20)} />
        <circle
          cx={x}
          cy={y - h / 2}
          r="8"
          fill="white"
          filter="url(#glow)"
          className="animate-pulse"
        />
      </g>
    );
  }

  if (type === 'factory') {
    const h1 = 50;
    const w1 = 130;
    const d1 = 60;
    const topY1 = y - h1;
    const main = getIsoBoxPath(x, topY1, w1, d1, h1);

    const h2 = 80;
    const w2 = 25;
    const d2 = 25;
    const chimX = x + 25;
    const chimTopY = topY1 - h2;
    const chim = getIsoBoxPath(chimX, chimTopY, w2, d2, h2);

    return (
      <g>
        {/* Main building */}
        <path d={main.leftFace} fill={adjustColor(color, -30)} />
        <path d={main.rightFace} fill={adjustColor(color, -50)} />
        <path d={main.topFace} fill={adjustColor(color, 10)} />

        {/* Chimney */}
        <path d={chim.leftFace} fill="#4B5563" />
        <path d={chim.rightFace} fill="#374151" />
        <path d={chim.topFace} fill="#1F2937" />

        {/* Smoke effect */}
        <circle
          cx={chimX}
          cy={chimTopY - 10}
          r="5"
          fill="#9CA3AF"
          opacity="0.6"
          className="animate-ping"
          style={{ animationDuration: '3s' }}
        />
      </g>
    );
  }

  if (type === 'bank') {
    const size = 80;
    const topY = y - size;
    const paths = getIsoBoxPath(x, topY, size, size / 2, size);

    return (
      <g>
        <path d={paths.leftFace} fill={adjustColor(color, -20)} />
        <path d={paths.rightFace} fill={adjustColor(color, -40)} />
        <path d={paths.topFace} fill={adjustColor(color, 20)} />
        {/* Gold door/window */}
        <path
          d={`M ${x - 15} ${y - 15} L ${x + 15} ${y} L ${x + 15} ${y - 40} L ${x - 15} ${y - 55} Z`}
          fill="#FBBF24"
        />
      </g>
    );
  }

  return null;
}

export default IsometricMap;
