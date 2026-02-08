'use client';

/**
 * Main Game Page - Isometric DeFi Empire view
 *
 * Phase 5: Full game loop wiring
 *   Wallet → Yellow Network → Gasless actions → Settlement → On-chain DeFi
 *
 * Game loop:
 *   1. Connect wallet → auto-connect Yellow Network → auto-create session
 *   2. Deposit USDC to buildings (allocate to protocols)
 *   3. Upgrade buildings (increase yield multiplier)
 *   4. Compound yields (reinvest accrued yield)
 *   5. Contribute to guild (share yield with guild treasury)
 *   6. Settle → close state channel → execute real protocol txs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PixiIsometricMap } from '@/components/game/PixiIsometricMap';
import { GameUI } from '@/components/game/GameUI';
import { INITIAL_ENTITIES, INITIAL_CONNECTIONS, YIELD_MULTIPLIER_PER_LEVEL } from '@/lib/constants';
import { GameEntity, PlayerProfile } from '@/lib/types';
import { useAccount } from 'wagmi';
import { useEnsName, useEnsAvatar } from 'wagmi';
import { STAR_DATA } from '@/components/game/pixi/effects/Starfield';
import { useYellowSession } from '@/hooks/useYellowSession';
import { DepositPanel } from '@/components/game/DepositPanel';

/** Calculate empire level from total deposited and action count */
function calcEmpireLevel(totalDeposited: number, actionCount: number): number {
  // Level 1 at $0, +1 per $100 deposited, +1 per 10 actions, capped at 99
  const depositLevel = Math.floor(totalDeposited / 100);
  const actionLevel = Math.floor(actionCount / 10);
  return Math.min(1 + depositLevel + actionLevel, 99);
}

/** Calculate daily yield for an entity based on deposit, rate, and level */
function entityDailyYield(e: GameEntity): number {
  const levelMultiplier = 1 + e.level * YIELD_MULTIPLIER_PER_LEVEL;
  return (e.deposited * e.yieldRate * levelMultiplier) / 100 / 365;
}

export default function GamePage() {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [entities, setEntities] = useState<GameEntity[]>(INITIAL_ENTITIES);
  const [selectedEntity, setSelectedEntity] = useState<GameEntity | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [accruedYield, setAccruedYield] = useState(0);
  const [totalYieldEarned, setTotalYieldEarned] = useState(0);
  const [guildContributed, setGuildContributed] = useState(0);

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined });

  // Yellow Network session
  const yellowSession = useYellowSession();

  // Player profile — empire level is dynamic based on deposits + actions
  const totalDeposited = entities.reduce((sum, e) => sum + e.deposited, 0);
  const empireLevel = calcEmpireLevel(totalDeposited, yellowSession.actionCount);

  const player: PlayerProfile | undefined =
    isConnected && address
      ? {
          address,
          ensName: ensName ?? undefined,
          avatar: ensAvatar ?? undefined,
          empireLevel,
          totalDeposited,
          totalYield: totalYieldEarned,
          prestigeCount: 0,
        }
      : undefined;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stable references from Yellow session context
  const {
    isConnected: ysConnected,
    isConnecting: ysConnecting,
    isSessionActive: ysSessionActive,
    connect: ysConnect,
    createSession: ysCreateSession,
  } = yellowSession;

  // ── Yield accrual timer ──────────────────────────────────────────────
  // Accrues yield every 2 seconds (demo speed: 1 tick = ~10 min of real time)
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;

  useEffect(() => {
    if (!ysSessionActive) return;

    const interval = setInterval(() => {
      let tickYield = 0;
      for (const e of entitiesRef.current) {
        if (e.deposited > 0) {
          // Each tick = ~10 minutes worth of yield (720 ticks/day at 2s intervals)
          tickYield += entityDailyYield(e) / 720;
        }
      }
      if (tickYield > 0) {
        setAccruedYield((prev) => prev + tickYield);
        setTotalYieldEarned((prev) => prev + tickYield);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ysSessionActive]);

  // ── Auto-connect to Yellow Network ───────────────────────────────────

  useEffect(() => {
    if (isConnected && !ysConnected && !ysConnecting) {
      ysConnect().catch((err) => {
        console.error('Failed to connect to Yellow Network:', err);
      });
    }
  }, [isConnected, ysConnected, ysConnecting, ysConnect]);

  // Auto-create session after Yellow Network connects
  useEffect(() => {
    if (ysConnected && !ysSessionActive && !ysConnecting) {
      ysCreateSession().catch((err) => {
        console.error('Failed to create Yellow Network session:', err);
      });
    }
  }, [ysConnected, ysSessionActive, ysConnecting, ysCreateSession]);

  // ── Game actions ─────────────────────────────────────────────────────

  // Deposit USDC to a building (allocate to protocol)
  const handleDeposit = useCallback(async (entityId: string, amount: number) => {
    if (amount <= 0) return;

    // Optimistic update
    setEntities((prev) =>
      prev.map((e) => (e.id === entityId ? { ...e, deposited: e.deposited + amount } : e))
    );

    try {
      await yellowSession.performAction(
        { type: 'DEPOSIT_TO_PROTOCOL', protocol: entities.find((e) => e.id === entityId)!.protocol, amount },
        { entities, timestamp: Date.now() }
      );
    } catch (err) {
      console.error('Failed to submit deposit action:', err);
      setEntities((prev) =>
        prev.map((e) => (e.id === entityId ? { ...e, deposited: e.deposited - amount } : e))
      );
    }
  }, [yellowSession, entities]);

  // Upgrade building
  const handleUpgrade = useCallback(async (entityId: string) => {
    setEntities((prev) =>
      prev.map((e) => (e.id === entityId ? { ...e, level: e.level + 1 } : e))
    );

    try {
      await yellowSession.performAction(
        { type: 'UPGRADE_BUILDING', buildingId: entityId },
        { entities, timestamp: Date.now() }
      );
    } catch (err) {
      console.error('Failed to submit upgrade action:', err);
      setEntities((prev) =>
        prev.map((e) => (e.id === entityId ? { ...e, level: e.level - 1 } : e))
      );
    }
  }, [yellowSession, entities]);

  // Compound all — reinvest accrued yield across buildings proportionally
  const handleCompoundAll = useCallback(async () => {
    if (accruedYield <= 0) return;

    const yieldToCompound = accruedYield;
    const totalDep = entities.reduce((s, e) => s + e.deposited, 0);

    // Distribute yield proportionally to each building's share
    if (totalDep > 0) {
      setEntities((prev) =>
        prev.map((e) => {
          const share = e.deposited / totalDep;
          return { ...e, deposited: e.deposited + yieldToCompound * share };
        })
      );
    }
    setAccruedYield(0);

    try {
      await yellowSession.performAction(
        { type: 'COMPOUND_YIELD' },
        { entities, accruedYield: yieldToCompound, timestamp: Date.now() }
      );
    } catch (err) {
      console.error('Failed to submit compound action:', err);
      // Revert: remove compounded yield from buildings
      if (totalDep > 0) {
        setEntities((prev) =>
          prev.map((e) => {
            const share = e.deposited / (totalDep + yieldToCompound);
            return { ...e, deposited: e.deposited - yieldToCompound * share };
          })
        );
      }
      setAccruedYield(yieldToCompound);
    }
  }, [yellowSession, entities, accruedYield]);

  // Contribute to guild
  const handleGuildContribute = useCallback(async (amount: number) => {
    if (amount <= 0 || amount > accruedYield) return;

    setAccruedYield((prev) => prev - amount);
    setGuildContributed((prev) => prev + amount);

    try {
      await yellowSession.performAction(
        { type: 'CONTRIBUTE_TO_GUILD', amount },
        { entities, guildContributed: guildContributed + amount, timestamp: Date.now() }
      );
    } catch (err) {
      console.error('Failed to submit guild contribution:', err);
      setAccruedYield((prev) => prev + amount);
      setGuildContributed((prev) => prev - amount);
    }
  }, [yellowSession, entities, accruedYield, guildContributed]);

  // Settlement — passes entities for real protocol execution
  const handleSettle = useCallback(async () => {
    const confirmed = confirm(
      `Settle ${yellowSession.actionCount} actions?\nEstimated gas saved: $${yellowSession.gasSaved.toFixed(2)}`
    );

    if (confirmed) {
      try {
        await yellowSession.settleSession(entities);
      } catch (err) {
        console.error('Settlement failed:', err);
        alert('Settlement failed. Please try again.');
      }
    }
  }, [yellowSession, entities]);

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
        {/* Cloud sprites now rendered in Pixi layer */}
      </div>

      {/* PixiJS Isometric Game Layer */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
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
          accruedYield={accruedYield}
          isConnecting={yellowSession.isConnecting}
          isSettling={yellowSession.isSettling}
          onUpgrade={handleUpgrade}
          onDeposit={() => setIsDepositOpen(true)}
          onDepositToBuilding={handleDeposit}
          onCompoundAll={handleCompoundAll}
          onSettle={handleSettle}
          onGuildContribute={handleGuildContribute}
        />
      </div>

      {/* Cross-chain Deposit Modal */}
      <DepositPanel
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
      />
    </div>
  );
}
