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
 *   3. Upgrade buildings (costs $EMPIRE tokens)
 *   4. Compound yields (reinvest deposited USDC)
 *   5. Contribute $EMPIRE to guild for cooperative bonuses
 *   6. Settle → close state channel → execute real protocol txs → mint $EMPIRE
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BuildingPopup } from '@/components/game/BuildingPopup';
import type { HoverInfo } from '@/components/game/PixiIsometricMap';
import { GameUI } from '@/components/game/GameUI';
import { SettleConfirmDialog } from '@/components/game/SettleConfirmDialog';
import { INITIAL_ENTITIES, INITIAL_CONNECTIONS, YIELD_MULTIPLIER_PER_LEVEL, getUpgradeCost } from '@/lib/constants';
import { GameEntity, PlayerProfile } from '@/lib/types';
import { useAccount } from 'wagmi';
import { useEnsName, useEnsAvatar } from 'wagmi';
import { STAR_DATA } from '@/components/game/pixi/effects/Starfield';
import { useYellowSession } from '@/hooks/useYellowSession';
import { useProtocolRates } from '@/hooks/useProtocolRates';
import { DepositPanel } from '@/components/game/DepositPanel';
import { WelcomeModal } from '@/components/game/WelcomeModal';
import { proxyAvatarUrl } from '@/lib/ens/guild-manager';
import { saveGameState, loadGameState, clearGameState } from '@/lib/game-storage';

// Dynamic import with SSR disabled - PixiJS requires browser APIs (WebGL, canvas)
// This prevents white screen crashes on page refresh by ensuring the component
// only loads after the browser environment is ready
const PixiIsometricMap = dynamic(
  () => import('@/components/game/PixiIsometricMap').then(mod => mod.PixiIsometricMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading game...</div>
      </div>
    ),
  }
);

/** Calculate empire level from total deposited and action count */
function calcEmpireLevel(totalDeposited: number, actionCount: number): number {
  // Level 1 at $0, +1 per $100 deposited, +1 per 10 actions, capped at 99
  const depositLevel = Math.floor(totalDeposited / 100);
  const actionLevel = Math.floor(actionCount / 10);
  return Math.min(1 + depositLevel + actionLevel, 99);
}

/** Calculate daily $EMPIRE earning rate for an entity based on deposit, rate, and level */
function entityDailyEmpire(e: GameEntity): number {
  const levelMultiplier = 1 + e.level * YIELD_MULTIPLIER_PER_LEVEL;
  return (e.deposited * e.yieldRate * levelMultiplier) / 100 / 365;
}

export default function GamePage() {
  const router = useRouter();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [entities, setEntities] = useState<GameEntity[]>(INITIAL_ENTITIES);
  const [selectedEntity, setSelectedEntity] = useState<GameEntity | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [empireTokens, setEmpireTokens] = useState(0);
  const [totalEmpireEarned, setTotalEmpireEarned] = useState(0);
  const [guildContributed, setGuildContributed] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  // Debounced save ref for token accrual timer
  const lastSaveRef = useRef(0);

  // Retry limit for Yellow Network auto-connect (max 4 attempts)
  const MAX_CONNECT_ATTEMPTS = 4;
  const connectAttemptsRef = useRef(0);

  // Wallet connection
  const { address, isConnected } = useAccount();

  // Route guard: redirect to landing if wallet not connected
  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined });

  // ── Restore game state from localStorage on mount ───────────────────
  useEffect(() => {
    if (!address) return;
    const saved = loadGameState(address);
    if (saved) {
      setEntities(saved.entities);
      setEmpireTokens(saved.empireTokens);
      setTotalEmpireEarned(saved.totalEmpireEarned);
      setGuildContributed(saved.guildContributed ?? 0);
    }
  }, [address]);

  // ── Show welcome tutorial on first visit ────────────────────────────
  useEffect(() => {
    try {
      if (!localStorage.getItem('yield-empire:skip-tutorial')) {
        setShowWelcome(true);
      }
    } catch {
      // SSR or private browsing
    }
  }, []);

  // Yellow Network session
  const yellowSession = useYellowSession();

  // Live protocol APY rates
  const { rates: protocolRates } = useProtocolRates();

  // Sync live rates into entities when rates change
  useEffect(() => {
    setEntities((prev) => {
      let changed = false;
      const updated = prev.map((e) => {
        const rate = protocolRates[e.protocol];
        if (rate && (e.yieldRate !== rate.apy || e.rateSource !== rate.source)) {
          changed = true;
          return { ...e, yieldRate: rate.apy, rateSource: rate.source };
        }
        return e;
      });
      return changed ? updated : prev;
    });
  }, [protocolRates]);

  // Player profile — empire level is dynamic based on deposits + actions
  const totalDeposited = entities.reduce((sum, e) => sum + e.deposited, 0);
  const empireLevel = calcEmpireLevel(totalDeposited, yellowSession.actionCount);

  const player: PlayerProfile | undefined =
    isConnected && address
      ? {
        address,
        ensName: ensName ?? undefined,
        avatar: proxyAvatarUrl(ensAvatar) ?? undefined,
        empireLevel,
        totalDeposited,
        totalEmpireEarned,
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

  // ── $EMPIRE accrual timer ──────────────────────────────────────────────
  // Accrues $EMPIRE every 2 seconds (demo speed: 1 tick = ~10 min of real time)
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;

  useEffect(() => {
    if (!ysSessionActive) return;

    const interval = setInterval(() => {
      let tickEmpire = 0;
      for (const e of entitiesRef.current) {
        if (e.deposited > 0) {
          // Each tick = ~10 minutes worth of $EMPIRE (720 ticks/day at 2s intervals)
          tickEmpire += entityDailyEmpire(e) / 720;
        }
      }
      if (tickEmpire > 0) {
        setEmpireTokens((prev) => prev + tickEmpire);
        setTotalEmpireEarned((prev) => prev + tickEmpire);

        // Debounced save: persist to localStorage every 10 seconds
        const now = Date.now();
        if (address && now - lastSaveRef.current > 10_000) {
          lastSaveRef.current = now;
          // Read latest state from refs to avoid stale closures
          setEmpireTokens((et) => {
            setTotalEmpireEarned((te) => {
              setGuildContributed((gc) => {
                saveGameState(address, {
                  entities: entitiesRef.current,
                  empireTokens: et + tickEmpire,
                  totalEmpireEarned: te + tickEmpire,
                  guildContributed: gc,
                });
                return gc;
              });
              return te;
            });
            return et;
          });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ysSessionActive, address]);

  // ── Auto-connect to Yellow Network (max 4 attempts) ────────────────

  useEffect(() => {
    if (isConnected && !ysConnected && !ysConnecting && connectAttemptsRef.current < MAX_CONNECT_ATTEMPTS) {
      connectAttemptsRef.current++;
      ysConnect().catch((err) => {
        console.error(`Yellow Network connect attempt ${connectAttemptsRef.current}/${MAX_CONNECT_ATTEMPTS} failed:`, err);
      });
    }
  }, [isConnected, ysConnected, ysConnecting, ysConnect]);

  // Reset attempt counter on successful connection
  useEffect(() => {
    if (ysConnected) {
      connectAttemptsRef.current = 0;
    }
  }, [ysConnected]);

  // Auto-create session after Yellow Network connects
  useEffect(() => {
    if (ysConnected && !ysSessionActive && !ysConnecting) {
      ysCreateSession().catch((err) => {
        console.error('Failed to create Yellow Network session:', err);
      });
    }
  }, [ysConnected, ysSessionActive, ysConnecting, ysCreateSession]);

  // ── Persist helper ──────────────────────────────────────────────────
  const persistState = useCallback(() => {
    if (!address) return;
    saveGameState(address, {
      entities: entitiesRef.current,
      empireTokens,
      totalEmpireEarned,
      guildContributed,
    });
  }, [address, empireTokens, totalEmpireEarned, guildContributed]);

  // ── Game actions ─────────────────────────────────────────────────────

  // Deposit USDC to a building (allocate to protocol)
  const handleDeposit = useCallback(async (entityId: string, amount: number) => {
    if (amount <= 0) return;

    const entity = entitiesRef.current.find((e) => e.id === entityId);
    if (!entity) return;

    // Optimistic update
    setEntities((prev) =>
      prev.map((e) => (e.id === entityId ? { ...e, deposited: e.deposited + amount } : e))
    );

    try {
      await yellowSession.performAction(
        { type: 'DEPOSIT_TO_PROTOCOL', protocol: entity.protocol, amount },
        { entities: entitiesRef.current, timestamp: Date.now() }
      );
      persistState();
    } catch (err) {
      console.error('Failed to submit deposit action:', err);
      setEntities((prev) =>
        prev.map((e) => (e.id === entityId ? { ...e, deposited: e.deposited - amount } : e))
      );
    }
  }, [yellowSession, persistState]);

  // Upgrade building (costs $EMPIRE tokens)
  const handleUpgrade = useCallback(async (entityId: string) => {
    const entity = entitiesRef.current.find((e) => e.id === entityId);
    if (!entity) return;

    const cost = getUpgradeCost(entity.level);
    if (empireTokens < cost) return;

    // Deduct upgrade cost from $EMPIRE balance
    setEmpireTokens((prev) => prev - cost);
    setEntities((prev) =>
      prev.map((e) => (e.id === entityId ? { ...e, level: e.level + 1 } : e))
    );

    try {
      await yellowSession.performAction(
        { type: 'UPGRADE_BUILDING', buildingId: entityId },
        { entities, timestamp: Date.now() }
      );
      persistState();
    } catch (err) {
      console.error('Failed to submit upgrade action:', err);
      // Revert both level and token cost
      setEmpireTokens((prev) => prev + cost);
      setEntities((prev) =>
        prev.map((e) => (e.id === entityId ? { ...e, level: e.level - 1 } : e))
      );
    }
  }, [yellowSession, entities, empireTokens, persistState]);

  // Compound all — reinvest $EMPIRE across buildings proportionally
  const handleCompoundAll = useCallback(async () => {
    if (empireTokens <= 0) return;

    const tokensToCompound = empireTokens;
    const totalDep = entities.reduce((s, e) => s + e.deposited, 0);

    // Distribute tokens proportionally to each building's share
    if (totalDep > 0) {
      setEntities((prev) =>
        prev.map((e) => {
          const share = e.deposited / totalDep;
          return { ...e, deposited: e.deposited + tokensToCompound * share };
        })
      );
    }
    setEmpireTokens(0);

    try {
      await yellowSession.performAction(
        { type: 'COMPOUND_YIELD' },
        { entities, empireTokens: tokensToCompound, timestamp: Date.now() }
      );
      persistState();
    } catch (err) {
      console.error('Failed to submit compound action:', err);
      // Revert: remove compounded amount from buildings
      if (totalDep > 0) {
        setEntities((prev) =>
          prev.map((e) => {
            const share = e.deposited / (totalDep + tokensToCompound);
            return { ...e, deposited: e.deposited - tokensToCompound * share };
          })
        );
      }
      setEmpireTokens(tokensToCompound);
    }
  }, [yellowSession, entities, empireTokens, persistState]);

  // Contribute to guild
  const handleGuildContribute = useCallback(async (amount: number) => {
    if (amount <= 0 || amount > empireTokens) return;

    setEmpireTokens((prev) => prev - amount);
    setGuildContributed((prev) => prev + amount);

    try {
      await yellowSession.performAction(
        { type: 'CONTRIBUTE_TO_GUILD', amount },
        { entities, guildContributed: guildContributed + amount, timestamp: Date.now() }
      );
      persistState();
    } catch (err) {
      console.error('Failed to submit guild contribution:', err);
      setEmpireTokens((prev) => prev + amount);
      setGuildContributed((prev) => prev - amount);
    }
  }, [yellowSession, entities, empireTokens, guildContributed, persistState]);

  // Settlement — passes entities for real protocol execution
  const [isSettleConfirmOpen, setIsSettleConfirmOpen] = useState(false);

  const handleSettle = useCallback(() => {
    if (totalDeposited === 0) return;
    setIsSettleConfirmOpen(true);
  }, [totalDeposited]);

  const handleSettleConfirmed = useCallback(async () => {
    setIsSettleConfirmOpen(false);
    try {
      const allSucceeded = await yellowSession.settleSession(entities, {
        empireLevel,
        totalEmpireEarned,
        ensName: ensName ?? undefined,
      });

      if (allSucceeded) {
        // Only clear persisted state and reset game on full success
        if (address) clearGameState(address);
        setEntities(INITIAL_ENTITIES);
        setEmpireTokens(0);
        setTotalEmpireEarned(0);
        setGuildContributed(0);
      } else {
        // Partial failure - show which transactions failed, preserve state
        const failed = yellowSession.lastSettlement?.transactions
          .filter(tx => tx.status === 'failed')
          .map(tx => tx.protocolName)
          .join(', ');
        alert(`Some transactions failed: ${failed || 'unknown'}. Your game state has been preserved.`);
      }
    } catch (err) {
      console.error('Settlement failed:', err);
      alert('Settlement failed. Please try again.');
    }
  }, [yellowSession, entities, empireLevel, totalEmpireEarned, ensName, address]);

  // Handle entity click
  const handleEntityClick = (entity: GameEntity) => {
    setSelectedEntity(entity);
  };

  return (
    <div id="main-content" className="w-full h-screen relative overflow-hidden select-none bg-background cloud-bg">
      {/* Background Starfield Effect - Pre-computed positions */}
      <div className="absolute inset-0 pointer-events-none">
        {STAR_DATA.map((star, i) => (
          <div
            key={`star-${i}`}
            className="absolute rounded-full bg-gold opacity-60 animate-twinkle"
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
      <div className="grid-overlay absolute inset-0 pointer-events-none" />

      {/* PixiJS Isometric Game Layer */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <PixiIsometricMap
          entities={entities}
          connections={INITIAL_CONNECTIONS}
          width={dimensions.width}
          height={dimensions.height}
          onEntityClick={handleEntityClick}
          onEntityHover={setHoverInfo}
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
          empireTokens={empireTokens}
          isConnecting={yellowSession.isConnecting}
          isSettling={yellowSession.isSettling}
          connectionError={yellowSession.error}
          onRetryConnect={() => {
            connectAttemptsRef.current = 0;
            ysConnect().catch((err) => {
              console.error('Retry connection failed:', err);
            });
          }}
          onUpgrade={handleUpgrade}
          onDeposit={() => setIsDepositOpen(true)}
          onDepositToBuilding={handleDeposit}
          onCompoundAll={handleCompoundAll}
          onSettle={handleSettle}
          onGuildContribute={handleGuildContribute}
        />
      </div>

      {/* Building Hover Popup */}
      {hoverInfo && (
        <BuildingPopup
          entity={hoverInfo.entity}
          screenX={hoverInfo.screenX}
          screenY={hoverInfo.screenY}
        />
      )}

      {/* Cross-chain Deposit Modal */}
      <DepositPanel
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
      />

      {/* Settlement Confirmation Dialog */}
      <SettleConfirmDialog
        isOpen={isSettleConfirmOpen}
        entities={entities}
        actionCount={yellowSession.actionCount}
        gasSaved={yellowSession.gasSaved}
        onConfirm={handleSettleConfirmed}
        onCancel={() => setIsSettleConfirmOpen(false)}
      />

      {/* Welcome Tutorial Modal */}
      <WelcomeModal
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
        onDontShowAgain={() => {
          setShowWelcome(false);
          try {
            localStorage.setItem('yield-empire:skip-tutorial', '1');
          } catch {
            // Silently ignore
          }
        }}
      />
    </div>
  );
}
