'use client';

/**
 * Player Profile Page - Dynamic ENS route
 *
 * Displays player stats, protocol breakdown, and achievement badges
 * fetched from ENS text records via the guild manager.
 *
 * Route: /profile/[ens] — e.g. /profile/vitalik.eth or /profile/0xAbC...
 */

import { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Zap,
  Trophy,
  Star,
  TrendingUp,
  Shield,
  Loader2,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePlayerProfile, usePlayerIdentity } from '@/hooks/useENS';
import { BUILDING_CONFIGS, COLORS } from '@/lib/constants';
import type { ProtocolId } from '@/lib/types';
import { ConnectButton } from '@rainbow-me/rainbowkit';

/** Achievement badge data derived from player stats */
function getAchievements(empireLevel: number, totalDeposited: number, prestigeCount: number) {
  const badges: { label: string; icon: string; earned: boolean; description: string }[] = [
    {
      label: 'First Deposit',
      icon: '💰',
      earned: totalDeposited > 0,
      description: 'Made your first protocol deposit',
    },
    {
      label: 'Centurion',
      icon: '🏛️',
      earned: totalDeposited >= 100,
      description: 'Deposited $100+ across protocols',
    },
    {
      label: 'Whale',
      icon: '🐋',
      earned: totalDeposited >= 1000,
      description: 'Deposited $1,000+ across protocols',
    },
    {
      label: 'Empire Builder',
      icon: '🏰',
      earned: empireLevel >= 10,
      description: 'Reached Empire Level 10',
    },
    {
      label: 'Master Strategist',
      icon: '🧠',
      earned: empireLevel >= 25,
      description: 'Reached Empire Level 25',
    },
    {
      label: 'Prestige',
      icon: '⭐',
      earned: prestigeCount >= 1,
      description: 'Prestiged at least once',
    },
  ];
  return badges;
}

export default function ProfilePage({ params }: { params: Promise<{ ens: string }> }) {
  const { ens } = use(params);
  const decodedName = decodeURIComponent(ens);

  const { address: connectedAddress } = useAccount();
  const identity = usePlayerIdentity();
  const { profile, isLoading, error } = usePlayerProfile(decodedName);

  // Determine if this is the connected user's own profile
  const isOwnProfile =
    connectedAddress &&
    (decodedName.toLowerCase() === connectedAddress.toLowerCase() ||
      decodedName.toLowerCase() === identity.ensName?.toLowerCase());

  const displayName = profile?.ensName || decodedName;
  const shortAddress = profile?.address
    ? `${profile.address.slice(0, 6)}\u2026${profile.address.slice(-4)}`
    : '';

  const achievements = getAchievements(
    profile?.empireLevel ?? 0,
    profile?.totalDeposited ?? 0,
    profile?.prestigeCount ?? 0,
  );

  return (
    <div className="min-h-screen bg-game-bg text-white">
      {/* Header */}
      <header className="bg-game-bg/80 backdrop-blur-md border-b border-game-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link
            href="/game"
            className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Game
          </Link>
          <ConnectButton showBalance={false} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-purple-400" />
            <span className="ml-3 text-gray-400">Loading profile\u2026</span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">Failed to load profile for &quot;{decodedName}&quot;</p>
            <Link href="/game" className="text-purple-400 hover:text-purple-300 underline">
              Return to game
            </Link>
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <div className="bg-game-panel border-2 border-game-border rounded-xl p-6 mb-6">
              <div className="flex items-center gap-6">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-xl border-2 border-yellow-500 overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 shrink-0">
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={displayName}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name & Level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold truncate">{displayName}</h1>
                    <span className="text-sm bg-purple-600 px-2 py-0.5 rounded text-purple-200 shrink-0">
                      Lv.{profile?.empireLevel ?? 1}
                    </span>
                    {isOwnProfile && (
                      <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  {shortAddress && (
                    <p className="text-gray-400 text-sm font-mono">{shortAddress}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Empire Level"
                value={String(profile?.empireLevel ?? 1)}
                icon={<Star size={20} className="text-yellow-400" />}
              />
              <StatCard
                label="Total Deposited"
                value={`$${(profile?.totalDeposited ?? 0).toLocaleString()}`}
                icon={<TrendingUp size={20} className="text-green-400" />}
              />
              <StatCard
                label="Total Yield"
                value={`$${(profile?.totalYield ?? 0).toFixed(2)}`}
                icon={<Zap size={20} className="text-purple-400" />}
              />
              <StatCard
                label="Prestige"
                value={String(profile?.prestigeCount ?? 0)}
                icon={<Shield size={20} className="text-pink-400" />}
              />
            </div>

            {/* Protocol Breakdown — even split of totalDeposited across known protocols */}
            <ProtocolBreakdown totalDeposited={profile?.totalDeposited ?? 0} />

            {/* Achievement Badges */}
            <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Achievements</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {achievements.map((badge) => (
                  <div
                    key={badge.label}
                    className={`border rounded-lg p-3 text-center transition-colors ${
                      badge.earned
                        ? 'border-yellow-500/50 bg-yellow-500/10'
                        : 'border-game-border bg-game-panel opacity-40'
                    }`}
                  >
                    <div className="text-2xl mb-1">{badge.icon}</div>
                    <div className="text-xs font-bold uppercase">{badge.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{badge.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** Reusable stat card component */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-game-panel border-2 border-game-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400 uppercase">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

/** Protocol breakdown derived from player's totalDeposited (even split) */
const PROTOCOL_LIST: { id: ProtocolId; color: string }[] = [
  { id: 'compound', color: COLORS.compound },
  { id: 'aave', color: COLORS.aave },
  { id: 'uniswap', color: COLORS.uniswap },
  { id: 'curve', color: COLORS.curve },
];

function ProtocolBreakdown({ totalDeposited }: { totalDeposited: number }) {
  const perProtocol = totalDeposited / Math.max(PROTOCOL_LIST.length, 1);
  const maxAmount = Math.max(perProtocol, 1);

  return (
    <div className="bg-game-panel border-2 border-game-border rounded-xl p-6 mb-6">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Trophy size={18} className="text-yellow-400" />
        Protocol Breakdown
      </h2>
      {totalDeposited === 0 ? (
        <p className="text-gray-500 text-sm">No deposits yet.</p>
      ) : (
        <div className="space-y-3">
          {PROTOCOL_LIST.map(({ id, color }) => {
            const config = BUILDING_CONFIGS[id];
            return (
              <div key={id} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase">{config.name}</span>
                    <span className="text-sm text-gray-400">{id}</span>
                  </div>
                  <div className="w-full bg-purple-900/50 rounded-full h-2 mt-1">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        backgroundColor: color,
                        width: `${Math.min((perProtocol / maxAmount) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-300 w-20 text-right">
                  ${perProtocol.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
