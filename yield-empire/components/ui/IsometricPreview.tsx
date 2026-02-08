'use client';

/**
 * IsometricPreview — Lightweight CSS-based isometric scene for the landing page.
 *
 * Renders actual game building sprites arranged in a diamond grid to give
 * visitors a preview of the in-game island system. No PixiJS — just positioned
 * <img> tags with CSS transforms for the isometric effect.
 */

import { useEffect, useState } from 'react';

/** Island + building layout data (matches game's diamond grid) */
const ISLANDS = [
  { id: 'compound', name: 'COMPOUND', sprite: '/assets/sprites/treasury-building.png', gridX: 0, gridY: 1.5, color: '#00d395', apy: '4.2%' },
  { id: 'aave', name: 'AAVE', sprite: '/assets/sprites/shard-building.png', gridX: 1.5, gridY: 0, color: '#9b7dff', apy: '3.8%' },
  { id: 'uniswap', name: 'UNI-V3', sprite: '/assets/sprites/building1.png', gridX: 1.5, gridY: 3, color: '#ff007a', apy: '5.1%' },
  { id: 'morpho', name: 'MORPHO', sprite: '/assets/sprites/building2.png', gridX: 3, gridY: 1.5, color: '#ffed4a', apy: '6.3%' },
] as const;

/** Convert grid coords to isometric pixel position */
function gridToIso(gx: number, gy: number, tileW: number, tileH: number) {
  return {
    x: (gx - gy) * (tileW / 2),
    y: (gx + gy) * (tileH / 2),
  };
}

export function IsometricPreview() {
  // Delay render for SSR safety (sprites reference window dimensions)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="aspect-video flex items-center justify-center">
        <div className="font-pixel text-[10px] text-muted-foreground animate-pulse">
          Loading preview...
        </div>
      </div>
    );
  }

  const tileW = 180;
  const tileH = 90;

  // Compute positions and center the scene
  const positions = ISLANDS.map((island) => ({
    ...island,
    ...gridToIso(island.gridX, island.gridY, tileW, tileH),
  }));

  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x));
  const minY = Math.min(...positions.map((p) => p.y));
  const maxY = Math.max(...positions.map((p) => p.y));
  const sceneW = maxX - minX + tileW;
  const sceneH = maxY - minY + tileH + 60; // extra space for buildings

  return (
    <div className="aspect-video relative overflow-hidden">
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute rounded-full bg-gold animate-twinkle"
            style={{
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              top: `${15 + (i * 11) % 70}%`,
              left: `${10 + (i * 13) % 80}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* Isometric scene container */}
      <div
        className="absolute"
        style={{
          width: sceneW,
          height: sceneH,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%)`,
        }}
      >
        {/* Render islands sorted back-to-front (painter's algorithm) */}
        {positions
          .sort((a, b) => a.gridX + a.gridY - (b.gridX + b.gridY))
          .map((island, idx) => {
            const px = island.x - minX;
            const py = island.y - minY;

            return (
              <div
                key={island.id}
                className="absolute group"
                style={{
                  left: px,
                  top: py,
                  width: tileW,
                  zIndex: island.gridX + island.gridY,
                }}
              >
                {/* Island platform */}
                <div className="relative flex flex-col items-center">
                  <img
                    src="/assets/sprites/island.png"
                    alt=""
                    width={tileW}
                    height={tileW * 0.875}
                    className="w-full"
                    style={{ imageRendering: 'pixelated' }}
                    draggable={false}
                  />

                  {/* Building sprite on top of island */}
                  <div
                    className="absolute animate-float"
                    style={{
                      bottom: '52%',
                      animationDelay: `${idx * 0.5}s`,
                      animationDuration: `${3 + idx * 0.3}s`,
                    }}
                  >
                    <img
                      src={island.sprite}
                      alt={island.name}
                      width={56}
                      height={56}
                      className="drop-shadow-lg"
                      style={{ imageRendering: 'pixelated' }}
                      draggable={false}
                    />
                  </div>

                  {/* Protocol label */}
                  <div
                    className="absolute font-pixel text-[7px] tracking-wider whitespace-nowrap"
                    style={{
                      bottom: '8%',
                      color: island.color,
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    {island.name}
                  </div>

                  {/* APY badge */}
                  <div
                    className="absolute font-pixel text-[8px] px-1.5 py-0.5 rounded-sm"
                    style={{
                      top: '10%',
                      right: '10%',
                      backgroundColor: `${island.color}30`,
                      color: island.color,
                      border: `1px solid ${island.color}50`,
                    }}
                  >
                    {island.apy}
                  </div>
                </div>
              </div>
            );
          })}

      </div>

      {/* Scanline overlay for retro feel */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />
    </div>
  );
}
