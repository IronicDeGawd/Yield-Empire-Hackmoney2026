'use client';

/**
 * YellowSessionProvider
 *
 * Shared context for Yellow Network session state.
 * Ensures a single YellowSessionManager instance is shared across all pages
 * (game, settlement, etc.) so session data (actionCount, gasSaved) is consistent.
 *
 * Phase 4: Settlement executes real protocol calls and tracks tx hashes.
 *   - Compound V3: direct Circle USDC supply on Sepolia
 *   - Aave V3: via Treasury on Base Sepolia (falls back to direct if no treasury)
 *   - Uniswap V3: USDC→WETH swap via SwapRouter on Sepolia
 *   - Morpho Blue: direct Circle USDC supply on Sepolia
 */

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import { YellowSessionManager } from '@/lib/yellow/session-manager';
import type { GameAction, GameEntity, SessionState, SettlementResult, SettlementTx } from '@/lib/types';
import type { RPCAppSessionAllocation } from '@erc7824/nitrolite';
import { supplyToCompound } from '@/lib/protocols/compound';
import { supplyToAave } from '@/lib/protocols/aave';
import { swapOnUniswap } from '@/lib/protocols/uniswap';
import { supplyToMorpho } from '@/lib/protocols/morpho';
import { BUILDING_CONFIGS } from '@/lib/constants';
import { PROTOCOL_CHAIN_MAP, SETTLEMENT_CHAINS } from '@/lib/protocols/addresses';
import { updatePlayerProfile } from '@/lib/ens/guild-manager';

export interface YellowSessionContextValue {
  // Connection state
  isConnected: boolean;
  isSessionActive: boolean;
  isConnecting: boolean;
  isSettling: boolean;
  error: string | null;

  // Session data
  actionCount: number;
  gasSaved: number;
  sessionId: string | null;
  actionBreakdown: Record<string, number>;

  // Settlement results
  lastSettlement: SettlementResult | null;

  // Actions
  connect: () => Promise<void>;
  createSession: () => Promise<void>;
  settleSession: (entities: GameEntity[], meta?: { empireLevel: number; totalYieldEarned: number; ensName?: string }) => Promise<boolean>;
  performAction: (action: GameAction, gameState: object) => Promise<void>;
  disconnect: () => void;
}

const defaultValue: YellowSessionContextValue = {
  isConnected: false,
  isSessionActive: false,
  isConnecting: false,
  isSettling: false,
  error: null,
  actionCount: 0,
  gasSaved: 0,
  sessionId: null,
  actionBreakdown: {},
  lastSettlement: null,
  connect: async () => { },
  createSession: async () => { },
  settleSession: async () => false,
  performAction: async () => { },
  disconnect: () => { },
};

export const YellowSessionContext =
  createContext<YellowSessionContextValue>(defaultValue);

/** Convert USD amount to USDC 6-decimal bigint */
function usdToUsdc6(usdAmount: number): bigint {
  return BigInt(Math.floor(usdAmount * 1_000_000));
}

/** Human-readable chain name */
function chainName(chainId: number): string {
  if (chainId === SETTLEMENT_CHAINS.SEPOLIA) return 'Sepolia';
  if (chainId === SETTLEMENT_CHAINS.BASE_SEPOLIA) return 'Base Sepolia';
  return 'Unknown';
}

export function YellowSessionProvider({ children }: { children: ReactNode }) {
  const { address, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  const [sessionState, setSessionState] = useState<SessionState>({
    isConnected: false,
    isSessionActive: false,
    actionCount: 0,
    gasSaved: 0,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSettlement, setLastSettlement] = useState<SettlementResult | null>(null);

  const managerRef = useRef<YellowSessionManager | null>(null);
  const sessionStateRef = useRef(sessionState);
  sessionStateRef.current = sessionState;

  // Initialize session manager once for the entire app lifetime
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new YellowSessionManager((state) => {
        setSessionState(state);
      });
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }

    if (!managerRef.current) {
      setError('Session manager not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await managerRef.current.connect(walletClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [walletClient, address]);

  const createSession = useCallback(async () => {
    if (!address || !managerRef.current) {
      setError('Not ready to create session');
      return;
    }

    setError(null);

    try {
      await managerRef.current.createGameSession(address);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create session',
      );
      throw err;
    }
  }, [address]);

  const performAction = useCallback(
    async (action: GameAction, gameState: object) => {
      if (!managerRef.current || !address) {
        setError('Wallet not connected');
        return;
      }

      if (!sessionStateRef.current.isSessionActive) {
        const msg = 'Yellow Network session not ready. Please wait for connection.';
        setError(msg);
        throw new Error(msg);
      }

      setError(null);

      try {
        await managerRef.current.submitGameAction(action, gameState, address);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to submit action',
        );
        throw err;
      }
    },
    [address],
  );

  /**
   * Settle session: close Yellow Network state channel, then execute
   * real on-chain protocol transactions for each building allocation.
   *
   * Transactions are grouped by chain to minimize chain switches.
   * Approve receipts are awaited before supply to prevent race conditions.
   */
  const settleSession = useCallback(async (entities: GameEntity[], meta?: { empireLevel: number; totalYieldEarned: number; ensName?: string }): Promise<boolean> => {
    if (!managerRef.current || !address || !walletClient || !publicClient) {
      setError('Cannot settle session');
      return false;
    }

    setIsSettling(true);
    setError(null);

    // Read from ref to avoid stale closures without extra deps
    const currentSessionId = sessionStateRef.current.sessionId ?? 'unknown';
    const currentActionCount = sessionStateRef.current.actionCount;
    const currentGasSaved = sessionStateRef.current.gasSaved;

    try {
      // Step 1: Close Yellow Network session
      const finalAllocations: RPCAppSessionAllocation[] = [];
      await managerRef.current.settleSession(address, finalAllocations);

      // Step 2: Group settleable entities by chain to minimize switching
      const settleable = entities.filter((e) => {
        if (e.deposited <= 0) return false;
        const chainId = PROTOCOL_CHAIN_MAP[e.protocol as keyof typeof PROTOCOL_CHAIN_MAP];
        return !!chainId;
      });

      const chainGroups = new Map<number, GameEntity[]>();
      for (const entity of settleable) {
        const chainId = PROTOCOL_CHAIN_MAP[entity.protocol as keyof typeof PROTOCOL_CHAIN_MAP];
        const group = chainGroups.get(chainId) ?? [];
        group.push(entity);
        chainGroups.set(chainId, group);
      }

      // Process Sepolia first (most protocols), then Base Sepolia
      const sortedChains = [...chainGroups.keys()].sort((a, b) => {
        if (a === SETTLEMENT_CHAINS.SEPOLIA) return -1;
        if (b === SETTLEMENT_CHAINS.SEPOLIA) return 1;
        return a - b;
      });

      const transactions: SettlementTx[] = [];

      for (const chainId of sortedChains) {
        const chainEntities = chainGroups.get(chainId)!;

        // Switch wallet to the target chain
        try {
          await switchChainAsync({ chainId });
        } catch (switchErr) {
          // User rejected chain switch — mark all txs for this chain as failed
          for (const entity of chainEntities) {
            const protocolConfig = BUILDING_CONFIGS[entity.protocol];
            transactions.push({
              protocol: entity.protocol,
              protocolName: protocolConfig.name,
              chain: chainName(chainId),
              chainId,
              amount: usdToUsdc6(entity.deposited),
              hash: '',
              status: 'failed',
              error: `Chain switch to ${chainName(chainId)} rejected`,
            });
          }
          continue;
        }

        // Execute all protocol transactions on this chain
        for (const entity of chainEntities) {
          const protocol = entity.protocol;
          const protocolConfig = BUILDING_CONFIGS[protocol];
          const amount = usdToUsdc6(entity.deposited);
          const tx: SettlementTx = {
            protocol,
            protocolName: protocolConfig.name,
            chain: chainName(chainId),
            chainId,
            amount,
            hash: '',
            status: 'pending',
          };

          try {
            let hash: string;

            switch (protocol) {
              case 'compound':
                hash = await supplyToCompound(walletClient, publicClient, amount);
                break;
              case 'aave':
                hash = await supplyToAave(walletClient, publicClient, amount);
                break;
              case 'uniswap':
                hash = await swapOnUniswap(walletClient, publicClient, amount);
                break;
              case 'curve':
                // "Liquid Pool" building maps to Morpho Blue (direct Circle USDC)
                hash = await supplyToMorpho(walletClient, publicClient, amount);
                break;
              default:
                continue;
            }

            transactions.push({ ...tx, hash, status: 'confirmed' });
          } catch (txErr) {
            transactions.push({
              ...tx,
              status: 'failed',
              error: txErr instanceof Error ? txErr.message : 'Transaction failed',
            });
          }
        }
      }

      // Step 3: Update ENS text records (optional, non-blocking)
      // ENS is on Sepolia — switch back if needed
      if (meta?.ensName && walletClient) {
        try {
          await switchChainAsync({ chainId: SETTLEMENT_CHAINS.SEPOLIA });
          const totalDeposited = entities.reduce((s, e) => s + e.deposited, 0);
          // Find the protocol with the highest deposit
          const sorted = [...entities].sort((a, b) => b.deposited - a.deposited);
          const favoriteProtocol = sorted[0]?.deposited > 0 ? sorted[0].protocol : undefined;

          await updatePlayerProfile(walletClient, meta.ensName, {
            empireLevel: meta.empireLevel,
            totalContribution: totalDeposited,
            favoriteProtocol,
            prestigeCount: 0,
          });
        } catch (ensErr) {
          // ENS write failures should NOT fail the settlement
          console.warn('Failed to update ENS profile:', ensErr);
        }
      }

      // Store settlement result
      setLastSettlement({
        sessionId: currentSessionId,
        actionCount: currentActionCount,
        gasSaved: currentGasSaved,
        transactions,
        timestamp: Date.now(),
      });

      // Return true only if all transactions succeeded
      const allSucceeded = transactions.every(tx => tx.status === 'confirmed');
      return allSucceeded;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to settle session',
      );
      return false;
    } finally {
      setIsSettling(false);
    }
  }, [address, walletClient, publicClient, switchChainAsync]);

  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);

  // Auto-disconnect on wallet disconnect
  useEffect(() => {
    if (!isWalletConnected && managerRef.current) {
      managerRef.current.disconnect();
    }
  }, [isWalletConnected]);

  const value: YellowSessionContextValue = {
    isConnected: sessionState.isConnected,
    isSessionActive: sessionState.isSessionActive,
    isConnecting,
    isSettling,
    error,
    actionCount: sessionState.actionCount,
    gasSaved: sessionState.gasSaved,
    sessionId: sessionState.sessionId ?? null,
    actionBreakdown: sessionState.actionBreakdown ?? {},
    lastSettlement,
    connect,
    createSession,
    settleSession,
    performAction,
    disconnect,
  };

  return (
    <YellowSessionContext.Provider value={value}>
      {children}
    </YellowSessionContext.Provider>
  );
}
