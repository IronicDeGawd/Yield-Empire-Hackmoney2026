'use client';

/**
 * Settlement Dashboard
 *
 * Shows Yellow Network session status, action breakdown,
 * gas savings calculator, settle button, and real transaction results.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  ArrowLeft,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  DollarSign,
  TrendingUp,
  Send,
  ChevronRight,
  Shield,
  ExternalLink,
  XCircle,
  Loader2,
  Hexagon,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useYellowSession } from '@/hooks/useYellowSession';
import { usePlayerIdentity } from '@/hooks/useENS';
import { GAS_COSTS, INITIAL_ENTITIES, BUILDING_CONFIGS } from '@/lib/constants';
import { SETTLEMENT_CHAINS } from '@/lib/protocols/addresses';
import type { GameEntity, SettlementTx } from '@/lib/types';
import { loadGameState } from '@/lib/game-storage';
import { formatUnits } from 'viem';
import { StarField } from '@/components/ui/StarField';
import { RetroNav } from '@/components/ui/RetroNav';
import {
  RetroCard,
  RetroCardHeader,
  RetroCardTitle,
  RetroCardContent,
} from '@/components/ui/RetroCard';
import { ArcadeButton } from '@/components/ui/ArcadeButton';
import { PixelProgress, SegmentedProgress } from '@/components/ui/PixelProgress';

/** Get block explorer URL for a tx hash on a given chain */
function explorerUrl(chainId: number, hash: string): string {
  if (chainId === SETTLEMENT_CHAINS.SEPOLIA) {
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }
  if (chainId === SETTLEMENT_CHAINS.BASE_SEPOLIA) {
    return `https://sepolia.basescan.org/tx/${hash}`;
  }
  return '#';
}

// Settlement history entry (local state for demo)
interface SettlementRecord {
  id: string;
  timestamp: number;
  actionCount: number;
  gasSaved: number;
  protocols: string[];
  status: 'completed' | 'pending' | 'failed';
  transactions?: SettlementTx[];
}

export default function SettlementPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const identity = usePlayerIdentity();
  const yellowSession = useYellowSession();

  // Route guard: redirect to landing if wallet not connected
  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  // Live game entities from persisted state (reflects actual deposits from game page)
  const [gameEntities, setGameEntities] = useState<GameEntity[]>(INITIAL_ENTITIES);

  useEffect(() => {
    if (!address) return;
    const saved = loadGameState(address);
    if (saved?.entities) {
      setGameEntities(saved.entities);
    }
  }, [address]);

  // Settlement history (populated from real settlements only)
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);

  // Action breakdown from real tracked data
  const ACTION_DISPLAY: Record<string, { label: string; icon: string; gasCost: number }> = {
    UPGRADE_BUILDING: { label: 'Upgrades', icon: '⬆️', gasCost: GAS_COSTS.upgrade },
    COMPOUND_YIELD: { label: 'Compounds', icon: '🔄', gasCost: GAS_COSTS.compound },
    DEPOSIT_TO_PROTOCOL: { label: 'Deposits', icon: '📥', gasCost: GAS_COSTS.deposit },
    CONTRIBUTE_TO_GUILD: { label: 'Guild', icon: '🎁', gasCost: GAS_COSTS.guildContribute },
    CLAIM_REWARDS: { label: 'Claims', icon: '🌾', gasCost: GAS_COSTS.claim },
  };

  const actionBreakdown = useMemo(() => {
    const breakdown = yellowSession.actionBreakdown;
    if (!breakdown || Object.keys(breakdown).length === 0) return [];

    return Object.entries(breakdown)
      .map(([type, count]) => {
        const display = ACTION_DISPLAY[type] ?? {
          label: type,
          icon: '📌',
          gasCost: 0.4,
        };
        return {
          type: display.label,
          icon: display.icon,
          count,
          gasCost: display.gasCost,
          totalSaved: count * display.gasCost,
        };
      })
      .filter((a) => a.count > 0);
  }, [yellowSession.actionBreakdown]);

  // Handle settlement
  const handleSettle = async () => {
    const confirmed = confirm(
      `Settle ${yellowSession.actionCount} actions?\n\nTotal deposited: $${totalDeposited.toLocaleString()}\nEstimated gas saved: $${yellowSession.gasSaved.toFixed(2)}\n\nThis will close your Yellow Network session and execute batched on-chain transactions.`,
    );

    if (confirmed) {
      try {
        await yellowSession.settleSession(gameEntities);

        // Add to history from settlement result
        if (yellowSession.lastSettlement) {
          const result = yellowSession.lastSettlement;
          const protocols = result.transactions
            .filter((tx) => tx.status === 'confirmed')
            .map((tx) => tx.protocolName);

          setSettlements((prev) => [
            {
              id: result.sessionId.slice(0, 10) + '\u2026' + result.sessionId.slice(-6),
              timestamp: result.timestamp,
              actionCount: result.actionCount,
              gasSaved: result.gasSaved,
              protocols,
              status: 'completed',
              transactions: result.transactions,
            },
            ...prev,
          ]);
        }
      } catch (err) {
        console.error('Settlement failed:', err);
      }
    }
  };

  // Protocol allocation summary — uses live game state, not static defaults
  const protocolAllocations = gameEntities.map((entity) => ({
    name: BUILDING_CONFIGS[entity.protocol].name,
    protocol: entity.protocol,
    deposited: entity.deposited,
    color: entity.color,
  }));

  const totalDeposited = gameEntities.reduce((s, e) => s + e.deposited, 0);

  // Count unique chains in last settlement
  const lastResult = yellowSession.lastSettlement;
  const settledChains = lastResult
    ? new Set(lastResult.transactions.map((tx) => tx.chain)).size
    : 0;

  return (
    <div className="page-scrollable bg-background relative overflow-hidden cloud-bg text-foreground">
      {/* Background effects */}
      <StarField />
      <div className="grid-overlay absolute inset-0" />

      {/* Navigation */}
      <RetroNav />

      {/* Content */}
      <main id="main-content" className="relative pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto relative z-10">
          {/* Top Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/game"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-pixel text-[10px]">BACK</span>
            </Link>
            <h1 className="font-pixel text-sm text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              SETTLEMENT DASHBOARD
              <Zap className="w-4 h-4 text-primary" />
            </h1>
            <div className="w-16" />
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Session Status Panel */}
            <RetroCard borderColor="purple">
              <RetroCardHeader>
                <RetroCardTitle>SESSION STATUS</RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent className="space-y-4">
                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded flex items-center justify-center ${
                      yellowSession.isSessionActive
                        ? 'bg-neon-green/20 border border-neon-green'
                        : yellowSession.isConnected
                          ? 'bg-gold/20 border border-gold'
                          : 'bg-muted border border-border'
                    }`}
                  >
                    {yellowSession.isSessionActive ? (
                      <Hexagon className="w-5 h-5 text-neon-green" />
                    ) : yellowSession.isConnected ? (
                      <Clock className="w-5 h-5 text-gold" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div
                      className={`font-pixel text-[10px] ${
                        yellowSession.isSessionActive
                          ? 'text-neon-green'
                          : yellowSession.isConnected
                            ? 'text-gold'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {yellowSession.isSessionActive
                        ? 'SESSION ACTIVE'
                        : yellowSession.isConnected
                          ? 'CONNECTED'
                          : 'DISCONNECTED'}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Wifi className="w-3 h-3" />
                      <span className="font-retro text-sm">
                        {yellowSession.isSessionActive
                          ? 'NitroRPC/0.4'
                          : yellowSession.isConnected
                            ? 'Awaiting session'
                            : 'Not connected'}
                      </span>
                    </div>
                  </div>
                </div>

                {yellowSession.sessionId && (
                  <div className="font-retro text-xs text-muted-foreground">
                    Session: {yellowSession.sessionId.slice(0, 10)}&hellip;
                    {yellowSession.sessionId.slice(-8)}
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="stat-box rounded-sm">
                    <div className="font-pixel text-[8px] text-muted-foreground mb-1">ACTIONS</div>
                    <div className="font-pixel text-sm text-gold">
                      {yellowSession.actionCount}
                    </div>
                  </div>
                  <div className="stat-box rounded-sm">
                    <div className="font-pixel text-[8px] text-muted-foreground mb-1">
                      DEPOSITED
                    </div>
                    <div className="font-pixel text-sm text-foreground">
                      ${totalDeposited.toLocaleString()}
                    </div>
                  </div>
                  <div className="stat-box rounded-sm">
                    <div className="font-pixel text-[8px] text-muted-foreground mb-1">
                      GAS SAVED
                    </div>
                    <div className="font-pixel text-sm text-neon-green">
                      ${yellowSession.gasSaved.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Session Progress */}
                {yellowSession.isSessionActive && yellowSession.actionCount > 0 && (
                  <PixelProgress
                    value={yellowSession.actionCount}
                    max={Math.max(yellowSession.actionCount, 20)}
                    variant="gold"
                    label="SESSION PROGRESS"
                  />
                )}

                {yellowSession.error && (
                  <div className="font-retro text-sm text-destructive bg-destructive/10 rounded-sm p-3 border border-destructive/30">
                    {yellowSession.error}
                  </div>
                )}

                {/* Action Buttons */}
                {yellowSession.isSessionActive && yellowSession.actionCount > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <ArcadeButton
                      variant="gold"
                      size="md"
                      className="w-full"
                      onClick={handleSettle}
                      disabled={yellowSession.isSettling || totalDeposited === 0}
                    >
                      {yellowSession.isSettling ? 'SETTLING...' : totalDeposited === 0 ? 'NO DEPOSITS' : 'SETTLE NOW'}
                    </ArcadeButton>
                    <ArcadeButton variant="secondary" size="md" className="w-full" disabled>
                      EXTEND +24H
                    </ArcadeButton>
                  </div>
                )}
              </RetroCardContent>
            </RetroCard>

            {/* Action Breakdown Panel */}
            <RetroCard borderColor="purple">
              <RetroCardHeader>
                <RetroCardTitle>ACTION BREAKDOWN</RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                {actionBreakdown.length === 0 ? (
                  <div className="font-retro text-base text-muted-foreground py-8 text-center">
                    No actions in current session.
                    <br />
                    Start playing to see your action breakdown.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {actionBreakdown.map((action) => (
                        <div
                          key={action.type}
                          className="stat-box rounded-sm flex flex-col items-center py-3"
                        >
                          <div className="text-2xl mb-1">{action.icon}</div>
                          <div className="font-pixel text-[8px] text-muted-foreground">
                            {action.type.toUpperCase()}
                          </div>
                          <div className="font-pixel text-sm text-gold">x{action.count}</div>
                        </div>
                      ))}
                    </div>

                    {/* Total Savings Highlight */}
                    <div className="border-2 border-neon-green rounded-sm p-4 text-center bg-neon-green/5">
                      <div className="font-pixel text-[10px] text-neon-green mb-1">YOU SAVED!</div>
                      <div className="font-pixel text-xl text-neon-green">
                        ${yellowSession.gasSaved.toFixed(2)}
                      </div>
                    </div>
                  </>
                )}
              </RetroCardContent>
            </RetroCard>
          </div>

          {/* Last Settlement Results */}
          {lastResult && (
            <RetroCard borderColor="green" className="mb-6">
              <RetroCardHeader>
                <RetroCardTitle>
                  <CheckCircle size={16} className="text-neon-green" />
                  SETTLEMENT COMPLETE
                </RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                <p className="font-retro text-base text-muted-foreground mb-4">
                  {lastResult.actionCount} actions settled in {lastResult.transactions.length}{' '}
                  transactions across {settledChains} chain{settledChains !== 1 ? 's' : ''}
                </p>

                <div className="space-y-2">
                  {lastResult.transactions.map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between stat-box rounded-sm p-3"
                    >
                      <div className="flex items-center gap-3">
                        {tx.status === 'confirmed' ? (
                          <CheckCircle size={16} className="text-neon-green" />
                        ) : tx.status === 'failed' ? (
                          <XCircle size={16} className="text-destructive" />
                        ) : (
                          <Loader2 size={16} className="text-gold animate-spin" />
                        )}
                        <div>
                          <span className="font-pixel text-[10px] text-foreground">
                            {tx.protocolName}
                          </span>
                          <span className="font-retro text-sm text-muted-foreground ml-2">
                            {tx.chain}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-pixel text-[10px] text-gold">
                          {formatUnits(tx.amount, 6)} USDC
                        </span>
                        {tx.hash && tx.status === 'confirmed' && (
                          <a
                            href={explorerUrl(tx.chainId, tx.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-retro text-xs text-neon-blue hover:text-foreground flex items-center gap-1"
                          >
                            {tx.hash.slice(0, 8)}&hellip;{tx.hash.slice(-6)}
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {tx.status === 'failed' && (
                          <span className="font-retro text-xs text-destructive">
                            {tx.error ?? 'Failed'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </RetroCardContent>
            </RetroCard>
          )}

          {/* Gas Savings Calculator */}
          <RetroCard borderColor="purple" className="mb-6">
            <RetroCardHeader>
              <RetroCardTitle>
                <DollarSign size={16} className="text-neon-green" />
                GAS SAVINGS CALCULATOR
              </RetroCardTitle>
            </RetroCardHeader>
            <RetroCardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="stat-box rounded-sm">
                  <div className="font-pixel text-[8px] text-muted-foreground mb-2">
                    WITHOUT YELLOW
                  </div>
                  <div className="font-pixel text-lg text-destructive">
                    ${(yellowSession.actionCount * 0.45).toFixed(2)}
                  </div>
                  <div className="font-retro text-xs text-muted-foreground mt-1">
                    {yellowSession.actionCount} actions &times; ~$0.45
                  </div>
                </div>

                <div className="stat-box rounded-sm">
                  <div className="font-pixel text-[8px] text-muted-foreground mb-2">
                    WITH YELLOW
                  </div>
                  <div className="font-pixel text-lg text-neon-green">$0.00</div>
                  <div className="font-retro text-xs text-muted-foreground mt-1">
                    All actions gasless
                  </div>
                </div>

                <div className="border-2 border-neon-green rounded-sm p-3 text-center bg-neon-green/5">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp size={14} className="text-neon-green" />
                    <span className="font-pixel text-[8px] text-neon-green">YOU SAVE</span>
                  </div>
                  <div className="font-pixel text-xl text-neon-green">
                    ${yellowSession.gasSaved.toFixed(2)}
                  </div>
                  <div className="font-retro text-xs text-neon-green/60 mt-1">
                    {yellowSession.actionCount > 0
                      ? '100% gas reduction'
                      : 'Start playing to save'}
                  </div>
                </div>
              </div>
            </RetroCardContent>
          </RetroCard>

          {/* Protocol Allocations */}
          <RetroCard borderColor="purple" className="mb-6">
            <RetroCardHeader>
              <RetroCardTitle>
                <Send size={16} className="text-primary" />
                SETTLEMENT ALLOCATIONS
              </RetroCardTitle>
            </RetroCardHeader>
            <RetroCardContent>
              <p className="font-retro text-base text-muted-foreground mb-4">
                On settlement, your batched actions will execute real DeFi transactions across these
                protocols:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {protocolAllocations.map((alloc) => (
                  <div key={alloc.protocol} className="stat-box rounded-sm">
                    <div className="flex items-center gap-2 mb-2 justify-center">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: alloc.color }}
                      />
                      <span className="font-pixel text-[8px] text-foreground">{alloc.name}</span>
                    </div>
                    <div className="font-pixel text-sm text-gold">
                      ${alloc.deposited.toLocaleString()}
                    </div>
                    <div className="font-retro text-xs text-muted-foreground capitalize">
                      {alloc.protocol}
                    </div>
                  </div>
                ))}
              </div>
            </RetroCardContent>
          </RetroCard>

          {/* Not connected state */}
          {!isConnected && (
            <RetroCard borderColor="default" className="mb-6 text-center py-8">
              <WifiOff className="text-muted-foreground mx-auto mb-4" size={48} />
              <h3 className="font-pixel text-xs text-foreground mb-2">CONNECT TO GET STARTED</h3>
              <p className="font-retro text-base text-muted-foreground mb-6">
                Connect your wallet and start a game session to see your settlement dashboard.
              </p>
            </RetroCard>
          )}

          {/* Settlement History */}
          <RetroCard borderColor="purple" className="mb-6">
            <RetroCardHeader>
              <RetroCardTitle>
                <Clock size={16} />
                SETTLEMENT HISTORY
              </RetroCardTitle>
            </RetroCardHeader>
            <RetroCardContent>
              {settlements.length === 0 ? (
                <div className="font-retro text-base text-muted-foreground py-8 text-center">
                  No settlements yet. Complete your first game session!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="font-pixel text-[8px] text-muted-foreground text-left py-3 px-2">
                          TIME
                        </th>
                        <th className="font-pixel text-[8px] text-muted-foreground text-center py-3 px-2">
                          ACTIONS
                        </th>
                        <th className="font-pixel text-[8px] text-muted-foreground text-center py-3 px-2">
                          GAS SAVED
                        </th>
                        <th className="font-pixel text-[8px] text-muted-foreground text-right py-3 px-2">
                          STATUS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((record, idx) => (
                        <tr
                          key={`${record.id}-${idx}`}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <span className="font-retro text-base text-foreground">
                              {new Date(record.timestamp).toLocaleTimeString()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="font-pixel text-xs text-gold">
                              {record.actionCount}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="font-retro text-base text-neon-green">
                              ${record.gasSaved.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            {record.status === 'completed' ? (
                              <div className="flex items-center justify-end gap-1">
                                <CheckCircle className="w-4 h-4 text-neon-green" />
                                <span className="font-pixel text-[8px] text-neon-green">OK</span>
                              </div>
                            ) : record.status === 'failed' ? (
                              <div className="flex items-center justify-end gap-1">
                                <XCircle className="w-4 h-4 text-destructive" />
                                <span className="font-pixel text-[8px] text-destructive">
                                  FAIL
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Loader2 className="w-4 h-4 text-gold animate-spin" />
                                <span className="font-pixel text-[8px] text-gold">PENDING</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </RetroCardContent>
          </RetroCard>

          {/* Navigation Link */}
          <Link
            href="/guild"
            className="block retro-card retro-card-purple rounded-sm p-4 hover:border-gold/60 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="text-primary" size={24} />
                <div>
                  <div className="font-pixel text-[10px] text-foreground">GUILD MANAGEMENT</div>
                  <div className="font-retro text-sm text-muted-foreground">
                    View your guild, members &amp; quests
                  </div>
                </div>
              </div>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground transition-colors"
                size={20}
              />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
