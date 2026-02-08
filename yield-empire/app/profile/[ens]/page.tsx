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
  Zap,
  Trophy,
  Star,
  TrendingUp,
  Shield,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePlayerProfile, usePlayerIdentity } from '@/hooks/useENS';
import { BUILDING_CONFIGS, COLORS } from '@/lib/constants';
import type { ProtocolId } from '@/lib/types';
import { StarField } from '@/components/ui/StarField';
import { RetroNav } from '@/components/ui/RetroNav';
import {
  RetroCard,
  RetroCardHeader,
  RetroCardTitle,
  RetroCardContent,
} from '@/components/ui/RetroCard';

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
    <div className="page-scrollable bg-background relative overflow-hidden cloud-bg text-foreground">
      {/* Background effects */}
      <StarField />
      <div className="grid-overlay absolute inset-0" />

      {/* Navigation */}
      <RetroNav />

      <main className="relative pt-24 px-4 pb-12">
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Back Link */}
          <div className="mb-6">
            <Link
              href="/game"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              <span className="font-pixel text-[10px]">BACK TO GAME</span>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary" />
              <span className="ml-3 font-retro text-base text-muted-foreground">
                Loading profile&hellip;
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="font-retro text-base text-destructive mb-4">
                Failed to load profile for &quot;{decodedName}&quot;
              </p>
              <Link href="/game" className="font-retro text-base text-primary hover:text-gold">
                Return to game
              </Link>
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <RetroCard borderColor="gold" className="mb-6">
                <div className="flex items-center gap-6">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded border-2 border-gold overflow-hidden bg-primary/20 shrink-0 flex items-center justify-center">
                    {profile?.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={displayName}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-pixel text-2xl text-primary">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name & Level */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="font-pixel text-sm text-foreground truncate">{displayName}</h1>
                      <span className="font-pixel text-[8px] bg-primary/30 px-2 py-0.5 rounded-sm text-primary shrink-0">
                        Lv.{profile?.empireLevel ?? 1}
                      </span>
                      {isOwnProfile && (
                        <span className="font-pixel text-[8px] bg-gold/20 text-gold px-2 py-0.5 rounded-sm shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    {shortAddress && (
                      <p className="font-retro text-sm text-muted-foreground">{shortAddress}</p>
                    )}
                  </div>
                </div>
              </RetroCard>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="stat-box rounded-sm">
                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <Star size={16} className="text-gold" />
                    <span className="font-pixel text-[8px] text-muted-foreground">EMPIRE LVL</span>
                  </div>
                  <div className="font-pixel text-lg text-gold">
                    {profile?.empireLevel ?? 1}
                  </div>
                </div>
                <div className="stat-box rounded-sm">
                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <TrendingUp size={16} className="text-neon-green" />
                    <span className="font-pixel text-[8px] text-muted-foreground">DEPOSITED</span>
                  </div>
                  <div className="font-pixel text-lg text-gold">
                    ${(profile?.totalDeposited ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="stat-box rounded-sm">
                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <Zap size={16} className="text-primary" />
                    <span className="font-pixel text-[8px] text-muted-foreground">$EMPIRE</span>
                  </div>
                  <div className="font-pixel text-lg text-gold">
                    {(profile?.totalEmpireEarned ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="stat-box rounded-sm">
                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <Shield size={16} className="text-neon-pink" />
                    <span className="font-pixel text-[8px] text-muted-foreground">PRESTIGE</span>
                  </div>
                  <div className="font-pixel text-lg text-gold">
                    {profile?.prestigeCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Protocol Breakdown */}
              <ProtocolBreakdown totalDeposited={profile?.totalDeposited ?? 0} />

              {/* Achievement Badges */}
              <RetroCard borderColor="purple">
                <RetroCardHeader>
                  <RetroCardTitle>
                    <Trophy size={16} className="text-gold" />
                    ACHIEVEMENTS
                  </RetroCardTitle>
                </RetroCardHeader>
                <RetroCardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {achievements.map((badge) => (
                      <div
                        key={badge.label}
                        className={`border rounded-sm p-3 text-center transition-colors ${
                          badge.earned
                            ? 'border-gold/50 bg-gold/10'
                            : 'border-border bg-muted/20 opacity-40'
                        }`}
                      >
                        <div className="text-2xl mb-1">{badge.icon}</div>
                        <div className="font-pixel text-[8px] text-foreground uppercase">
                          {badge.label}
                        </div>
                        <div className="font-retro text-xs text-muted-foreground mt-1">
                          {badge.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </RetroCardContent>
              </RetroCard>
            </>
          )}
        </div>
      </main>
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
    <RetroCard borderColor="purple" className="mb-6">
      <RetroCardHeader>
        <RetroCardTitle>
          <Trophy size={16} className="text-gold" />
          PROTOCOL BREAKDOWN
        </RetroCardTitle>
      </RetroCardHeader>
      <RetroCardContent>
        {totalDeposited === 0 ? (
          <p className="font-retro text-base text-muted-foreground">No deposits yet.</p>
        ) : (
          <div className="space-y-3">
            {PROTOCOL_LIST.map(({ id, color }) => {
              const config = BUILDING_CONFIGS[id];
              return (
                <div key={id} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-pixel text-[8px] text-foreground uppercase">
                        {config.name}
                      </span>
                      <span className="font-pixel text-[8px] text-muted-foreground">{id}</span>
                    </div>
                    <div className="pixel-progress rounded-sm mt-1">
                      <div
                        className="pixel-progress-fill transition-all"
                        style={{
                          backgroundColor: color,
                          width: `${Math.min((perProtocol / maxAmount) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="font-pixel text-[10px] text-foreground w-20 text-right">
                    ${perProtocol.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </RetroCardContent>
    </RetroCard>
  );
}
