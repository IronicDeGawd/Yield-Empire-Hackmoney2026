/**
 * ENS Guild Identity Manager for Yield Empire
 *
 * Reads/writes guild & player profiles as ENS text records,
 * creates guild member subdomains, and queries the ENS subgraph.
 *
 * Reference: resources/ens/IMPLEMENTATION-EXAMPLE.md
 */

import { type Address, type Hash, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize, namehash, labelhash } from 'viem/ens';
import { PUBLIC_RESOLVER_ABI, ENS_REGISTRY_ABI } from './abis';
import { ENS_CONTRACTS, NETWORKS } from '../config/networks';
import type { GuildProfile, PlayerProfile } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWalletClient = any;

// ENS contract addresses for configured network
const contracts = ENS_CONTRACTS[NETWORKS.ENS_NETWORK];

// Sepolia ENS subgraph endpoint
const ENS_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/49574/enssepolia/version/latest';

// Text record keys used by the game
export const GAME_KEYS = {
  GUILD_TVL: 'guild-tvl',
  GUILD_LEVEL: 'guild-level',
  MEMBER_COUNT: 'member-count',
  GUILD_STRATEGY: 'guild-strategy',
  FOUNDED: 'founded',
  QUEST_WINS: 'quest-wins',
  EMPIRE_LEVEL: 'empire-level',
  TOTAL_CONTRIBUTION: 'total-contribution',
  FAVORITE_PROTOCOL: 'favorite-protocol',
  PRESTIGE_COUNT: 'prestige-count',
} as const;

// ============================================================================
// READING ENS DATA
// ============================================================================

/**
 * Read a single text record from an ENS name.
 * Always normalizes before hashing (required by ENS spec).
 */
export async function getTextRecord(
  publicClient: PublicClient,
  name: string,
  key: string,
): Promise<string | null> {
  try {
    const node = namehash(normalize(name));
    const result = await publicClient.readContract({
      address: contracts.PUBLIC_RESOLVER,
      abi: PUBLIC_RESOLVER_ABI,
      functionName: 'text',
      args: [node, key],
    });
    return result || null;
  } catch (error) {
    console.error(`Failed to get text record "${key}" for ${name}:`, error);
    return null;
  }
}

/**
 * Fetch complete guild profile from ENS text records.
 * Batch-reads all guild keys in parallel via Promise.all().
 */
export async function getGuildProfile(
  publicClient: PublicClient,
  guildName: string,
): Promise<GuildProfile> {
  const [tvl, level, memberCount, questWins, treasuryAddress] =
    await Promise.all([
      getTextRecord(publicClient, guildName, GAME_KEYS.GUILD_TVL),
      getTextRecord(publicClient, guildName, GAME_KEYS.GUILD_LEVEL),
      getTextRecord(publicClient, guildName, GAME_KEYS.MEMBER_COUNT),
      getTextRecord(publicClient, guildName, GAME_KEYS.QUEST_WINS),
      resolveAddress(publicClient, `treasury.${guildName}`),
    ]);

  return {
    name: guildName,
    tvl: Number(tvl) || 0,
    level: Number(level) || 1,
    memberCount: Number(memberCount) || 0,
    questWins: Number(questWins) || 0,
    treasuryAddress: treasuryAddress ?? undefined,
  };
}

/**
 * Fetch player profile from ENS text records.
 */
export async function getPlayerProfile(
  publicClient: PublicClient,
  playerName: string,
  playerAddress: string,
): Promise<PlayerProfile> {
  const [empireLevel, totalContribution, favoriteProtocol, prestigeCount, avatar] =
    await Promise.all([
      getTextRecord(publicClient, playerName, GAME_KEYS.EMPIRE_LEVEL),
      getTextRecord(publicClient, playerName, GAME_KEYS.TOTAL_CONTRIBUTION),
      getTextRecord(publicClient, playerName, GAME_KEYS.FAVORITE_PROTOCOL),
      getTextRecord(publicClient, playerName, GAME_KEYS.PRESTIGE_COUNT),
      getAvatar(publicClient, playerName),
    ]);

  return {
    address: playerAddress,
    ensName: playerName,
    avatar: avatar ?? undefined,
    empireLevel: Number(empireLevel) || 1,
    totalDeposited: Number(totalContribution) || 0,
    totalYield: 0,
    prestigeCount: Number(prestigeCount) || 0,
  };
}

/**
 * Resolve ENS name to address (forward lookup).
 */
export async function resolveAddress(
  publicClient: PublicClient,
  name: string,
): Promise<string | null> {
  try {
    const address = await publicClient.getEnsAddress({
      name: normalize(name),
    });
    return address;
  } catch (error) {
    console.error(`Failed to resolve ${name}:`, error);
    return null;
  }
}

/**
 * Get ENS avatar URL for a name.
 */
export async function getAvatar(
  publicClient: PublicClient,
  name: string,
): Promise<string | null> {
  try {
    const avatar = await publicClient.getEnsAvatar({
      name: normalize(name),
    });
    return avatar;
  } catch (error) {
    console.error(`Failed to get avatar for ${name}:`, error);
    return null;
  }
}

// ============================================================================
// WRITING ENS DATA (requires wallet)
// ============================================================================

/**
 * Set a text record on an ENS name.
 * Caller must own the name or be approved.
 */
export async function setTextRecord(
  walletClient: AnyWalletClient,
  name: string,
  key: string,
  value: string,
): Promise<Hash> {
  const node = namehash(normalize(name));
  const hash = await walletClient.writeContract({
    chain: sepolia,
    address: contracts.PUBLIC_RESOLVER,
    abi: PUBLIC_RESOLVER_ABI,
    functionName: 'setText',
    args: [node, key, value],
  });
  return hash;
}

/**
 * Batch-update multiple guild stats as text records.
 * Each setText is a separate on-chain transaction.
 */
export async function updateGuildStats(
  walletClient: AnyWalletClient,
  guildName: string,
  stats: Partial<Record<string, string>>,
): Promise<Hash[]> {
  const hashes: Hash[] = [];
  for (const [key, value] of Object.entries(stats)) {
    if (value !== undefined) {
      const hash = await setTextRecord(walletClient, guildName, key, value);
      hashes.push(hash);
    }
  }
  return hashes;
}

// ============================================================================
// SUBDOMAIN CREATION
// ============================================================================

/**
 * Create a guild member subdomain.
 * e.g. createGuildMember(wc, 'yield-warriors.eth', 'alice', '0x...')
 *      → creates alice.yield-warriors.eth
 *
 * Caller must own the parent domain.
 */
export async function createGuildMember(
  walletClient: AnyWalletClient,
  guildName: string,
  memberLabel: string,
  ownerAddress: Address,
): Promise<Hash> {
  const parentNode = namehash(normalize(guildName));
  const labelHash = labelhash(normalize(memberLabel));

  const hash = await walletClient.writeContract({
    chain: sepolia,
    address: contracts.REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: 'setSubnodeRecord',
    args: [parentNode, labelHash, ownerAddress, contracts.PUBLIC_RESOLVER, BigInt(0)],
  });
  return hash;
}

// ============================================================================
// ENS SUBGRAPH QUERIES
// ============================================================================

export interface SubgraphDomain {
  id: string;
  name: string;
  owner: { id: string };
  resolver: { id: string } | null;
  createdAt: string;
}

/**
 * Fetch guild members (subdomains) via the ENS Sepolia subgraph.
 */
export async function fetchGuildMembers(
  guildName: string,
): Promise<SubgraphDomain[]> {
  const query = `
    query GetSubdomains($parentName: String!) {
      domains(
        where: { name_ends_with: $parentName }
        orderBy: createdAt
        orderDirection: desc
        first: 100
      ) {
        id
        name
        owner { id }
        resolver { id }
        createdAt
      }
    }
  `;

  try {
    const response = await fetch(ENS_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { parentName: `.${guildName}` },
      }),
    });

    if (!response.ok) {
      console.error(`ENS subgraph returned ${response.status}`);
      return [];
    }

    const { data } = await response.json();
    const domains: SubgraphDomain[] = data?.domains || [];

    // Filter to direct subdomains only (not sub-subdomains)
    const parentDepth = guildName.split('.').length;
    return domains.filter(
      (d) => d.name.split('.').length === parentDepth + 1,
    );
  } catch (error) {
    console.error('Failed to fetch guild members:', error);
    return [];
  }
}

/**
 * Build guild leaderboard by fetching each member's player profile.
 * Sorted by totalContribution descending.
 */
export async function buildGuildLeaderboard(
  publicClient: PublicClient,
  guildName: string,
): Promise<PlayerProfile[]> {
  const members = await fetchGuildMembers(guildName);

  const profiles = await Promise.all(
    members.map((m) =>
      getPlayerProfile(publicClient, m.name, m.owner.id),
    ),
  );

  return profiles.sort(
    (a, b) => b.totalDeposited - a.totalDeposited,
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check whether an ENS name is valid (normalizable).
 */
export function isValidENSName(name: string): boolean {
  try {
    normalize(name);
    return true;
  } catch {
    return false;
  }
}
