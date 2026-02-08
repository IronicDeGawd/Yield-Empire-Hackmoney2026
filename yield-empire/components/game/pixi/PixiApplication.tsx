'use client';

/**
 * PixiApplication - SSR-safe wrapper for PixiJS Application
 * Handles client-side only rendering required by PixiJS
 */

import { Application, extend } from '@pixi/react';
import { Application as PixiApp, Container, Graphics, Sprite } from 'pixi.js';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// Register PixiJS components for JSX usage
extend({ Container, Graphics, Sprite });

interface PixiApplicationProps {
  width: number;
  height: number;
  children: ReactNode;
  onInit?: (app: PixiApp) => void;
}

export function PixiApplication({ width, height, children, onInit }: PixiApplicationProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // SSR guard - PixiJS requires browser APIs (canvas, WebGL)
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInit = useCallback(
    (app: PixiApp) => {
      app.renderer.background.alpha = 0;
      app.renderer.background.color = 0x000000;
      onInit?.(app);
    },
    [onInit]
  );

  if (!mounted) {
    return (
      <div
        style={{ width, height }}
        className="bg-game-bg flex items-center justify-center"
      >
        <div className="text-gray-500 animate-pulse">Loading game...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width, height }}>
      <Application
        className="pixi-canvas"
        resizeTo={containerRef}
        backgroundAlpha={0}
        backgroundColor={0x000000}
        antialias={false}
        resolution={1}
        autoDensity={true}
        onInit={handleInit}
      >
        {children}
      </Application>
    </div>
  );
}

export default PixiApplication;
