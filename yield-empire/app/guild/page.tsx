'use client';

/**
 * Guild Management Page
 *
 * Displays guild info from ENS text records, member leaderboard from subgraph,
 * and join/create guild actions via subdomain creation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Trophy,
  Shield,
  Crown,
  Plus,
  ArrowLeft,
  Zap,
  Target,
  ChevronRight,
  Swords,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient } from 'wagmi';
import { usePlayerIdentity, useGuildProfile, useGuildMembers } from '@/hooks/useENS';
import { usePublicClient } from 'wagmi';
import {
  createGuildMember,
  getPlayerProfile,
  isValidENSName,
} from '@/lib/ens/guild-manager';
import type { PlayerProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
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

// Guild name for the hackathon (registered on Sepolia)
const DEMO_GUILD = 'yield-empire.eth';

export default function GuildPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const identity = usePlayerIdentity();

  // Route guard: redirect to landing if wallet not connected
  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  const [guildName, setGuildName] = useState(DEMO_GUILD);
  const [memberLabel, setMemberLabel] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Guild data from ENS
  const {
    profile: guild,
    isLoading: isGuildLoading,
    error: guildError,
    refetch: refetchGuild,
  } = useGuildProfile(guildName);

  // Guild members from subgraph
  const {
    members,
    isLoading: isMembersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useGuildMembers(guildName);

  // Member profiles for leaderboard
  const [memberProfiles, setMemberProfiles] = useState<PlayerProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Fetch member profiles when members load
  const loadMemberProfiles = useCallback(async () => {
    if (!publicClient || members.length === 0) return;

    setIsLoadingProfiles(true);
    try {
      const profiles = await Promise.all(
        members.slice(0, 20).map((m) => getPlayerProfile(publicClient, m.name, m.owner.id)),
      );
      setMemberProfiles(profiles.sort((a, b) => b.totalDeposited - a.totalDeposited));
    } catch {
      console.error('Failed to load member profiles');
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [publicClient, members]);

  // Auto-load profiles when members change
  useEffect(() => {
    if (members.length > 0 && publicClient) {
      loadMemberProfiles();
    }
  }, [members, publicClient, loadMemberProfiles]);

  // Join guild (create subdomain)
  const handleJoinGuild = async () => {
    if (!walletClient || !address || !memberLabel) return;

    if (!isValidENSName(memberLabel)) {
      setJoinError('Invalid member name. Use lowercase letters, numbers, and hyphens.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    setJoinSuccess(false);

    try {
      await createGuildMember(walletClient, guildName, memberLabel, address);
      setJoinSuccess(true);
      setMemberLabel('');
      setShowJoinForm(false);
      refetchMembers();
      refetchGuild();
    } catch (err) {
      setJoinError(
        err instanceof Error
          ? err.message
          : 'Failed to join guild. You may need to own the parent domain.',
      );
    } finally {
      setIsJoining(false);
    }
  };

  // Demo quest data
  const activeQuests = [
    {
      id: 1,
      title: `Reach $50,000 guild TVL`,
      reward: 5000,
      progress: Math.min(((guild?.tvl ?? 0) / 50000) * 100, 100),
      completed: (guild?.tvl ?? 0) >= 50000,
    },
    {
      id: 2,
      title: 'Recruit 10 members',
      reward: 3000,
      progress: Math.min(((guild?.memberCount ?? members.length) / 10) * 100, 100),
      completed: (guild?.memberCount ?? members.length) >= 10,
    },
    {
      id: 3,
      title: 'Win 5 guild wars',
      reward: 10000,
      progress: Math.min(((guild?.questWins ?? 0) / 5) * 100, 100),
      completed: (guild?.questWins ?? 0) >= 5,
    },
    {
      id: 4,
      title: `Reach guild level 10`,
      reward: 15000,
      progress: Math.min(((guild?.level ?? 1) / 10) * 100, 100),
      completed: (guild?.level ?? 1) >= 10,
    },
  ];

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
            <h1 className="font-pixel text-sm text-gold flex items-center gap-2">
              <Crown className="w-4 h-4" />
              {guild?.name ?? guildName}
            </h1>
            <div className="w-16" />
          </div>

          {/* Main Guild Card */}
          <RetroCard borderColor="gold" className="mb-6">
            <div className="text-center py-4">
              {/* Guild Emblem */}
              <div className="w-20 h-20 mx-auto mb-4 rounded bg-gold/20 border-2 border-gold flex items-center justify-center">
                <Shield className="w-10 h-10 text-gold" />
              </div>

              <div className="flex items-center justify-center gap-2 mb-4">
                <Crown className="w-4 h-4 text-gold" />
                <span className="font-pixel text-lg text-foreground">
                  {guild?.name ?? guildName}
                </span>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto mb-6">
                <div className="stat-box rounded-sm">
                  <div className="font-pixel text-lg text-gold">{guild?.level ?? 1}</div>
                  <div className="font-pixel text-[8px] text-muted-foreground">LEVEL</div>
                </div>
                <div className="stat-box rounded-sm">
                  <div className="font-pixel text-lg text-foreground">
                    {guild?.memberCount ?? members.length}
                  </div>
                  <div className="font-pixel text-[8px] text-muted-foreground">MEMBERS</div>
                </div>
                <div className="stat-box rounded-sm">
                  <div className="font-pixel text-base text-gold">
                    ${(guild?.tvl ?? 0).toLocaleString()}
                  </div>
                  <div className="font-pixel text-[8px] text-muted-foreground">TVL</div>
                </div>
                <div className="stat-box rounded-sm">
                  <div className="font-pixel text-lg text-neon-green">
                    {guild?.questWins ?? 0}
                  </div>
                  <div className="font-pixel text-[8px] text-muted-foreground">QUEST WINS</div>
                </div>
              </div>

              {/* XP Progress */}
              <div className="max-w-md mx-auto">
                <PixelProgress
                  value={guild?.level ?? 1}
                  max={Math.max((guild?.level ?? 1) + 5, 10)}
                  variant="gold"
                  label={`LEVEL ${guild?.level ?? 1} → ${(guild?.level ?? 1) + 1}`}
                />
              </div>

              {guild?.treasuryAddress && (
                <div className="font-retro text-xs text-muted-foreground mt-4">
                  Treasury: {guild.treasuryAddress.slice(0, 10)}&hellip;
                  {guild.treasuryAddress.slice(-8)}
                </div>
              )}

              {isGuildLoading && (
                <div className="font-retro text-sm text-muted-foreground animate-pulse mt-4">
                  Loading guild data from ENS&hellip;
                </div>
              )}
              {guildError && (
                <div className="font-retro text-sm text-destructive mt-4">
                  Failed to load guild: {guildError.message}
                </div>
              )}
            </div>
          </RetroCard>

          {/* Three Panel Grid */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Member Roster — Gold Border */}
            <RetroCard borderColor="gold">
              <RetroCardHeader>
                <RetroCardTitle>
                  <Trophy className="w-4 h-4 text-gold" />
                  MEMBER ROSTER
                </RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                {isMembersLoading || isLoadingProfiles ? (
                  <div className="font-retro text-base text-muted-foreground animate-pulse py-8 text-center">
                    Loading members from ENS&hellip;
                  </div>
                ) : membersError ? (
                  <div className="font-retro text-sm text-destructive py-8 text-center">
                    Failed to load members: {membersError.message}
                  </div>
                ) : members.length === 0 ? (
                  <div className="font-retro text-base text-muted-foreground py-8 text-center">
                    No members found. Be the first to join!
                  </div>
                ) : (
                  <div className="space-y-3 game-scrollbar max-h-80 overflow-y-auto pr-1">
                    {(memberProfiles.length > 0
                      ? memberProfiles
                      : members.map((m) => ({
                          address: m.owner.id,
                          ensName: m.name,
                          empireLevel: 1,
                          totalDeposited: 0,
                          totalEmpireEarned: 0,
                          prestigeCount: 0,
                        }))
                    ).map((member, i) => (
                      <div
                        key={member.address + i}
                        className="flex items-center gap-3 p-2 rounded-sm border border-border hover:border-gold/50 transition-all"
                      >
                        {/* Avatar */}
                        <div className="relative">
                          <div className="w-10 h-10 rounded bg-primary/20 border border-primary flex items-center justify-center">
                            <span className="font-pixel text-primary text-[8px]">
                              {(member.ensName ?? member.address).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {i === 0 && (
                            <div className="absolute -top-1 -right-1">
                              <Crown className="w-3 h-3 text-gold" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-pixel text-[8px] text-foreground truncate">
                            {member.ensName ??
                              `${member.address.slice(0, 6)}\u2026${member.address.slice(-4)}`}
                          </div>
                          <div className="font-retro text-xs text-muted-foreground">
                            LVL {member.empireLevel}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-pixel text-[8px] text-gold">
                            ${member.totalDeposited.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 text-center">
                  <ArcadeButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      refetchMembers();
                      loadMemberProfiles();
                    }}
                  >
                    REFRESH
                  </ArcadeButton>
                </div>
              </RetroCardContent>
            </RetroCard>

            {/* Guild Quests — Green Border */}
            <RetroCard borderColor="green">
              <RetroCardHeader>
                <RetroCardTitle>
                  <Target className="w-4 h-4 text-neon-green" />
                  GUILD QUESTS
                </RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                <div className="space-y-3">
                  {activeQuests.map((quest) => (
                    <div
                      key={quest.id}
                      className={cn(
                        'p-3 rounded-sm border transition-all',
                        quest.completed
                          ? 'border-neon-green/50 bg-neon-green/5'
                          : 'border-border hover:border-neon-green/30',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {quest.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              'font-pixel text-[8px]',
                              quest.completed ? 'text-neon-green line-through' : 'text-foreground',
                            )}
                          >
                            {quest.title.toUpperCase()}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="font-pixel text-[8px] text-gold">
                              +{quest.reward.toLocaleString()} XP
                            </span>
                          </div>
                          {!quest.completed && (
                            <div className="mt-2">
                              <SegmentedProgress
                                value={quest.progress}
                                segments={5}
                                variant="green"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RetroCardContent>
            </RetroCard>

            {/* Actions — Blue Border */}
            <RetroCard borderColor="blue">
              <RetroCardHeader>
                <RetroCardTitle>
                  <Swords className="w-4 h-4 text-neon-blue" />
                  ACTIONS
                </RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent className="space-y-3">
                {/* Join Guild */}
                {!isConnected ? (
                  <div className="text-center py-4">
                    <p className="font-retro text-base text-muted-foreground mb-4">
                      Connect wallet to join
                    </p>
                    <ConnectButton showBalance={false} />
                  </div>
                ) : showJoinForm ? (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="member-label"
                        className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider block mb-1"
                      >
                        Your Member Name
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id="member-label"
                          type="text"
                          name="memberLabel"
                          autoComplete="username"
                          spellCheck={false}
                          value={memberLabel}
                          onChange={(e) => setMemberLabel(e.target.value.toLowerCase())}
                          placeholder="e.g. alice"
                          className="flex-1 bg-input border border-border rounded-sm px-3 py-2 font-retro text-base text-foreground placeholder-muted-foreground focus:outline-none focus:border-gold"
                        />
                        <span className="font-retro text-xs text-muted-foreground shrink-0">
                          .{guildName}
                        </span>
                      </div>
                    </div>

                    {memberLabel && (
                      <div className="font-retro text-xs text-muted-foreground">
                        Your ENS subdomain:{' '}
                        <span className="text-primary">
                          {memberLabel}.{guildName}
                        </span>
                      </div>
                    )}

                    {joinError && (
                      <div className="font-retro text-xs text-destructive">{joinError}</div>
                    )}

                    {joinSuccess && (
                      <div className="font-retro text-xs text-neon-green">
                        Successfully joined! Your subdomain is being created.
                      </div>
                    )}

                    <div className="flex gap-2">
                      <ArcadeButton
                        variant="gold"
                        size="sm"
                        className="flex-1"
                        onClick={handleJoinGuild}
                        disabled={isJoining || !memberLabel}
                      >
                        {isJoining ? 'CREATING...' : 'JOIN'}
                      </ArcadeButton>
                      <ArcadeButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowJoinForm(false)}
                      >
                        CANCEL
                      </ArcadeButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="font-retro text-base text-muted-foreground">
                      Join as <span className="text-foreground">{identity.displayName}</span> to get
                      an ENS subdomain.
                    </p>
                    <ArcadeButton
                      variant="gold"
                      className="w-full"
                      size="md"
                      onClick={() => setShowJoinForm(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      JOIN GUILD
                    </ArcadeButton>
                  </div>
                )}

                <ArcadeButton variant="secondary" className="w-full" size="md" disabled>
                  <Swords className="w-4 h-4 mr-2" />
                  GUILD WAR
                </ArcadeButton>
                <ArcadeButton variant="secondary" className="w-full" size="md" disabled>
                  <Users className="w-4 h-4 mr-2" />
                  INVITE
                </ArcadeButton>
              </RetroCardContent>
            </RetroCard>
          </div>

          {/* Navigation Links */}
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/leaderboard"
              className="retro-card retro-card-purple rounded-sm p-4 flex items-center justify-between hover:border-gold/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Trophy className="text-gold" size={24} />
                <div>
                  <div className="font-pixel text-[10px] text-foreground">LEADERBOARD</div>
                  <div className="font-retro text-sm text-muted-foreground">
                    Global guild &amp; player rankings
                  </div>
                </div>
              </div>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground transition-colors"
                size={20}
              />
            </Link>
            <Link
              href="/settlement"
              className="retro-card retro-card-purple rounded-sm p-4 flex items-center justify-between hover:border-gold/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Zap className="text-neon-green" size={24} />
                <div>
                  <div className="font-pixel text-[10px] text-foreground">SETTLEMENT</div>
                  <div className="font-retro text-sm text-muted-foreground">
                    Manage Yellow Network sessions
                  </div>
                </div>
              </div>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground transition-colors"
                size={20}
              />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
