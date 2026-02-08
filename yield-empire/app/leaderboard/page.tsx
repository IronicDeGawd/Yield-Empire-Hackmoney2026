'use client';

/**
 * Leaderboard Page
 *
 * Shows top guilds by TVL and top players by contribution,
 * all sourced from ENS text records and subgraph queries.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Crown,
  Users,
  Shield,
  Filter,
  ChevronDown,
  Medal,
} from 'lucide-react';
import { usePublicClient, useAccount } from 'wagmi';
import { usePlayerIdentity } from '@/hooks/useENS';
import { getGuildProfile, buildGuildLeaderboard } from '@/lib/ens/guild-manager';
import type { GuildProfile, PlayerProfile } from '@/lib/types';
import { StarField } from '@/components/ui/StarField';
import { RetroNav } from '@/components/ui/RetroNav';
import {
  RetroCard,
  RetroCardHeader,
  RetroCardTitle,
  RetroCardContent,
} from '@/components/ui/RetroCard';
import { ArcadeButton } from '@/components/ui/ArcadeButton';

// Single guild for the hackathon demo (registered on Sepolia)
const DEMO_GUILDS = ['yield-empire.eth'];

type LeaderboardTab = 'guilds' | 'players';
type ProtocolFilter = 'all' | 'aave' | 'compound' | 'uniswap' | 'curve';

export default function LeaderboardPage() {
  const router = useRouter();
  const publicClient = usePublicClient();
  const identity = usePlayerIdentity();
  const { isConnected } = useAccount();

  // Route guard: redirect to landing if wallet not connected
  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  const [activeTab, setActiveTab] = useState<LeaderboardTab>('guilds');
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>('all');
  const [showFilter, setShowFilter] = useState(false);

  // Guild leaderboard state
  const [guilds, setGuilds] = useState<GuildProfile[]>([]);
  const [isLoadingGuilds, setIsLoadingGuilds] = useState(false);
  const [guildsError, setGuildsError] = useState<string | null>(null);

  // Player leaderboard state
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  // Active guild for player leaderboard
  const [selectedGuild, setSelectedGuild] = useState(DEMO_GUILDS[0]);

  // Fetch guild leaderboard
  const fetchGuilds = useCallback(async () => {
    if (!publicClient) return;

    setIsLoadingGuilds(true);
    setGuildsError(null);

    try {
      const profiles = await Promise.all(
        DEMO_GUILDS.map((name) => getGuildProfile(publicClient, name)),
      );
      setGuilds(profiles.sort((a, b) => b.tvl - a.tvl));
    } catch (err) {
      setGuildsError(err instanceof Error ? err.message : 'Failed to fetch guilds');
    } finally {
      setIsLoadingGuilds(false);
    }
  }, [publicClient]);

  // Fetch player leaderboard for selected guild
  const fetchPlayers = useCallback(async () => {
    if (!publicClient || !selectedGuild) return;

    setIsLoadingPlayers(true);
    setPlayersError(null);

    try {
      const leaderboard = await buildGuildLeaderboard(publicClient, selectedGuild);
      setPlayers(leaderboard);
    } catch (err) {
      setPlayersError(err instanceof Error ? err.message : 'Failed to fetch players');
    } finally {
      setIsLoadingPlayers(false);
    }
  }, [publicClient, selectedGuild]);

  // Load data on mount and tab switch
  useEffect(() => {
    if (activeTab === 'guilds') {
      fetchGuilds();
    } else {
      fetchPlayers();
    }
  }, [activeTab, fetchGuilds, fetchPlayers]);

  const PROTOCOL_LABELS: Record<ProtocolFilter, string> = {
    all: 'All Protocols',
    aave: 'Aave V3',
    compound: 'Compound V3',
    uniswap: 'Uniswap V3',
    curve: 'Morpho Blue',
  };

  const filteredPlayers =
    protocolFilter === 'all'
      ? players
      : players.filter(
          (p) =>
            (p as PlayerProfile & { favoriteProtocol?: string }).favoriteProtocol ===
            protocolFilter,
        );

  return (
    <div className="page-scrollable bg-background relative overflow-hidden cloud-bg text-foreground">
      {/* Background effects */}
      <StarField />
      <div className="grid-overlay absolute inset-0" />

      {/* Navigation */}
      <RetroNav />

      {/* Content */}
      <main id="main-content" className="relative pt-24 px-4 pb-12">
        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-pixel text-sm md:text-base text-foreground flex items-center justify-center gap-3">
              <Trophy className="w-5 h-5 text-gold" />
              LEADERBOARD
              <Trophy className="w-5 h-5 text-gold" />
            </h1>
            <p className="font-retro text-base text-muted-foreground mt-2">
              Top players and guilds in Yield Empire
            </p>
          </div>

          {/* Tab Switcher + Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <ArcadeButton
              variant={activeTab === 'guilds' ? 'gold' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('guilds')}
            >
              <Shield size={14} className="mr-2" />
              GUILDS
            </ArcadeButton>
            <ArcadeButton
              variant={activeTab === 'players' ? 'gold' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('players')}
            >
              <Users size={14} className="mr-2" />
              PLAYERS
            </ArcadeButton>

            {/* Protocol Filter (players tab only) */}
            {activeTab === 'players' && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-border rounded-sm font-pixel text-[8px] text-muted-foreground hover:text-foreground hover:border-gold transition-colors"
                >
                  <Filter size={14} />
                  {PROTOCOL_LABELS[protocolFilter]}
                  <ChevronDown size={14} />
                </button>
                {showFilter && (
                  <div className="absolute right-0 top-12 retro-card rounded-sm shadow-xl z-10 min-w-48 p-1">
                    {(Object.keys(PROTOCOL_LABELS) as ProtocolFilter[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          setProtocolFilter(key);
                          setShowFilter(false);
                        }}
                        className={`w-full text-left px-4 py-2 font-retro text-base rounded-sm hover:bg-muted/50 transition-colors ${
                          protocolFilter === key ? 'text-gold' : 'text-muted-foreground'
                        }`}
                      >
                        {PROTOCOL_LABELS[key]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Guild selector (players tab only) */}
            {activeTab === 'players' && (
              <select
                value={selectedGuild}
                onChange={(e) => setSelectedGuild(e.target.value)}
                aria-label="Select guild for player rankings"
                className="px-4 py-2.5 bg-input border-2 border-border rounded-sm font-pixel text-[8px] text-muted-foreground focus:outline-none focus:border-gold"
              >
                {DEMO_GUILDS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Guild Leaderboard */}
          {activeTab === 'guilds' && (
            <RetroCard borderColor="purple">
              <RetroCardHeader>
                <RetroCardTitle>
                  <Shield className="w-4 h-4 text-primary" />
                  TOP GUILDS
                </RetroCardTitle>
              </RetroCardHeader>
              <RetroCardContent>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 font-pixel text-[8px] text-muted-foreground uppercase tracking-wider px-3 pb-3 border-b border-border">
                  <div className="col-span-1">RANK</div>
                  <div className="col-span-4">GUILD</div>
                  <div className="col-span-2 text-right">TVL</div>
                  <div className="col-span-2 text-right">MEMBERS</div>
                  <div className="col-span-1 text-right">LVL</div>
                  <div className="col-span-2 text-right">WINS</div>
                </div>

                {isLoadingGuilds ? (
                  <div className="font-retro text-base text-muted-foreground animate-pulse py-12 text-center">
                    Loading guild rankings from ENS&hellip;
                  </div>
                ) : guildsError ? (
                  <div className="font-retro text-sm text-destructive py-12 text-center">
                    {guildsError}
                  </div>
                ) : guilds.length === 0 ? (
                  <div className="font-retro text-base text-muted-foreground py-12 text-center">
                    No guilds found with ENS records.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {guilds.map((guild, i) => (
                      <Link
                        key={guild.name}
                        href="/guild"
                        className="grid grid-cols-12 gap-2 items-center px-3 py-4 hover:bg-muted/20 transition-colors"
                      >
                        <div className="col-span-1">
                          {i === 0 ? (
                            <Crown size={18} className="text-gold" />
                          ) : i === 1 ? (
                            <Medal size={18} className="text-foreground/60" />
                          ) : i === 2 ? (
                            <Medal size={18} className="text-gold/50" />
                          ) : (
                            <span className="font-pixel text-[10px] text-muted-foreground">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gold/20 border border-gold flex items-center justify-center shrink-0">
                            <Shield className="text-gold" size={16} />
                          </div>
                          <div>
                            <div className="font-pixel text-[10px] text-foreground">
                              {guild.name}
                            </div>
                            <div className="font-retro text-xs text-muted-foreground">
                              Founded via ENS
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-right font-pixel text-[10px] text-gold">
                          ${guild.tvl.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-retro text-base text-foreground">
                          {guild.memberCount}
                        </div>
                        <div className="col-span-1 text-right font-pixel text-[10px] text-primary">
                          {guild.level}
                        </div>
                        <div className="col-span-2 text-right font-pixel text-[10px] text-neon-green">
                          {guild.questWins}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </RetroCardContent>
            </RetroCard>
          )}

          {/* Player Leaderboard */}
          {activeTab === 'players' && (
            <>
              {/* Top 3 Podium */}
              {filteredPlayers.length >= 3 && (
                <div className="grid grid-cols-3 gap-4">
                  {/* #2 */}
                  <RetroCard borderColor="default" className="text-center pt-8">
                    <Medal className="w-6 h-6 text-foreground/60 mx-auto mb-2" />
                    <div className="font-pixel text-[10px] text-foreground mb-1">
                      {filteredPlayers[1].ensName ??
                        `${filteredPlayers[1].address.slice(0, 6)}\u2026`}
                    </div>
                    <div className="font-pixel text-sm text-gold">
                      ${filteredPlayers[1].totalDeposited.toLocaleString()}
                    </div>
                    <div className="font-pixel text-[8px] text-muted-foreground mt-1">#2</div>
                  </RetroCard>

                  {/* #1 */}
                  <RetroCard borderColor="gold" className="text-center">
                    <Crown className="w-8 h-8 text-gold mx-auto mb-2" />
                    <div className="font-pixel text-[10px] text-foreground mb-1">
                      {filteredPlayers[0].ensName ??
                        `${filteredPlayers[0].address.slice(0, 6)}\u2026`}
                    </div>
                    <div className="font-pixel text-lg text-gold">
                      ${filteredPlayers[0].totalDeposited.toLocaleString()}
                    </div>
                    <div className="font-pixel text-[8px] text-gold mt-1">#1</div>
                  </RetroCard>

                  {/* #3 */}
                  <RetroCard borderColor="default" className="text-center pt-8">
                    <Medal className="w-6 h-6 text-gold/50 mx-auto mb-2" />
                    <div className="font-pixel text-[10px] text-foreground mb-1">
                      {filteredPlayers[2].ensName ??
                        `${filteredPlayers[2].address.slice(0, 6)}\u2026`}
                    </div>
                    <div className="font-pixel text-sm text-gold">
                      ${filteredPlayers[2].totalDeposited.toLocaleString()}
                    </div>
                    <div className="font-pixel text-[8px] text-muted-foreground mt-1">#3</div>
                  </RetroCard>
                </div>
              )}

              {/* Full Rankings */}
              <RetroCard borderColor="purple">
                <RetroCardHeader>
                  <RetroCardTitle>ALL RANKINGS</RetroCardTitle>
                </RetroCardHeader>
                <RetroCardContent>
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 font-pixel text-[8px] text-muted-foreground uppercase tracking-wider px-3 pb-3 border-b border-border">
                    <div className="col-span-1">RANK</div>
                    <div className="col-span-4">PLAYER</div>
                    <div className="col-span-2 text-right">LVL</div>
                    <div className="col-span-3 text-right">DEPOSITED</div>
                    <div className="col-span-2 text-right">PRESTIGE</div>
                  </div>

                  {isLoadingPlayers ? (
                    <div className="font-retro text-base text-muted-foreground animate-pulse py-12 text-center">
                      Loading player rankings from ENS&hellip;
                    </div>
                  ) : playersError ? (
                    <div className="font-retro text-sm text-destructive py-12 text-center">
                      {playersError}
                    </div>
                  ) : filteredPlayers.length === 0 ? (
                    <div className="font-retro text-base text-muted-foreground py-12 text-center">
                      No players found for this guild.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredPlayers.map((player, i) => {
                        const isCurrentUser =
                          identity.address &&
                          player.address.toLowerCase() === identity.address.toLowerCase();

                        return (
                          <div
                            key={player.address + i}
                            className={`grid grid-cols-12 gap-2 items-center px-3 py-4 transition-colors ${
                              isCurrentUser
                                ? 'bg-primary/10 border-l-4 border-primary'
                                : 'hover:bg-muted/20'
                            }`}
                          >
                            <div className="col-span-1">
                              {i === 0 ? (
                                <Crown size={18} className="text-gold" />
                              ) : i === 1 ? (
                                <Medal size={18} className="text-foreground/60" />
                              ) : i === 2 ? (
                                <Medal size={18} className="text-gold/50" />
                              ) : (
                                <span className="font-pixel text-[10px] text-muted-foreground">
                                  {i + 1}
                                </span>
                              )}
                            </div>
                            <div className="col-span-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-primary/20 border border-primary shrink-0 overflow-hidden flex items-center justify-center">
                                {player.avatar ? (
                                  <img
                                    src={player.avatar}
                                    alt=""
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="font-pixel text-primary text-[8px]">
                                    {(player.ensName ?? player.address).charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-pixel text-[10px] text-foreground flex items-center gap-2">
                                  {player.ensName ??
                                    `${player.address.slice(0, 6)}\u2026${player.address.slice(-4)}`}
                                  {isCurrentUser && (
                                    <span className="font-pixel text-[6px] bg-primary/30 px-1.5 rounded text-primary">
                                      You
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-pixel text-[10px] text-primary">
                              Lv.{player.empireLevel}
                            </div>
                            <div className="col-span-3 text-right font-pixel text-[10px] text-gold">
                              ${player.totalDeposited.toLocaleString()}
                            </div>
                            <div className="col-span-2 text-right font-retro text-base text-muted-foreground">
                              {player.prestigeCount}x
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </RetroCardContent>
              </RetroCard>
            </>
          )}

          {/* Info Banner */}
          <div className="retro-card rounded-sm p-4 text-center">
            <p className="font-retro text-sm text-muted-foreground">
              Rankings are sourced from ENS text records on Sepolia. Guild members are resolved via
              the ENS subgraph.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
