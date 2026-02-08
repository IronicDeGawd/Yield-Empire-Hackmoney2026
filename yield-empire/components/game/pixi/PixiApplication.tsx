'use client';

/**
 * PixiApplication - SSR-safe wrapper for PixiJS Application
 * Handles client-side only rendering required by PixiJS
 * 
 * IMPORTANT: The container ref must be available before rendering the Application
 * to avoid passing null to resizeTo, which causes white screen crashes on page refresh.
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
  const appRef = useRef<PixiApp | null>(null);
  const destroyedRef = useRef(false);

  // SSR guard - PixiJS requires browser APIs (canvas, WebGL)
  useEffect(() => {
    destroyedRef.current = false;
    setMounted(true);

    return () => {
      destroyedRef.current = true;
      setMounted(false);
      // Do NOT call app.destroy() here — setting mounted=false unmounts the
      // <Application> component, which lets @pixi/react clean up useTick,
      // resize observers, and the WebGL context in the correct order.
      // Calling destroy() before React unmounts children causes null-pointer
      // crashes in Ticker.remove and ResizePlugin.destroy.
      appRef.current = null;
    };
  }, []);

  // Force canvas resize when tab regains focus or visibility
  // (window resize events don't fire on tab/window switch)
  useEffect(() => {
    if (!mounted) return;
    const forceResize = () => {
      if (destroyedRef.current) return;
      const app = appRef.current;
      if (app?.renderer) {
        try {
          app.renderer.resize(window.innerWidth, window.innerHeight);
        } catch {
          // Renderer may be destroyed — ignore
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') forceResize();
    };
    window.addEventListener('focus', forceResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', forceResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mounted]);

  const handleInit = useCallback(
    (app: PixiApp) => {
      // Guard against init callback firing after component unmount
      if (destroyedRef.current) return;

      app.renderer.background.alpha = 0;
      app.renderer.background.color = 0x000000;
      appRef.current = app;
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
    <div className="w-full h-full">
      {typeof window !== 'undefined' && (
        <Application
          className="pixi-canvas"
          resizeTo={window}
          backgroundAlpha={0}
          backgroundColor={0x000000}
          antialias={false}
          resolution={1}
          autoDensity={true}
          onInit={handleInit}
        >
          {children}
        </Application>
      )}
    </div>
  );
}

export default PixiApplication;
