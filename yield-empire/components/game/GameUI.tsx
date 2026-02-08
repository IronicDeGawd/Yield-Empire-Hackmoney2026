'use client';

/**
 * GameUI - Overlay UI for the game with building cards, stats, and controls
 *
 * Phase 5: Full game loop
 *   - Per-building deposit input (allocate USDC to protocol)
 *   - $EMPIRE token balance display with compound button
 *   - Guild contribution from $EMPIRE balance
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
  aave:     { chain: 'Base Sepolia', usdc: 'Aave USDC (via Treasury)', color: 'text-neon-blue' },
  compound: { chain: 'Sepolia',      usdc: 'Circle USDC',              color: 'text-neon-green' },
  uniswap:  { chain: 'Sepolia',      usdc: 'Circle USDC',              color: 'text-neon-pink' },
  curve:    { chain: 'Sepolia',      usdc: 'Circle USDC (Morpho)',     color: 'text-gold' },
  yearn:    { chain: 'Simulated',    usdc: 'N/A',                      color: 'text-muted-foreground' },
};

interface GameUIProps {
  entities: GameEntity[];
  player?: PlayerProfile;
  guild?: GuildProfile;
  session?: SessionState;
  empireTokens?: number;
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
  empireTokens = 0,
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
  const dailyEmpire = entities.reduce(
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
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="flex items-start justify-between w-full pointer-events-auto">
        {/* User Info - Top Left */}
        <div className="retro-card retro-card-purple p-2 px-4 flex items-center gap-4 text-foreground">
          {player ? (
            <>
              <Link href={`/profile/${player.ensName || player.address}`} className="shrink-0">
                <div className="w-10 h-10 bg-gold/30 rounded-sm border-2 border-gold overflow-hidden hover:border-neon-green transition-colors">
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
                    <div className="w-full h-full bg-gradient-to-br from-primary to-neon-pink" />
                  )}
                </div>
              </Link>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/profile/${player.ensName || player.address}`}
                    className="font-pixel text-[10px] text-foreground hover:text-gold transition-colors"
                  >
                    {player.ensName || `${player.address.slice(0, 6)}\u2026${player.address.slice(-4)}`}
                  </Link>
                  <span className="font-pixel text-[8px] bg-primary/30 px-1.5 py-0.5 rounded-sm text-primary">
                    Lv.{player.empireLevel}
                  </span>
                </div>
                <div className="flex items-center text-gold font-retro text-base gap-1">
                  <Zap size={14} fill="currentColor" />
                  <span>{session?.actionCount || 0} actions</span>
                  {isConnecting && (
                    <span className="flex items-center gap-1 text-primary ml-2">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="font-retro text-sm">connecting{'\u2026'}</span>
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
              className="p-2 rounded-sm retro-card text-muted-foreground hover:text-gold transition-colors"
              title="Guild"
            >
              <Users size={18} />
            </Link>
            <Link
              href="/leaderboard"
              className="p-2 rounded-sm retro-card text-muted-foreground hover:text-gold transition-colors"
              title="Leaderboard"
            >
              <Trophy size={18} />
            </Link>
            <Link
              href="/settlement"
              className="p-2 rounded-sm retro-card text-muted-foreground hover:text-gold transition-colors"
              title="Settlement"
            >
              <BarChart3 size={18} />
            </Link>
            {player && (
              <Link
                href={`/profile/${player.ensName || player.address}`}
                className="p-2 rounded-sm retro-card text-muted-foreground hover:text-gold transition-colors"
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
              className="arcade-btn arcade-btn-gold font-pixel text-[10px] py-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSettling ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Settling{'\u2026'}
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
        <div className="pointer-events-auto mt-2 mx-auto max-w-lg retro-card border-destructive/50 px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-retro text-base text-destructive">{connectionError}</span>
          {onRetryConnect && (
            <button
              onClick={onRetryConnect}
              className="shrink-0 bracket-btn bracket-btn-gold font-pixel text-[8px]"
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
          <div className="retro-card retro-card-purple p-4 text-foreground w-72">
            <div className="space-y-1 mb-4">
              <div className="flex justify-between font-retro text-base text-muted-foreground">
                <span>TVL:</span>
                <span className="text-foreground font-bold">${totalTVL.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-retro text-base text-muted-foreground">
                <span>$EMPIRE/day:</span>
                <span className="text-neon-green font-bold">{dailyEmpire.toFixed(4)}</span>
              </div>
              {empireTokens > 0 && (
                <div className="flex justify-between font-retro text-base text-muted-foreground">
                  <span>$EMPIRE:</span>
                  <span className="text-gold font-bold">{empireTokens.toFixed(4)}</span>
                </div>
              )}
              {guild && (
                <div className="flex justify-between font-retro text-base text-muted-foreground items-center">
                  <span>Guild:</span>
                  <span className="text-foreground flex items-center gap-1">
                    {guild.name}
                    <Lock size={12} className="text-gold" />
                  </span>
                </div>
              )}
              {session?.isSessionActive && (
                <div className="flex justify-between font-retro text-base text-muted-foreground">
                  <span>Gas saved:</span>
                  <span className="text-neon-green font-bold">
                    ~${session.gasSaved.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Compound All */}
            <button
              onClick={onCompoundAll}
              disabled={empireTokens <= 0 || !session?.isSessionActive}
              className="w-full arcade-btn arcade-btn-gold font-pixel text-[10px] py-3 px-4 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between uppercase"
            >
              <span>[ Compound All ]</span>
              <div className="w-3 h-3 bg-foreground rotate-45 transform" />
            </button>

            {/* Guild Contribute */}
            {session?.isSessionActive && empireTokens > 0.001 && (
              <div className="flex gap-1 mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={empireTokens}
                  placeholder="$EMPIRE to guild"
                  value={guildAmount}
                  onChange={(e) => setGuildAmount(e.target.value)}
                  aria-label="Amount to contribute to guild"
                  className="flex-1 bg-secondary border border-border rounded-sm px-2 py-2 font-retro text-sm text-foreground placeholder-muted-foreground outline-none focus:border-gold w-0"
                />
                <button
                  onClick={handleGuildContribute}
                  className="bracket-btn bracket-btn-blue font-pixel text-[8px] py-2 px-3 shrink-0"
                >
                  Guild
                </button>
              </div>
            )}

            {/* Deposit from Any Chain */}
            {player && (
              <button
                onClick={onDeposit}
                className="w-full mt-2 bracket-btn bracket-btn-blue font-pixel text-[8px] py-2.5 px-4 flex items-center justify-center gap-2"
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
                className="retro-card retro-card-purple p-3 text-foreground relative hover:bg-primary/10 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-sm border border-border bg-secondary/30 flex items-center justify-center overflow-hidden">
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
                    <span className="font-pixel text-[9px] uppercase leading-none text-foreground">{entity.name}</span>
                    <span className="font-pixel text-[8px] text-primary">Lv{entity.level}</span>
                  </div>
                </div>
                <div className="font-retro text-sm text-muted-foreground mb-0.5">
                  {entity.yieldRate.toFixed(1)}% APY
                  {entity.rateSource === 'live' && <span className="text-[10px] text-neon-green ml-1">[LIVE]</span>}
                  {entity.rateSource === 'estimated' && <span className="text-[10px] text-gold ml-1">[EST]</span>}
                  {entity.rateSource === 'simulated' && <span className="text-[10px] text-muted-foreground ml-1">[SIM]</span>}
                  {' '}&middot; ${entity.deposited.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                {/* Settlement chain & USDC type badge */}
                {PROTOCOL_CHAIN_INFO[entity.protocol] && (
                  <div className="font-retro text-xs text-muted-foreground mb-2 flex items-center gap-1">
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
                      className="flex-1 bg-secondary border border-border rounded-sm px-2 py-1.5 font-retro text-sm text-foreground placeholder-muted-foreground outline-none focus:border-gold w-0"
                    />
                    <button
                      onClick={() => handleBuildingDeposit(entity.id)}
                      className="bracket-btn bracket-btn-green font-pixel text-[10px] py-1.5 px-2 shrink-0"
                      title="Deposit USDC into this protocol"
                    >
                      +
                    </button>
                  </div>
                )}

                <button
                  onClick={() => onUpgrade?.(entity.id)}
                  disabled={!session?.isSessionActive || empireTokens < getUpgradeCost(entity.level)}
                  className="w-full arcade-btn arcade-btn-gold font-pixel text-[8px] py-1.5 px-2 disabled:opacity-40 disabled:cursor-not-allowed uppercase"
                  title={
                    !session?.isSessionActive
                      ? 'Waiting for Yellow session\u2026'
                      : empireTokens < getUpgradeCost(entity.level)
                        ? `Need ${getUpgradeCost(entity.level).toFixed(2)} $EMPIRE \u2014 you have ${empireTokens.toFixed(2)}`
                        : `Spend ${getUpgradeCost(entity.level).toFixed(2)} $EMPIRE to upgrade`
                  }
                >
                  {!session?.isSessionActive
                    ? '[ Connecting\u2026 ]'
                    : `[ Upgrade \u00b7 ${getUpgradeCost(entity.level).toFixed(2)} $EMPIRE ]`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settling Overlay */}
      {isSettling && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center pointer-events-auto">
          <div className="retro-card retro-card-gold p-8 text-center text-foreground max-w-sm">
            <Loader2 size={48} className="animate-spin mx-auto mb-4 text-gold" />
            <h2 className="font-pixel text-sm mb-2">Settling On-Chain</h2>
            <p className="font-retro text-base text-muted-foreground">
              Executing protocol transactions across chains. This may take a moment...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameUI;
