'use client';

/**
 * GameUI - Overlay UI for the game with building cards, stats, and controls
 *
 * Phase 5: Full game loop
 *   - Per-building deposit input (allocate USDC to protocol)
 *   - Accrued yield display with compound button
 *   - Guild contribution from accrued yield
 *   - Connecting/settling loading indicators
 *   - Navigation to guild, leaderboard, settlement, profile
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Lock,
  ArrowDownUp,
  Loader2,
  Trophy,
  Users,
  BarChart3,
  User,
} from 'lucide-react';
import { GameEntity, PlayerProfile, GuildProfile, SessionState } from '@/lib/types';
import { getUpgradeCost } from '@/lib/constants';
import { ConnectButton } from '@rainbow-me/rainbowkit';

/** Maps each protocol to its settlement chain + USDC source */
const PROTOCOL_CHAIN_INFO: Record<string, { chain: string; usdc: string; color: string }> = {
  aave:     { chain: 'Base Sepolia', usdc: 'Aave USDC (via Treasury)', color: 'text-blue-400' },
  compound: { chain: 'Sepolia',      usdc: 'Circle USDC',              color: 'text-green-400' },
  uniswap:  { chain: 'Sepolia',      usdc: 'Circle USDC',              color: 'text-pink-400' },
  curve:    { chain: 'Sepolia',      usdc: 'Circle USDC (Morpho)',     color: 'text-yellow-400' },
  yearn:    { chain: 'Simulated',    usdc: 'N/A',                      color: 'text-gray-400' },
};

interface GameUIProps {
  entities: GameEntity[];
  player?: PlayerProfile;
  guild?: GuildProfile;
  session?: SessionState;
  accruedYield?: number;
  isConnecting?: boolean;
  isSettling?: boolean;
  connectionError?: string | null;
  onUpgrade?: (entityId: string) => void;
  onCompoundAll?: () => void;
  onSettle?: () => void;
  onDeposit?: () => void;
  onDepositToBuilding?: (entityId: string, amount: number) => void;
  onGuildContribute?: (amount: number) => void;
  onRetryConnect?: () => void;
}

export function GameUI({
  entities,
  player,
  guild,
  session,
  accruedYield = 0,
  isConnecting = false,
  isSettling = false,
  onUpgrade,
  onCompoundAll,
  onSettle,
  onDeposit,
  onDepositToBuilding,
  onGuildContribute,
  connectionError,
  onRetryConnect,
}: GameUIProps) {
  // Per-building deposit amount inputs
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
  const [guildAmount, setGuildAmount] = useState('');

  // Calculate total stats
  const totalTVL = entities.reduce((sum, e) => sum + e.deposited, 0);
  const totalYield = entities.reduce(
    (sum, e) => sum + (e.deposited * e.yieldRate * (1 + e.level * 0.1)) / 100 / 365,
    0,
  );

  const getEntityIconSrc = (entity: GameEntity) => {
    if (entity.type === 'crystal') return '/assets/sprites/shard-building.png';
    if (entity.type === 'bank') return '/assets/sprites/treasury-building.png';
    if (entity.type === 'factory') {
      return entity.protocol === 'uniswap'
        ? '/assets/sprites/building1.png'
        : '/assets/sprites/building2.png';
    }
    return '/assets/sprites/building1.png';
  };

  const handleBuildingDeposit = (entityId: string) => {
    const amount = parseFloat(depositAmounts[entityId] || '0');
    if (amount > 0 && onDepositToBuilding) {
      onDepositToBuilding(entityId, amount);
      setDepositAmounts((prev) => ({ ...prev, [entityId]: '' }));
    }
  };

  const handleGuildContribute = () => {
    const amount = parseFloat(guildAmount || '0');
    if (amount > 0 && onGuildContribute) {
      onGuildContribute(amount);
      setGuildAmount('');
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between font-mono">
      {/* Top Bar */}
      <header className="flex items-start justify-between w-full pointer-events-auto">
        {/* User Info - Top Left */}
        <div className="bg-game-panel border-2 border-game-border rounded-xl p-2 px-4 flex items-center gap-4 text-white shadow-lg shadow-purple-900/50">
          {player ? (
            <>
              <Link href={`/profile/${player.ensName || player.address}`} className="shrink-0">
                <div className="w-10 h-10 bg-yellow-600 rounded-md border-2 border-white overflow-hidden hover:border-yellow-400 transition-colors">
                  {player.avatar ? (
                    <img
                      src={player.avatar}
                      alt="avatar"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500" />
                  )}
                </div>
              </Link>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/profile/${player.ensName || player.address}`}
                    className="font-bold text-lg tracking-wide hover:text-yellow-400 transition-colors"
                  >
                    {player.ensName || `${player.address.slice(0, 6)}\u2026${player.address.slice(-4)}`}
                  </Link>
                  <span className="text-xs bg-purple-600 px-1 rounded text-purple-200">
                    Lv.{player.empireLevel}
                  </span>
                </div>
                <div className="flex items-center text-yellow-400 text-sm gap-1">
                  <Zap size={14} fill="currentColor" />
                  <span>{session?.actionCount || 0} actions</span>
                  {isConnecting && (
                    <span className="flex items-center gap-1 text-purple-300 ml-2">
                      <Loader2 size={12} className="animate-spin" />
                      connecting\u2026
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <ConnectButton showBalance={false} />
          )}
        </div>

        {/* Top Right — Settle + Nav */}
        <div className="flex items-center gap-3">
          {/* Navigation links */}
          <nav className="flex items-center gap-1">
            <Link
              href="/guild"
              className="p-2 rounded-lg bg-game-panel border border-game-border text-purple-300 hover:text-white hover:bg-purple-800 transition-colors"
              title="Guild"
            >
              <Users size={18} />
            </Link>
            <Link
              href="/leaderboard"
              className="p-2 rounded-lg bg-game-panel border border-game-border text-purple-300 hover:text-white hover:bg-purple-800 transition-colors"
              title="Leaderboard"
            >
              <Trophy size={18} />
            </Link>
            <Link
              href="/settlement"
              className="p-2 rounded-lg bg-game-panel border border-game-border text-purple-300 hover:text-white hover:bg-purple-800 transition-colors"
              title="Settlement"
            >
              <BarChart3 size={18} />
            </Link>
            {player && (
              <Link
                href={`/profile/${player.ensName || player.address}`}
                className="p-2 rounded-lg bg-game-panel border border-game-border text-purple-300 hover:text-white hover:bg-purple-800 transition-colors"
                title="Profile"
              >
                <User size={18} />
              </Link>
            )}
          </nav>

          {/* Settle Button */}
          {session?.isSessionActive && (
            <button
              onClick={onSettle}
              disabled={isSettling || totalTVL === 0}
              className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700 disabled:cursor-not-allowed text-black font-bold py-2 px-6 rounded-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 transition-all shadow-lg uppercase tracking-wider flex items-center gap-2"
            >
              {isSettling ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Settling\u2026
                </>
              ) : totalTVL === 0 ? (
                '[ No Deposits ]'
              ) : (
                '[ Settle ]'
              )}
            </button>
          )}
        </div>
      </header>

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="pointer-events-auto mt-2 mx-auto max-w-lg bg-red-900/80 border border-red-500 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-red-200">{connectionError}</span>
          {onRetryConnect && (
            <button
              onClick={onRetryConnect}
              className="shrink-0 bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-3 py-1 rounded uppercase"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full mt-4">
        {/* Right Top Info Panel */}
        <div className="self-end pointer-events-auto">
          <div className="bg-game-panel border-2 border-game-border rounded-xl p-4 text-white w-72 shadow-2xl">
            <div className="space-y-1 mb-4 text-sm font-mono">
              <div className="flex justify-between text-gray-300">
                <span>TVL:</span>
                <span className="text-white font-bold">${totalTVL.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Yield:</span>
                <span className="text-green-400 font-bold">${totalYield.toFixed(4)}/day</span>
              </div>
              {accruedYield > 0 && (
                <div className="flex justify-between text-gray-300">
                  <span>Accrued:</span>
                  <span className="text-yellow-300 font-bold">${accruedYield.toFixed(4)}</span>
                </div>
              )}
              {guild && (
                <div className="flex justify-between text-gray-300 items-center">
                  <span>Guild:</span>
                  <span className="text-white flex items-center gap-1">
                    {guild.name}
                    <Lock size={12} className="text-yellow-500" />
                  </span>
                </div>
              )}
              {session?.isSessionActive && (
                <div className="flex justify-between text-gray-300">
                  <span>Gas saved:</span>
                  <span className="text-green-400 font-bold">
                    ~${session.gasSaved.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Compound All */}
            <button
              onClick={onCompoundAll}
              disabled={accruedYield <= 0 || !session?.isSessionActive}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:from-yellow-800 disabled:to-yellow-900 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg flex items-center justify-between uppercase"
            >
              <span>[ Compound All ]</span>
              <div className="w-3 h-3 bg-white rotate-45 transform" />
            </button>

            {/* Guild Contribute */}
            {session?.isSessionActive && accruedYield > 0.001 && (
              <div className="flex gap-1 mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={accruedYield}
                  placeholder="Yield to guild"
                  value={guildAmount}
                  onChange={(e) => setGuildAmount(e.target.value)}
                  aria-label="Amount to contribute to guild"
                  className="flex-1 bg-purple-900/50 border border-purple-600 rounded px-2 py-2 text-xs text-white placeholder-purple-400 outline-none focus:border-yellow-500 w-0"
                />
                <button
                  onClick={handleGuildContribute}
                  className="bg-pink-600 hover:bg-pink-500 text-xs font-bold py-2 px-3 rounded border-b-2 border-pink-800 text-white uppercase shrink-0"
                >
                  Guild
                </button>
              </div>
            )}

            {/* Deposit from Any Chain */}
            {player && (
              <button
                onClick={onDeposit}
                className="w-full mt-2 bg-purple-700 hover:bg-purple-600 text-white font-bold py-2.5 px-4 rounded-lg border border-purple-500 transition-all flex items-center justify-center gap-2 uppercase text-sm"
              >
                <ArrowDownUp size={14} />
                <span>Deposit from Any Chain</span>
              </button>
            )}
          </div>
        </div>

        {/* Spacer to push building bar to bottom */}
        <div className="flex-1" />

        {/* Bottom Building Cards Bar */}
        <div className="w-full pointer-events-auto pb-2">
          <div className="grid grid-cols-4 gap-3 px-3">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="bg-game-panel border-2 border-game-border rounded-xl p-3 text-white relative hover:bg-purple-900/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded border border-white/30 bg-purple-900/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={getEntityIconSrc(entity)}
                      alt={`${entity.name} icon`}
                      width={24}
                      height={24}
                      className="w-5 h-5 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold uppercase text-sm leading-none">{entity.name}</span>
                    <span className="text-xs text-purple-300">Lv{entity.level}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-300 mb-0.5">
                  {(entity.yieldRate * (1 + entity.level * 0.1)).toFixed(1)}% APY
                  {entity.rateSource === 'live' && <span className="text-[10px] text-green-400 ml-1">[LIVE]</span>}
                  {entity.rateSource === 'estimated' && <span className="text-[10px] text-yellow-400 ml-1">[EST]</span>}
                  {entity.rateSource === 'simulated' && <span className="text-[10px] text-gray-400 ml-1">[SIM]</span>}
                  {' '}&middot; ${entity.deposited.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                {/* Settlement chain & USDC type badge */}
                {PROTOCOL_CHAIN_INFO[entity.protocol] && (
                  <div className="text-[10px] text-purple-400 mb-2 flex items-center gap-1">
                    <span className={`font-bold ${PROTOCOL_CHAIN_INFO[entity.protocol].color}`}>
                      {PROTOCOL_CHAIN_INFO[entity.protocol].chain}
                    </span>
                    <span>&middot;</span>
                    <span>{PROTOCOL_CHAIN_INFO[entity.protocol].usdc}</span>
                  </div>
                )}

                {/* Deposit to building input */}
                {session?.isSessionActive && (
                  <div className="flex gap-1 mb-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="USDC to deposit"
                      value={depositAmounts[entity.id] || ''}
                      onChange={(e) =>
                        setDepositAmounts((prev) => ({ ...prev, [entity.id]: e.target.value }))
                      }
                      aria-label={`Deposit USDC to ${entity.name}`}
                      className="flex-1 bg-purple-900/50 border border-purple-600 rounded px-2 py-1.5 text-xs text-white placeholder-purple-400 outline-none focus:border-yellow-500 w-0"
                    />
                    <button
                      onClick={() => handleBuildingDeposit(entity.id)}
                      className="bg-green-600 hover:bg-green-500 text-xs font-bold py-1.5 px-2 rounded border-b-2 border-green-800 text-white uppercase shrink-0"
                      title="Deposit USDC into this protocol"
                    >
                      +
                    </button>
                  </div>
                )}

                <button
                  onClick={() => onUpgrade?.(entity.id)}
                  disabled={!session?.isSessionActive || accruedYield < getUpgradeCost(entity.level)}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 disabled:text-gray-500 disabled:cursor-not-allowed text-xs font-bold py-1.5 px-2 rounded border-b-2 border-yellow-800 disabled:border-yellow-900 text-black uppercase"
                  title={
                    !session?.isSessionActive
                      ? 'Waiting for Yellow session…'
                      : accruedYield < getUpgradeCost(entity.level)
                        ? `Need $${getUpgradeCost(entity.level).toFixed(2)} yield — you have $${accruedYield.toFixed(2)}. Deposit USDC first, then wait for yield to accrue.`
                        : `Spend $${getUpgradeCost(entity.level).toFixed(2)} accrued yield to upgrade`
                  }
                >
                  {!session?.isSessionActive
                    ? '[ Connecting… ]'
                    : `[ Upgrade · $${getUpgradeCost(entity.level).toFixed(2)} ]`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settling Overlay */}
      {isSettling && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center pointer-events-auto">
          <div className="bg-game-panel border-2 border-yellow-500 rounded-xl p-8 text-center text-white max-w-sm">
            <Loader2 size={48} className="animate-spin mx-auto mb-4 text-yellow-400" />
            <h2 className="text-xl font-bold mb-2">Settling On-Chain</h2>
            <p className="text-gray-400 text-sm">
              Executing protocol transactions across chains. This may take a moment\u2026
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameUI;
