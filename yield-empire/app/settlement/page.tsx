'use client';

/**
 * Settlement Dashboard
 *
 * Shows Yellow Network session status, action breakdown,
 * gas savings calculator, and settle button.
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
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useYellowSession } from '@/hooks/useYellowSession';
import { usePlayerIdentity } from '@/hooks/useENS';
import { GAS_COSTS, INITIAL_ENTITIES, BUILDING_CONFIGS } from '@/lib/constants';

// Settlement history entry (local state for demo)
interface SettlementRecord {
  id: string;
  timestamp: number;
  actionCount: number;
  gasSaved: number;
  protocols: string[];
  status: 'completed' | 'pending' | 'failed';
}

export default function SettlementPage() {
  const { isConnected } = useAccount();
  const identity = usePlayerIdentity();
  const yellowSession = useYellowSession();

  // Demo settlement history
  const [settlements] = useState<SettlementRecord[]>([
    {
      id: '0xabc\u2026def',
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      actionCount: 23,
      gasSaved: 9.2,
      protocols: ['Compound V3', 'Morpho Blue'],
      status: 'completed',
    },
    {
      id: '0x123\u2026456',
      timestamp: Date.now() - 8 * 60 * 60 * 1000,
      actionCount: 47,
      gasSaved: 18.8,
      protocols: ['Compound V3', 'Aave V3', 'Uniswap V3'],
      status: 'completed',
    },
  ]);

  // Calculate action breakdown from gas costs
  const actionBreakdown = useMemo(() => {
    const count = yellowSession.actionCount;
    if (count === 0) return [];

    // Simulated breakdown based on typical gameplay
    const upgradeCount = Math.floor(count * 0.3);
    const compoundCount = Math.floor(count * 0.25);
    const depositCount = Math.floor(count * 0.3);
    const guildCount = count - upgradeCount - compoundCount - depositCount;

    return [
      {
        type: 'Upgrades',
        count: upgradeCount,
        gasCost: GAS_COSTS.upgrade,
        totalSaved: upgradeCount * GAS_COSTS.upgrade,
        color: 'text-purple-400',
      },
      {
        type: 'Compounds',
        count: compoundCount,
        gasCost: GAS_COSTS.compound,
        totalSaved: compoundCount * GAS_COSTS.compound,
        color: 'text-green-400',
      },
      {
        type: 'Deposits',
        count: depositCount,
        gasCost: GAS_COSTS.deposit,
        totalSaved: depositCount * GAS_COSTS.deposit,
        color: 'text-yellow-400',
      },
      {
        type: 'Guild Contributions',
        count: guildCount,
        gasCost: GAS_COSTS.guildContribute,
        totalSaved: guildCount * GAS_COSTS.guildContribute,
        color: 'text-pink-400',
      },
    ].filter((a) => a.count > 0);
  }, [yellowSession.actionCount]);

  // Handle settlement
  const handleSettle = async () => {
    const confirmed = confirm(
      `Settle ${yellowSession.actionCount} actions?\n\nEstimated gas saved: $${yellowSession.gasSaved.toFixed(2)}\n\nThis will close your Yellow Network session and execute batched on-chain transactions.`,
    );

    if (confirmed) {
      try {
        await yellowSession.settleSession();
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
                      <Clock size={20} className="animate-spin" />
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
                {settlements.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between bg-game-bg rounded-lg p-4"
                  >
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
