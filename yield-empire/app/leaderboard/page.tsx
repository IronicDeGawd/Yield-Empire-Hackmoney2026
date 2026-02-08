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
  ArrowLeft,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePublicClient, useAccount } from 'wagmi';
import { usePlayerIdentity } from '@/hooks/useENS';
import {
  getGuildProfile,
  buildGuildLeaderboard,
} from '@/lib/ens/guild-manager';
import type { GuildProfile, PlayerProfile } from '@/lib/types';

// Single guild for the hackathon demo (registered on Sepolia)
const DEMO_GUILDS = [
  'yield-empire.eth',
];

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
      setGuildsError(
        err instanceof Error ? err.message : 'Failed to fetch guilds',
      );
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
      const leaderboard = await buildGuildLeaderboard(
        publicClient,
        selectedGuild,
      );
      setPlayers(leaderboard);
    } catch (err) {
      setPlayersError(
        err instanceof Error ? err.message : 'Failed to fetch players',
      );
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
            (p as PlayerProfile & { favoriteProtocol?: string })
              .favoriteProtocol === protocolFilter,
        );

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
              <Trophy className="text-yellow-400" size={24} />
              <span className="font-bold text-xl">Leaderboard</span>
            </div>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </header>

      {/* Content */}
      <main id="main-content" className="pt-24 px-6 pb-12">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Tab Switcher */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('guilds')}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
                activeTab === 'guilds'
                  ? 'bg-purple-600 text-white'
                  : 'bg-game-panel border border-game-border text-gray-400 hover:text-white'
              }`}
            >
              <Shield size={16} className="inline mr-2" />
              Top Guilds
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors ${
                activeTab === 'players'
                  ? 'bg-purple-600 text-white'
                  : 'bg-game-panel border border-game-border text-gray-400 hover:text-white'
              }`}
            >
              <Users size={16} className="inline mr-2" />
              Top Players
            </button>

            {/* Protocol Filter (players tab only) */}
            {activeTab === 'players' && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-game-panel border border-game-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Filter size={14} />
                  {PROTOCOL_LABELS[protocolFilter]}
                  <ChevronDown size={14} />
                </button>
                {showFilter && (
                  <div className="absolute right-0 top-12 bg-game-panel border border-game-border rounded-lg shadow-xl z-10 min-w-48">
                    {(Object.keys(PROTOCOL_LABELS) as ProtocolFilter[]).map(
                      (key) => (
                        <button
                          key={key}
                          onClick={() => {
                            setProtocolFilter(key);
                            setShowFilter(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-900/30 transition-colors ${
                            protocolFilter === key
                              ? 'text-purple-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {PROTOCOL_LABELS[key]}
                        </button>
                      ),
                    )}
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
                className="px-4 py-2.5 bg-game-panel border border-game-border rounded-lg text-sm text-gray-400 focus:outline-none focus:border-purple-500"
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
            <div className="bg-game-panel border-2 border-game-border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 uppercase tracking-wider px-6 py-3 border-b border-game-border bg-game-bg/50">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Guild</div>
                <div className="col-span-2 text-right">TVL</div>
                <div className="col-span-2 text-right">Members</div>
                <div className="col-span-1 text-right">Level</div>
                <div className="col-span-2 text-right">Quest Wins</div>
              </div>

              {isLoadingGuilds ? (
                <div className="text-sm text-gray-500 animate-pulse py-12 text-center">
                  Loading guild rankings from ENS\u2026
                </div>
              ) : guildsError ? (
                <div className="text-sm text-red-400 py-12 text-center">
                  {guildsError}
                </div>
              ) : guilds.length === 0 ? (
                <div className="text-sm text-gray-500 py-12 text-center">
                  No guilds found with ENS records.
                </div>
              ) : (
                <div className="divide-y divide-game-border/50">
                  {guilds.map((guild, i) => (
                    <Link
                      key={guild.name}
                      href="/guild"
                      className="grid grid-cols-12 gap-2 items-center px-6 py-4 hover:bg-purple-900/20 transition-colors"
                    >
                      <div className="col-span-1">
                        {i === 0 ? (
                          <Crown size={20} className="text-yellow-400" />
                        ) : i === 1 ? (
                          <Crown size={20} className="text-gray-300" />
                        ) : i === 2 ? (
                          <Crown size={20} className="text-amber-600" />
                        ) : (
                          <span className="text-gray-500 font-bold">
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shrink-0">
                          <Shield className="text-white" size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            {guild.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            Founded via ENS
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-bold text-yellow-400">
                        ${guild.tvl.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-gray-300">
                        {guild.memberCount}
                      </div>
                      <div className="col-span-1 text-right text-purple-300">
                        {guild.level}
                      </div>
                      <div className="col-span-2 text-right text-green-400">
                        {guild.questWins}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Player Leaderboard */}
          {activeTab === 'players' && (
            <div className="bg-game-panel border-2 border-game-border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 uppercase tracking-wider px-6 py-3 border-b border-game-border bg-game-bg/50">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2 text-right">Empire Lv.</div>
                <div className="col-span-3 text-right">Total Deposited</div>
                <div className="col-span-2 text-right">Prestige</div>
              </div>

              {isLoadingPlayers ? (
                <div className="text-sm text-gray-500 animate-pulse py-12 text-center">
                  Loading player rankings from ENS\u2026
                </div>
              ) : playersError ? (
                <div className="text-sm text-red-400 py-12 text-center">
                  {playersError}
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-sm text-gray-500 py-12 text-center">
                  No players found for this guild.
                </div>
              ) : (
                <div className="divide-y divide-game-border/50">
                  {filteredPlayers.map((player, i) => {
                    const isCurrentUser =
                      identity.address &&
                      player.address.toLowerCase() ===
                        identity.address.toLowerCase();

                    return (
                      <div
                        key={player.address + i}
                        className={`grid grid-cols-12 gap-2 items-center px-6 py-4 transition-colors ${
                          isCurrentUser
                            ? 'bg-purple-900/30 border-l-4 border-purple-500'
                            : 'hover:bg-purple-900/20'
                        }`}
                      >
                        <div className="col-span-1">
                          {i === 0 ? (
                            <Crown size={20} className="text-yellow-400" />
                          ) : i === 1 ? (
                            <Crown size={20} className="text-gray-300" />
                          ) : i === 2 ? (
                            <Crown size={20} className="text-amber-600" />
                          ) : (
                            <span className="text-gray-500 font-bold">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md shrink-0 overflow-hidden">
                            {player.avatar && (
                              <img
                                src={player.avatar}
                                alt=""
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {player.ensName ??
                                `${player.address.slice(0, 6)}\u2026${player.address.slice(-4)}`}
                              {isCurrentUser && (
                                <span className="text-xs bg-purple-600 px-1.5 rounded text-purple-200">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-right text-purple-300 font-bold">
                          Lv.{player.empireLevel}
                        </div>
                        <div className="col-span-3 text-right font-bold text-yellow-400">
                          ${player.totalDeposited.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right text-gray-400">
                          {player.prestigeCount}x
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-game-panel/50 border border-game-border rounded-xl p-4 text-center text-sm text-gray-500">
            Rankings are sourced from ENS text records on Sepolia. Guild
            members are resolved via the ENS subgraph.
          </div>
        </div>
      </main>
    </div>
  );
}
