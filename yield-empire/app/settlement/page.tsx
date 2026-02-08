'use client';

/**
 * Settlement Dashboard
 *
 * Shows Yellow Network session status, action breakdown,
 * gas savings calculator, settle button, and real transaction results.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowLeft,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  DollarSign,
  TrendingUp,
  Send,
  ChevronRight,
  Shield,
  ExternalLink,
  XCircle,
  Loader2,
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useYellowSession } from '@/hooks/useYellowSession';
import { usePlayerIdentity } from '@/hooks/useENS';
import { GAS_COSTS, INITIAL_ENTITIES, BUILDING_CONFIGS } from '@/lib/constants';
import { SETTLEMENT_CHAINS } from '@/lib/protocols/addresses';
import type { SettlementTx } from '@/lib/types';
import { formatUnits } from 'viem';

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
  const { isConnected } = useAccount();
  const identity = usePlayerIdentity();
  const yellowSession = useYellowSession();

  // Settlement history (populated from real settlements only)
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);

  // Action breakdown from real tracked data
  const ACTION_DISPLAY: Record<string, { label: string; color: string; gasCost: number }> = {
    UPGRADE_BUILDING: { label: 'Upgrades', color: 'text-purple-400', gasCost: GAS_COSTS.upgrade },
    COMPOUND_YIELD: { label: 'Compounds', color: 'text-green-400', gasCost: GAS_COSTS.compound },
    DEPOSIT_TO_PROTOCOL: { label: 'Deposits', color: 'text-yellow-400', gasCost: GAS_COSTS.deposit },
    CONTRIBUTE_TO_GUILD: { label: 'Guild Contributions', color: 'text-pink-400', gasCost: GAS_COSTS.guildContribute },
    CLAIM_REWARDS: { label: 'Claims', color: 'text-blue-400', gasCost: GAS_COSTS.claim },
  };

  const actionBreakdown = useMemo(() => {
    const breakdown = yellowSession.actionBreakdown;
    if (!breakdown || Object.keys(breakdown).length === 0) return [];

    return Object.entries(breakdown)
      .map(([type, count]) => {
        const display = ACTION_DISPLAY[type] ?? { label: type, color: 'text-gray-400', gasCost: 0.4 };
        return {
          type: display.label,
          count,
          gasCost: display.gasCost,
          totalSaved: count * display.gasCost,
          color: display.color,
        };
      })
      .filter((a) => a.count > 0);
  }, [yellowSession.actionBreakdown]);

  // Handle settlement
  const handleSettle = async () => {
    const confirmed = confirm(
      `Settle ${yellowSession.actionCount} actions?\n\nEstimated gas saved: $${yellowSession.gasSaved.toFixed(2)}\n\nThis will close your Yellow Network session and execute batched on-chain transactions.`,
    );

    if (confirmed) {
      try {
        await yellowSession.settleSession(INITIAL_ENTITIES);

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

  // Protocol allocation summary
  const protocolAllocations = INITIAL_ENTITIES.map((entity) => ({
    name: BUILDING_CONFIGS[entity.protocol].name,
    protocol: entity.protocol,
    deposited: entity.deposited,
    color: entity.color,
  }));

  // Count unique chains in last settlement
  const lastResult = yellowSession.lastSettlement;
  const settledChains = lastResult
    ? new Set(lastResult.transactions.map((tx) => tx.chain)).size
    : 0;

  return (
    <div className="page-scrollable bg-game-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-game-bg/80 backdrop-blur-md border-b border-game-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/game"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm">Back to Game</span>
            </Link>
            <div className="w-px h-6 bg-game-border" />
            <div className="flex items-center gap-2">
              <Activity className="text-green-400" size={24} />
              <span className="font-bold text-xl">Settlement</span>
            </div>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Session Status Banner */}
          <div
            className={`bg-game-panel border-2 rounded-xl p-6 ${
              yellowSession.isSessionActive
                ? 'border-green-500/50'
                : yellowSession.isConnected
                  ? 'border-yellow-500/50'
                  : 'border-game-border'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Status indicator */}
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    yellowSession.isSessionActive
                      ? 'bg-green-500/20'
                      : yellowSession.isConnected
                        ? 'bg-yellow-500/20'
                        : 'bg-gray-500/20'
                  }`}
                >
                  {yellowSession.isSessionActive ? (
                    <Wifi className="text-green-400" size={28} />
                  ) : yellowSession.isConnected ? (
                    <Clock className="text-yellow-400" size={28} />
                  ) : (
                    <WifiOff className="text-gray-500" size={28} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {yellowSession.isSessionActive
                      ? 'Session Active'
                      : yellowSession.isConnected
                        ? 'Connected (No Session)'
                        : 'Disconnected'}
                  </h2>
                  <div className="text-sm text-gray-400">
                    {yellowSession.isSessionActive ? (
                      <>
                        Yellow Network State Channel &middot;{' '}
                        <span className="text-green-400">NitroRPC/0.4</span>
                      </>
                    ) : yellowSession.isConnected ? (
                      'WebSocket connected, awaiting session creation'
                    ) : (
                      'Connect wallet and start a game session'
                    )}
                  </div>
                  {yellowSession.sessionId && (
                    <div className="text-xs text-gray-600 font-mono mt-1">
                      Session: {yellowSession.sessionId.slice(0, 10)}&hellip;
                      {yellowSession.sessionId.slice(-8)}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {yellowSession.actionCount}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    Actions
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    ${yellowSession.gasSaved.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    Gas Saved
                  </div>
                </div>
              </div>
            </div>

            {yellowSession.error && (
              <div className="mt-4 text-sm text-red-400 bg-red-900/20 rounded-lg p-3">
                {yellowSession.error}
              </div>
            )}
          </div>

          {/* Last Settlement Results */}
          {lastResult && (
            <div className="bg-game-panel border-2 border-green-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle size={20} className="text-green-400" />
                Settlement Complete
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {lastResult.actionCount} actions settled in{' '}
                {lastResult.transactions.length} transactions across{' '}
                {settledChains} chain{settledChains !== 1 ? 's' : ''}
              </p>

              <div className="space-y-2">
                {lastResult.transactions.map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-game-bg rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      {tx.status === 'confirmed' ? (
                        <CheckCircle size={16} className="text-green-400" />
                      ) : tx.status === 'failed' ? (
                        <XCircle size={16} className="text-red-400" />
                      ) : (
                        <Loader2 size={16} className="text-yellow-400 animate-spin" />
                      )}
                      <div>
                        <span className="text-sm font-bold">
                          {tx.protocolName}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {tx.chain}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-yellow-400">
                        {formatUnits(tx.amount, 6)} USDC
                      </span>
                      {tx.hash && tx.status === 'confirmed' && (
                        <a
                          href={explorerUrl(tx.chainId, tx.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
                        >
                          {tx.hash.slice(0, 8)}&hellip;{tx.hash.slice(-6)}
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {tx.status === 'failed' && (
                        <span className="text-xs text-red-400">
                          {tx.error ?? 'Failed'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Action Breakdown */}
            <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Zap size={20} className="text-yellow-400" />
                Action Breakdown
              </h3>

              {actionBreakdown.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center">
                  No actions in current session.
                  <br />
                  Start playing to see your action breakdown.
                </div>
              ) : (
                <div className="space-y-3">
                  {actionBreakdown.map((action) => (
                    <div key={action.type} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className={action.color}>{action.type}</span>
                          <span className="text-gray-400">
                            {action.count} actions
                          </span>
                        </div>
                        <div className="w-full h-2 bg-game-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                            style={{
                              width: `${(action.count / yellowSession.actionCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-green-400 font-bold w-16 text-right">
                        ${action.totalSaved.toFixed(2)}
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="border-t border-game-border pt-3 flex justify-between text-sm font-bold">
                    <span className="text-white">Total Saved</span>
                    <span className="text-green-400">
                      ${yellowSession.gasSaved.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Gas Savings Calculator */}
            <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-green-400" />
                Gas Savings Calculator
              </h3>

              <div className="space-y-4">
                <div className="bg-game-bg rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">
                    Without Yellow Network
                  </div>
                  <div className="text-3xl font-bold text-red-400">
                    ${(yellowSession.actionCount * 0.45).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {yellowSession.actionCount} actions &times; ~$0.45 avg gas
                  </div>
                </div>

                <div className="bg-game-bg rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">
                    With Yellow Network
                  </div>
                  <div className="text-3xl font-bold text-green-400">$0.00</div>
                  <div className="text-xs text-gray-500 mt-1">
                    All actions gasless in state channel
                  </div>
                </div>

                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} className="text-green-400" />
                    <span className="text-sm font-bold text-green-400">
                      You Save
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-green-400">
                    ${yellowSession.gasSaved.toFixed(2)}
                  </div>
                  <div className="text-xs text-green-400/60 mt-1">
                    {yellowSession.actionCount > 0
                      ? '100% gas reduction during gameplay'
                      : 'Start playing to save on gas'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Protocol Allocations */}
          <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Send size={20} className="text-purple-400" />
              Settlement Allocations
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              On settlement, your batched actions will execute real DeFi
              transactions across these protocols:
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {protocolAllocations.map((alloc) => (
                <div
                  key={alloc.protocol}
                  className="bg-game-bg rounded-lg p-3 border border-game-border/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: alloc.color }}
                    />
                    <span className="text-sm font-bold">{alloc.name}</span>
                  </div>
                  <div className="text-lg font-bold text-yellow-400">
                    ${alloc.deposited.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {alloc.protocol}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settle Button */}
          {yellowSession.isSessionActive && yellowSession.actionCount > 0 && (
            <div className="bg-game-panel border-2 border-yellow-500/30 rounded-xl p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-1">Ready to Settle?</h3>
                  <p className="text-sm text-gray-400">
                    Close your state channel and execute{' '}
                    {yellowSession.actionCount} batched actions as on-chain
                    transactions.
                  </p>
                </div>
                <button
                  onClick={handleSettle}
                  disabled={yellowSession.isSettling}
                  className="btn-gold text-lg px-8 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {yellowSession.isSettling ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Settling&hellip;
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      [ Settle {yellowSession.actionCount} Actions ]
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Not connected state */}
          {!isConnected && (
            <div className="bg-game-panel border-2 border-game-border rounded-xl p-8 text-center">
              <WifiOff className="text-gray-500 mx-auto mb-4" size={48} />
              <h3 className="text-xl font-bold mb-2">Connect to Get Started</h3>
              <p className="text-sm text-gray-400 mb-6">
                Connect your wallet and start a game session to see your
                settlement dashboard.
              </p>
              <ConnectButton showBalance={false} />
            </div>
          )}

          {/* Settlement History */}
          <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock size={20} className="text-gray-400" />
              Settlement History
            </h3>

            {settlements.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">
                No settlements yet. Complete your first game session!
              </div>
            ) : (
              <div className="space-y-3">
                {settlements.map((record, idx) => (
                  <div
                    key={`${record.id}-${idx}`}
                    className="bg-game-bg rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle
                          size={20}
                          className={
                            record.status === 'completed'
                              ? 'text-green-400'
                              : record.status === 'pending'
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }
                        />
                        <div>
                          <div className="font-bold text-sm">
                            {record.actionCount} actions settled
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(record.timestamp).toLocaleString()} &middot;{' '}
                            {record.protocols.join(', ')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-400">
                          ${record.gasSaved.toFixed(2)} saved
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {record.id}
                        </div>
                      </div>
                    </div>

                    {/* Show tx details if available */}
                    {record.transactions && record.transactions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-game-border/50 space-y-1">
                        {record.transactions.map((tx, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {tx.status === 'confirmed' ? (
                                <CheckCircle size={12} className="text-green-400" />
                              ) : (
                                <XCircle size={12} className="text-red-400" />
                              )}
                              <span className="text-gray-400">
                                {tx.protocolName} ({tx.chain})
                              </span>
                            </div>
                            {tx.hash && tx.status === 'confirmed' && (
                              <a
                                href={explorerUrl(tx.chainId, tx.hash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
                              >
                                {tx.hash.slice(0, 8)}&hellip;{tx.hash.slice(-6)}
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <Link
            href="/guild"
            className="block bg-game-panel border-2 border-game-border rounded-xl p-4 hover:bg-purple-900/30 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="text-purple-400" size={24} />
                <div>
                  <div className="font-bold">Guild Management</div>
                  <div className="text-sm text-gray-400">
                    View your guild, members &amp; quests
                  </div>
                </div>
              </div>
              <ChevronRight
                className="text-gray-500 group-hover:text-white transition-colors"
                size={20}
              />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
