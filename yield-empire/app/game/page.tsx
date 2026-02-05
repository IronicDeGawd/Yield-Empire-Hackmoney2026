'use client';

/**
 * Main Game Page - Isometric DeFi Empire view
 */

import { useState, useEffect } from 'react';
import { IsometricMap } from '@/components/game/IsometricMap';
import { GameUI } from '@/components/game/GameUI';
import { INITIAL_ENTITIES, INITIAL_CONNECTIONS } from '@/lib/constants';
import { GameEntity, PlayerProfile, SessionState } from '@/lib/types';
import { useAccount } from 'wagmi';
import { useEnsName, useEnsAvatar } from 'wagmi';

export default function GamePage() {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [entities, setEntities] = useState<GameEntity[]>(INITIAL_ENTITIES);
  const [selectedEntity, setSelectedEntity] = useState<GameEntity | null>(null);

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined });

  // Mock session state (will be replaced with Yellow Network hook)
  const [sessionState, setSessionState] = useState<SessionState>({
    isConnected: false,
    isSessionActive: false,
    actionCount: 0,
    gasSaved: 0,
  });

  // Player profile (will be replaced with ENS integration)
  const player: PlayerProfile | undefined = isConnected && address
    ? {
        address,
        ensName: ensName ?? undefined,
        avatar: ensAvatar ?? undefined,
        empireLevel: 15,
        totalDeposited: entities.reduce((sum, e) => sum + e.deposited, 0),
        totalYield: 25.8,
        prestigeCount: 0,
      }
    : undefined;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    // Set initial dimensions
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Simulate Yellow Network session on wallet connect
  useEffect(() => {
    if (isConnected) {
      setSessionState({
        isConnected: true,
        isSessionActive: true,
        actionCount: 237,
        gasSaved: 47.4,
      });
    } else {
      setSessionState({
        isConnected: false,
        isSessionActive: false,
        actionCount: 0,
        gasSaved: 0,
      });
    }
  }, [isConnected]);

  // Handle building upgrade
  const handleUpgrade = (entityId: string) => {
    setEntities((prev) =>
      prev.map((e) =>
        e.id === entityId ? { ...e, level: e.level + 1 } : e
      )
    );
    setSessionState((prev) => ({
      ...prev,
      actionCount: prev.actionCount + 1,
      gasSaved: prev.gasSaved + 0.4,
    }));
  };

  // Handle compound all
  const handleCompoundAll = () => {
    setSessionState((prev) => ({
      ...prev,
      actionCount: prev.actionCount + 1,
      gasSaved: prev.gasSaved + 0.3,
    }));
  };

  // Handle settlement
  const handleSettle = () => {
    alert(
      `Settling ${sessionState.actionCount} actions!\nEstimated gas saved: $${sessionState.gasSaved.toFixed(2)}`
    );
  };

  // Handle entity click
  const handleEntityClick = (entity: GameEntity) => {
    setSelectedEntity(entity);
  };

  return (
    <div className="w-full h-screen relative overflow-hidden select-none bg-game-bg">
      {/* Background Starfield Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-60 animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3}px`,
              height: `${Math.random() * 3}px`,
              animationDuration: `${Math.random() * 3 + 2}s`,
            }}
          />
        ))}
        {/* Clouds */}
        {[...Array(6)].map((_, i) => (
          <div
            key={`cloud-${i}`}
            className="absolute bg-purple-300/10 blur-xl rounded-full"
            style={{
              top: `${Math.random() * 80 + 10}%`,
              left: `${Math.random() * 80 + 10}%`,
              width: `${100 + Math.random() * 200}px`,
              height: `${50 + Math.random() * 100}px`,
            }}
          />
        ))}
      </div>

      {/* Isometric Game Layer */}
      <div className="absolute inset-0 flex items-center justify-center z-10 transform translate-y-20 scale-110">
        <IsometricMap
          entities={entities}
          connections={INITIAL_CONNECTIONS}
          width={dimensions.width}
          height={dimensions.height}
          onEntityClick={handleEntityClick}
        />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-20">
        <GameUI
          entities={entities}
          player={player}
          session={sessionState}
          onUpgrade={handleUpgrade}
          onCompoundAll={handleCompoundAll}
          onSettle={handleSettle}
        />
      </div>
    </div>
  );
}
