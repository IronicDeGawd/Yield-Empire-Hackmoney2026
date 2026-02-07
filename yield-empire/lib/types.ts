/**
 * Core types for Yield Empire game
 */

// Coordinate system for isometric grid
export interface Coordinate {
  x: number;
  y: number;
}

// Building types representing DeFi protocols
export type BuildingType = 'factory' | 'crystal' | 'bank' | 'empty';

// DeFi protocol identifiers
export type ProtocolId = 'aave' | 'compound' | 'uniswap' | 'curve' | 'yearn';

// Game entity representing a building/island on the map
export interface GameEntity {
  id: string;
  type: BuildingType;
  name: string;
  protocol: ProtocolId;
  level: number;
  yieldRate: number; // Base APY percentage
  deposited: number; // Amount deposited in USD
  position: Coordinate;
  color: string;
}

// Connection between islands (bridges)
export interface Connection {
  from: string; // Entity ID
  to: string; // Entity ID
}

// Player profile data stored in ENS text records
export interface PlayerProfile {
  address: string;
  ensName?: string;
  avatar?: string;
  empireLevel: number;
  totalDeposited: number;
  totalYield: number;
  prestigeCount: number;
  guildName?: string;
}

// Guild data from ENS
export interface GuildProfile {
  name: string; // e.g., "yield-warriors.eth"
  tvl: number;
  level: number;
  memberCount: number;
  questWins: number;
  treasuryAddress?: string;
}

// Game state for a player's empire
export interface GameState {
  entities: GameEntity[];
  connections: Connection[];
  player: PlayerProfile;
  guild?: GuildProfile;
  actionCount: number; // Actions since last settlement
  lastSettlement?: number; // Unix timestamp
}

// Yellow Network session state
export interface SessionState {
  isConnected: boolean;
  isSessionActive: boolean;
  sessionId?: string;
  channelId?: string;
  actionCount: number;
  gasSaved: number; // Estimated gas saved in USD
}

// Game actions that can be performed via Yellow Network
export type GameAction =
  | { type: 'DEPOSIT_TO_PROTOCOL'; protocol: ProtocolId; amount: number }
  | { type: 'COMPOUND_YIELD' }
  | { type: 'UPGRADE_BUILDING'; buildingId: string }
  | { type: 'CONTRIBUTE_TO_GUILD'; amount: number }
  | { type: 'CLAIM_REWARDS' };

// Building configuration from implementation plan
export interface BuildingConfig {
  type: BuildingType;
  protocol: ProtocolId;
  name: string;
  baseYield: number; // Base APY
  color: string;
  description: string;
}

// Result of a single protocol settlement transaction
export interface SettlementTx {
  protocol: ProtocolId;
  protocolName: string;
  chain: string; // 'Sepolia' | 'Base Sepolia'
  chainId: number;
  amount: bigint; // USDC amount in 6-decimal units
  hash: string; // Transaction hash
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

// Complete settlement result from closing a Yellow Network session
export interface SettlementResult {
  sessionId: string;
  actionCount: number;
  gasSaved: number;
  transactions: SettlementTx[];
  timestamp: number;
}

// Quest for guild cooperation
export interface Quest {
  id: string;
  description: string;
  target: number; // e.g., $50,000 TVL
  reward: string; // e.g., "+5% APY boost"
  deadline: number; // Unix timestamp
  progress: number; // Current amount
  completed: boolean;
}
