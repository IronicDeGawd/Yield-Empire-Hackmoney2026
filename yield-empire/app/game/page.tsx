'use client';

/**
 * Main Game Page - Isometric DeFi Empire view
 * Uses PixiJS for canvas rendering
 */

import { useState, useEffect } from 'react';
import { PixiIsometricMap } from '@/components/game/PixiIsometricMap';
import { GameUI } from '@/components/game/GameUI';
import { INITIAL_ENTITIES, INITIAL_CONNECTIONS } from '@/lib/constants';
import { GameEntity, PlayerProfile } from '@/lib/types';
import { useAccount } from 'wagmi';
import { useEnsName, useEnsAvatar } from 'wagmi';
import { STAR_DATA, CLOUD_DATA } from '@/components/game/pixi/effects/Starfield';
import { useYellowSession } from '@/hooks/useYellowSession';

export default function GamePage() {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [entities, setEntities] = useState<GameEntity[]>(INITIAL_ENTITIES);
  const [selectedEntity, setSelectedEntity] = useState<GameEntity | null>(null);

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined });

  // Yellow Network session
  const yellowSession = useYellowSession();

  // Player profile (will be replaced with ENS integration)
  const player: PlayerProfile | undefined =
    isConnected && address
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

  // Auto-connect to Yellow Network when wallet connects
  useEffect(() => {
    if (isConnected && !yellowSession.isConnected && !yellowSession.isConnecting) {
      yellowSession.connect().catch((err) => {
        console.error('Failed to connect to Yellow Network:', err);
      });
    }
  }, [isConnected, yellowSession]);

  // Auto-create session after Yellow Network connects
  useEffect(() => {
    if (
      yellowSession.isConnected &&
      !yellowSession.isSessionActive &&
      !yellowSession.isConnecting
    ) {
      yellowSession.createSession().catch((err) => {
        console.error('Failed to create Yellow Network session:', err);
      });
    }
  }, [yellowSession.isConnected, yellowSession.isSessionActive, yellowSession]);

  // Handle building upgrade
  const handleUpgrade = async (entityId: string) => {
    // Optimistically update UI
    setEntities((prev) =>
      prev.map((e) => (e.id === entityId ? { ...e, level: e.level + 1 } : e))
    );

    // Submit action to Yellow Network
    try {
      await yellowSession.performAction(
        { type: 'UPGRADE_BUILDING', buildingId: entityId },
        { entities, timestamp: Date.now() }
      );
    } catch (err) {
      console.error('Failed to submit upgrade action:', err);
      // Revert optimistic update on error
      setEntities((prev) =>
        prev.map((e) => (e.id === entityId ? { ...e, level: e.level - 1 } : e))
      );
    }
  };

  // Handle compound all
  const handleCompoundAll = async () => {
    try {
      await yellowSession.performAction(
        { type: 'COMPOUND_YIELD' },
        { entities, timestamp: Date.now() }
      );
    } catch (err) {
      console.error('Failed to submit compound action:', err);
    }
  };

  // Handle settlement
  const handleSettle = async () => {
    const confirmed = confirm(
      `Settle ${yellowSession.actionCount} actions?\nEstimated gas saved: $${yellowSession.gasSaved.toFixed(2)}`
    );

    if (confirmed) {
      try {
        await yellowSession.settleSession();
        alert('Settlement complete! Actions batched into on-chain transactions.');
      } catch (err) {
        console.error('Settlement failed:', err);
        alert('Settlement failed. Please try again.');
      }
    }
  };

  // Handle entity click
  const handleEntityClick = (entity: GameEntity) => {
    setSelectedEntity(entity);
  };

  return (
    <div className="w-full h-screen relative overflow-hidden select-none bg-game-bg">
      {/* Background Starfield Effect - Pre-computed positions */}
      <div className="absolute inset-0 pointer-events-none">
        {STAR_DATA.map((star, i) => (
          <div
            key={`star-${i}`}
            className="absolute rounded-full bg-white opacity-60 animate-pulse"
            style={{
              top: `${star.y * 100}%`,
              left: `${star.x * 100}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDuration: `${star.pulseSpeed}s`,
            }}
          />
        ))}
        {/* Clouds - Pre-computed positions */}
        {CLOUD_DATA.map((cloud, i) => (
          <div
            key={`cloud-${i}`}
            className="absolute bg-purple-300/10 blur-xl rounded-full"
            style={{
              top: `${cloud.y * 100}%`,
              left: `${cloud.x * 100}%`,
              width: `${cloud.width}px`,
              height: `${cloud.height}px`,
            }}
          />
        ))}
      </div>

      {/* PixiJS Isometric Game Layer */}
      <div className="absolute inset-0 flex items-center justify-center z-10 transform translate-y-20 scale-110">
        <PixiIsometricMap
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
          session={{
            isConnected: yellowSession.isConnected,
            isSessionActive: yellowSession.isSessionActive,
            sessionId: yellowSession.sessionId ?? undefined,
            actionCount: yellowSession.actionCount,
            gasSaved: yellowSession.gasSaved,
          }}
          onUpgrade={handleUpgrade}
          onCompoundAll={handleCompoundAll}
          onSettle={handleSettle}
        />
      </div>
    </div>
  );
}
