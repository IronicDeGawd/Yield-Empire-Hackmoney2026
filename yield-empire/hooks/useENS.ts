/**
 * ENS React Hooks for Yield Empire
 *
 * Hooks for player identity, guild profiles, text records,
 * and guild member lists.
 *
 * Reference: resources/ens/IMPLEMENTATION-EXAMPLE.md (React Hooks section)
 * Patterns: resources/ens-app-v3/src/hooks/useProfile.ts
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useEnsName, useEnsAvatar } from 'wagmi';
import { normalize } from 'viem/ens';
import {
  getGuildProfile,
  getPlayerProfile,
  resolveAddress,
  fetchGuildMembers,
  proxyAvatarUrl,
  type SubgraphDomain,
} from '@/lib/ens/guild-manager';
import type { GuildProfile, PlayerProfile } from '@/lib/types';

// ============================================================================
// usePlayerIdentity — current connected user's ENS info
// ============================================================================

export interface PlayerIdentity {
  address: `0x${string}` | undefined;
  ensName: string | null | undefined;
  avatar: string | null | undefined;
  displayName: string;
  isLoading: boolean;
}

export function usePlayerIdentity(): PlayerIdentity {
  const { address } = useAccount();

  const { data: ensName, isLoading: isLoadingName } = useEnsName({
    address,
  });

  const { data: avatar, isLoading: isLoadingAvatar } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
  });

  const displayName =
    ensName ||
    (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '');

  return {
    address,
    ensName,
    avatar: proxyAvatarUrl(avatar),
    displayName,
    isLoading: isLoadingName || isLoadingAvatar,
  };
}

// ============================================================================
// useGuildProfile — complete guild profile from ENS text records
// ============================================================================

export interface UseGuildProfileReturn {
  profile: GuildProfile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGuildProfile(guildName: string): UseGuildProfileReturn {
  const [profile, setProfile] = useState<GuildProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const publicClient = usePublicClient();

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!guildName || !publicClient) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getGuildProfile(publicClient, guildName)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to fetch guild profile'),
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [guildName, publicClient, fetchKey]);

  return { profile, isLoading, error, refetch };
}

// ============================================================================
// usePlayerProfile — player profile from ENS text records
// ============================================================================

export interface UsePlayerProfileReturn {
  profile: PlayerProfile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePlayerProfile(playerName: string): UsePlayerProfileReturn {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const publicClient = usePublicClient();

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!playerName || !publicClient) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Resolve ENS name to address so this works for any player, not just connected wallet
    resolveAddress(publicClient, playerName)
      .then((resolved) => {
        const addr = resolved ?? '0x0000000000000000000000000000000000000000';
        return getPlayerProfile(publicClient, playerName, addr);
      })
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to fetch player profile'),
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [playerName, publicClient, fetchKey]);

  return { profile, isLoading, error, refetch };
}

// ============================================================================
// useGuildMembers — guild member list from ENS subgraph
// ============================================================================

export interface UseGuildMembersReturn {
  members: SubgraphDomain[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGuildMembers(guildName: string): UseGuildMembersReturn {
  const [members, setMembers] = useState<SubgraphDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!guildName) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchGuildMembers(guildName)
      .then((result) => {
        if (!cancelled) setMembers(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to fetch guild members'),
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [guildName, fetchKey]);

  return { members, isLoading, error, refetch };
}
