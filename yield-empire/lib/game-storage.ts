/**
 * Game state persistence via localStorage.
 *
 * Saves/restores building deposits, levels, $EMPIRE tokens, and guild
 * contributions so progress survives page refreshes.
 *
 * Keys are scoped per wallet address to support multiple accounts.
 */

import type { GameEntity } from './types';

const KEY_PREFIX = 'yield-empire:game-state';

export interface PersistedGameState {
  entities: GameEntity[];
  empireTokens: number;
  totalEmpireEarned: number;
  guildContributed: number;
  address: string;
  savedAt: number;
}

function storageKey(address: string): string {
  return `${KEY_PREFIX}:${address.toLowerCase()}`;
}

/** Save current game state to localStorage. */
export function saveGameState(
  address: string,
  state: {
    entities: GameEntity[];
    empireTokens: number;
    totalEmpireEarned: number;
    guildContributed: number;
  },
): void {
  try {
    const persisted: PersistedGameState = {
      ...state,
      address: address.toLowerCase(),
      savedAt: Date.now(),
    };
    localStorage.setItem(storageKey(address), JSON.stringify(persisted));
  } catch {
    // localStorage unavailable (SSR, private browsing, quota exceeded)
  }
}

/** Load saved game state for a wallet address. Returns null if none exists. */
export function loadGameState(address: string): PersistedGameState | null {
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Basic validation — ensure required fields exist
    if (!Array.isArray(parsed.entities)) {
      return null;
    }

    // Migration: support old save format (accruedYield → empireTokens)
    const empireTokens = typeof parsed.empireTokens === 'number'
      ? parsed.empireTokens
      : typeof parsed.accruedYield === 'number'
        ? parsed.accruedYield
        : 0;

    const totalEmpireEarned = typeof parsed.totalEmpireEarned === 'number'
      ? parsed.totalEmpireEarned
      : typeof parsed.totalYieldEarned === 'number'
        ? parsed.totalYieldEarned
        : 0;

    return {
      entities: parsed.entities,
      empireTokens,
      totalEmpireEarned,
      guildContributed: typeof parsed.guildContributed === 'number' ? parsed.guildContributed : 0,
      address: parsed.address ?? address.toLowerCase(),
      savedAt: parsed.savedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

/** Clear saved game state (e.g. after settlement). */
export function clearGameState(address: string): void {
  try {
    localStorage.removeItem(storageKey(address));
  } catch {
    // Silently ignore
  }
}
