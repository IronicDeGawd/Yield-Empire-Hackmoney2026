'use client';

/**
 * PixiApplication - SSR-safe wrapper for PixiJS Application
 * Handles client-side only rendering required by PixiJS
 */

import { Application, extend } from '@pixi/react';
import { Container, Graphics } from 'pixi.js';
import { useEffect, useState, type ReactNode } from 'react';

// Register PixiJS components for JSX usage
extend({ Container, Graphics });

interface PixiApplicationProps {
  width: number;
  height: number;
  children: ReactNode;
}

export function PixiApplication({ width, height, children }: PixiApplicationProps) {
  const [mounted, setMounted] = useState(false);

  // SSR guard - PixiJS requires browser APIs (canvas, WebGL)
  useEffect(() => {
    setMounted(true);
  }, []);

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
    <Application
      width={width}
      height={height}
      backgroundAlpha={0} // Transparent background to show HTML effects behind
      antialias={false} // Pixel-perfect rendering
      resolution={1}
      autoDensity={true}
    >
      {children}
    </Application>
  );
}

export default PixiApplication;
