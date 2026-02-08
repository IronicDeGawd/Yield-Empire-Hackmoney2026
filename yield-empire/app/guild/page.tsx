'use client';

/**
 * Guild Management Page
 *
 * Displays guild info from ENS text records, member leaderboard from subgraph,
 * and join/create guild actions via subdomain creation.
 */

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient } from 'wagmi';
import {
  usePlayerIdentity,
  useGuildProfile,
  useGuildMembers,
} from '@/hooks/useENS';
import { usePublicClient } from 'wagmi';
import {
  createGuildMember,
  getPlayerProfile,
  isValidENSName,
} from '@/lib/ens/guild-manager';
import type { PlayerProfile } from '@/lib/types';

// Guild name for the hackathon (registered on Sepolia)
const DEMO_GUILD = 'yield-empire.eth';

export default function GuildPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const identity = usePlayerIdentity();

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
        members.slice(0, 20).map((m) =>
          getPlayerProfile(publicClient, m.name, m.owner.id),
        ),
      );
      setMemberProfiles(
        profiles.sort((a, b) => b.totalDeposited - a.totalDeposited),
      );
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
        err instanceof Error ? err.message : 'Failed to join guild. You may need to own the parent domain.',
      );
    } finally {
      setIsJoining(false);
    }
  };

  // Demo quest data
  const activeQuest = {
    description: 'Reach $50,000 guild TVL',
    target: 50000,
    progress: guild?.tvl ?? 0,
    reward: '+5% APY boost for all members',
    deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  const questProgress = Math.min(
    (activeQuest.progress / activeQuest.target) * 100,
    100,
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
              <Shield className="text-purple-400" size={24} />
              <span className="font-bold text-xl">Guild</span>
            </div>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Guild Info Card */}
          <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              {/* Guild Identity */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shrink-0">
                  <Shield className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-1">
                    {guild?.name ?? guildName}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {guild?.memberCount ?? members.length} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy size={14} />
                      Level {guild?.level ?? 1}
                    </span>
                    <span className="flex items-center gap-1">
                      <Crown size={14} />
                      {guild?.questWins ?? 0} quest wins
                    </span>
                  </div>
                  {guild?.treasuryAddress && (
                    <div className="mt-2 text-xs text-gray-500 font-mono">
                      Treasury: {guild.treasuryAddress.slice(0, 10)}&hellip;
                      {guild.treasuryAddress.slice(-8)}
                    </div>
                  )}
                </div>
              </div>

              {/* Guild Stats */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-game-bg rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-400">
                    ${(guild?.tvl ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">
                    Guild TVL
                  </div>
                </div>
                <div className="bg-game-bg rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-400">
                    Lv.{guild?.level ?? 1}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">
                    Guild Level
                  </div>
                </div>
              </div>
            </div>

            {isGuildLoading && (
              <div className="mt-4 text-sm text-gray-500 animate-pulse">
                Loading guild data from ENS&hellip;
              </div>
            )}
            {guildError && (
              <div className="mt-4 text-sm text-red-400">
                Failed to load guild: {guildError.message}
              </div>
            )}
          </div>

          {/* Active Quest */}
          <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-yellow-400" size={20} />
              <h2 className="text-lg font-bold">Active Quest</h2>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">
                  {activeQuest.description}
                </span>
                <span className="text-yellow-400 font-bold">
                  {questProgress.toFixed(0)}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-3 bg-game-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${questProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>
                  ${activeQuest.progress.toLocaleString()} / $
                  {activeQuest.target.toLocaleString()}
                </span>
                <span>
                  {Math.ceil(
                    (activeQuest.deadline - Date.now()) / (24 * 60 * 60 * 1000),
                  )}
                  d remaining
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-400">
              <Zap size={14} />
              <span>Reward: {activeQuest.reward}</span>
            </div>
          </div>

          {/* Join Guild + Member Leaderboard */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Join Guild Card */}
            <div className="bg-game-panel border-2 border-game-border rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus size={20} className="text-purple-400" />
                Join Guild
              </h2>

              {!isConnected ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 mb-4">
                    Connect wallet to join
                  </p>
                  <ConnectButton showBalance={false} />
                </div>
              ) : showJoinForm ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="member-label" className="text-xs text-gray-400 uppercase tracking-wider block mb-1">
                      Your Member Name
                    </label>
                    <div className="flex items-center gap-1 text-sm">
                      <input
                        id="member-label"
                        type="text"
                        name="memberLabel"
                        autoComplete="username"
                        spellCheck={false}
                        value={memberLabel}
                        onChange={(e) =>
                          setMemberLabel(e.target.value.toLowerCase())
                        }
                        placeholder="e.g. alice"
                        className="flex-1 bg-game-bg border border-game-border rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                      />
                      <span className="text-gray-500 shrink-0">
                        .{guildName}
                      </span>
                    </div>
                  </div>

                  {memberLabel && (
                    <div className="text-xs text-gray-500">
                      Your ENS subdomain:{' '}
                      <span className="text-purple-400">
                        {memberLabel}.{guildName}
                      </span>
                    </div>
                  )}

                  {joinError && (
                    <div className="text-xs text-red-400">{joinError}</div>
                  )}

                  {joinSuccess && (
                    <div className="text-xs text-green-400">
                      Successfully joined! Your subdomain is being created.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleJoinGuild}
                      disabled={isJoining || !memberLabel}
                      className="flex-1 btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isJoining ? 'Creating\u2026' : '[ Join ]'}
                    </button>
                    <button
                      onClick={() => setShowJoinForm(false)}
                      className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    Join as{' '}
                    <span className="text-white">{identity.displayName}</span>{' '}
                    to get an ENS subdomain under this guild.
                  </p>
                  <button
                    onClick={() => setShowJoinForm(true)}
                    className="w-full btn-gold text-sm"
                  >
                    [ Join {guildName} ]
                  </button>
                </div>
              )}
            </div>

            {/* Member Leaderboard */}
            <div className="md:col-span-2 bg-game-panel border-2 border-game-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Trophy size={20} className="text-yellow-400" />
                  Member Leaderboard
                </h2>
                <button
                  onClick={() => {
                    refetchMembers();
                    loadMemberProfiles();
                  }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Refresh
                </button>
              </div>

              {isMembersLoading || isLoadingProfiles ? (
                <div className="text-sm text-gray-500 animate-pulse py-8 text-center">
                  Loading members from ENS subgraph\u2026
                </div>
              ) : membersError ? (
                <div className="text-sm text-red-400 py-8 text-center">
                  Failed to load members: {membersError.message}
                </div>
              ) : members.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center">
                  No members found. Be the first to join!
                </div>
              ) : (
                <div className="space-y-2 game-scrollbar max-h-80 overflow-y-auto pr-2">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 uppercase tracking-wider px-3 pb-2 border-b border-game-border">
                    <div className="col-span-1">#</div>
                    <div className="col-span-5">Member</div>
                    <div className="col-span-2 text-right">Level</div>
                    <div className="col-span-2 text-right">Deposited</div>
                    <div className="col-span-2 text-right">Prestige</div>
                  </div>

                  {/* Member rows */}
                  {(memberProfiles.length > 0
                    ? memberProfiles
                    : members.map((m) => ({
                        address: m.owner.id,
                        ensName: m.name,
                        empireLevel: 1,
                        totalDeposited: 0,
                        totalYield: 0,
                        prestigeCount: 0,
                      }))
                  ).map((member, i) => (
                    <div
                      key={member.address + i}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-purple-900/30 transition-colors text-sm"
                    >
                      <div className="col-span-1 font-bold text-gray-500">
                        {i === 0 ? (
                          <Crown size={16} className="text-yellow-400" />
                        ) : i === 1 ? (
                          <Crown size={16} className="text-gray-300" />
                        ) : i === 2 ? (
                          <Crown size={16} className="text-amber-600" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <div className="col-span-5 flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md shrink-0" />
                        <span className="text-white truncate">
                          {member.ensName ??
                            `${member.address.slice(0, 6)}\u2026${member.address.slice(-4)}`}
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-purple-300">
                        Lv.{member.empireLevel}
                      </div>
                      <div className="col-span-2 text-right text-yellow-400">
                        ${member.totalDeposited.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-gray-400">
                        {member.prestigeCount}x
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/leaderboard"
              className="bg-game-panel border-2 border-game-border rounded-xl p-4 flex items-center justify-between hover:bg-purple-900/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Trophy className="text-yellow-400" size={24} />
                <div>
                  <div className="font-bold">Leaderboard</div>
                  <div className="text-sm text-gray-400">
                    Global guild &amp; player rankings
                  </div>
                </div>
              </div>
              <ChevronRight
                className="text-gray-500 group-hover:text-white transition-colors"
                size={20}
              />
            </Link>
            <Link
              href="/settlement"
              className="bg-game-panel border-2 border-game-border rounded-xl p-4 flex items-center justify-between hover:bg-purple-900/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Zap className="text-green-400" size={24} />
                <div>
                  <div className="font-bold">Settlement</div>
                  <div className="text-sm text-gray-400">
                    Manage Yellow Network sessions
                  </div>
                </div>
              </div>
              <ChevronRight
                className="text-gray-500 group-hover:text-white transition-colors"
                size={20}
              />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
