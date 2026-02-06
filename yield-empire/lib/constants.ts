/**
 * Game constants for Yield Empire
 * Building configurations, colors, and initial game state
 */

import { GameEntity, Connection, BuildingConfig, ProtocolId } from './types';

// Color palette from design spec
export const COLORS = {
  // Background colors
  bgPrimary: '#1a1a2e',
  bgSecondary: '#2d2d44',
  panelBg: '#16162a',
  border: '#4a4a6a',

  // Accent colors
  gold: '#ffd700',
  success: '#00ff88',
  danger: '#ff4444',

  // Building/protocol colors
  aave: '#9b7dff', // Purple - Crystal Tower
  uniswap: '#ff007a', // Pink - Exchange Factory
  compound: '#00d395', // Green - Coin Vault
  curve: '#ffed4a', // Yellow - Liquid Pool
  yearn: '#0074f0', // Blue - Observatory

  // Island base color
  islandBase: '#7C3AED', // Violet-600
} as const;

// Building configurations from implementation plan
export const BUILDING_CONFIGS: Record<ProtocolId, BuildingConfig> = {
  aave: {
    type: 'crystal',
    protocol: 'aave',
    name: 'Crystal Tower',
    baseYield: 5,
    color: COLORS.aave,
    description: 'Lending protocol with stable yields',
  },
  uniswap: {
    type: 'factory',
    protocol: 'uniswap',
    name: 'Exchange Factory',
    baseYield: 8,
    color: COLORS.uniswap,
    description: 'DEX with trading fee rewards',
  },
  compound: {
    type: 'bank',
    protocol: 'compound',
    name: 'Coin Vault',
    baseYield: 4,
    color: COLORS.compound,
    description: 'Money market for earning interest',
  },
  curve: {
    type: 'factory',
    protocol: 'curve',
    name: 'Liquid Pool',
    baseYield: 6,
    color: COLORS.curve,
    description: 'Stablecoin liquidity pool',
  },
  yearn: {
    type: 'crystal',
    protocol: 'yearn',
    name: 'Observatory',
    baseYield: 7,
    color: COLORS.yearn,
    description: 'Yield aggregator for optimized returns',
  },
};

// Initial entities positioned in diamond pattern (from wireframe)
// Top: (-1, -1), Right: (1, -1), Bottom: (1, 1), Left: (-1, 1)
export const INITIAL_ENTITIES: GameEntity[] = [
  {
    id: 'e1',
    type: 'crystal',
    name: 'AAVE',
    protocol: 'aave',
    level: 5,
    yieldRate: 5,
    deposited: 500,
    position: { x: -1, y: -1 }, // Top
    color: COLORS.aave,
  },
  {
    id: 'e2',
    type: 'bank',
    name: 'COMPOUND',
    protocol: 'compound',
    level: 3,
    yieldRate: 4,
    deposited: 750,
    position: { x: 1, y: -1 }, // Right
    color: COLORS.compound,
  },
  {
    id: 'e3',
    type: 'factory',
    name: 'UNI-V3',
    protocol: 'uniswap',
    level: 2,
    yieldRate: 8,
    deposited: 400,
    position: { x: 1, y: 1 }, // Bottom
    color: COLORS.uniswap,
  },
  {
    id: 'e4',
    type: 'factory',
    name: 'CURVE',
    protocol: 'curve',
    level: 3,
    yieldRate: 6,
    deposited: 800,
    position: { x: -1, y: 1 }, // Left
    color: COLORS.curve,
  },
];

// Connections between islands (bridges)
export const INITIAL_CONNECTIONS: Connection[] = [
  { from: 'e1', to: 'e2' },
  { from: 'e2', to: 'e3' },
  { from: 'e3', to: 'e4' },
  { from: 'e4', to: 'e1' },
];

// Upgrade cost multiplier per level
export const UPGRADE_COST_MULTIPLIER = 1.15;

// Yield multiplier per level (+10%)
export const YIELD_MULTIPLIER_PER_LEVEL = 0.1;

// Gas cost estimates (for savings calculation)
export const GAS_COSTS = {
  deposit: 0.5, // USD
  compound: 0.3,
  upgrade: 0.4,
  guildContribute: 0.6,
  claim: 0.25,
};
