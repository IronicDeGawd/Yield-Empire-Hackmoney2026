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
import { useAccount, useWalletClient } from 'wagmi';
import { YellowSessionManager } from '@/lib/yellow/session-manager';
import type { GameAction, GameEntity, SessionState, SettlementResult, SettlementTx } from '@/lib/types';
import type { RPCAppSessionAllocation } from '@erc7824/nitrolite';
import { supplyToCompound } from '@/lib/protocols/compound';
import { supplyToAave } from '@/lib/protocols/aave';
import { swapOnUniswap } from '@/lib/protocols/uniswap';
import { supplyToMorpho } from '@/lib/protocols/morpho';
import { BUILDING_CONFIGS } from '@/lib/constants';
import { PROTOCOL_CHAIN_MAP, SETTLEMENT_CHAINS } from '@/lib/protocols/addresses';

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

  // Settlement results
  lastSettlement: SettlementResult | null;

  // Actions
  connect: () => Promise<void>;
  createSession: () => Promise<void>;
  settleSession: (entities: GameEntity[]) => Promise<void>;
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
  lastSettlement: null,
  connect: async () => {},
  createSession: async () => {},
  settleSession: async () => {},
  performAction: async () => {},
  disconnect: () => {},
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
        setError('Session not active or wallet not connected');
        return;
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
   */
  const settleSession = useCallback(async (entities: GameEntity[]) => {
    if (!managerRef.current || !address || !walletClient) {
      setError('Cannot settle session');
      return;
    }

    setIsSettling(true);
    setError(null);

    const currentSessionId = sessionState.sessionId ?? 'unknown';
    const currentActionCount = sessionState.actionCount;
    const currentGasSaved = sessionState.gasSaved;

    try {
      // Step 1: Close Yellow Network session
      const finalAllocations: RPCAppSessionAllocation[] = [];
      await managerRef.current.settleSession(address, finalAllocations);

      // Step 2: Execute real protocol transactions for each building
      const transactions: SettlementTx[] = [];

      for (const entity of entities) {
        if (entity.deposited <= 0) continue;

        const protocol = entity.protocol;
        const protocolConfig = BUILDING_CONFIGS[protocol];
        const chainId = PROTOCOL_CHAIN_MAP[protocol as keyof typeof PROTOCOL_CHAIN_MAP];

        // Skip protocols without settlement support (yearn = Observatory, simulated)
        if (!chainId) continue;

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
              hash = await supplyToCompound(walletClient, amount);
              break;
            case 'aave':
              hash = await supplyToAave(walletClient, amount);
              break;
            case 'uniswap':
              hash = await swapOnUniswap(walletClient, amount);
              break;
            case 'curve':
              // "Liquid Pool" building maps to Morpho Blue (direct Circle USDC)
              hash = await supplyToMorpho(walletClient, amount);
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

      // Store settlement result
      setLastSettlement({
        sessionId: currentSessionId,
        actionCount: currentActionCount,
        gasSaved: currentGasSaved,
        transactions,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to settle session',
      );
      throw err;
    } finally {
      setIsSettling(false);
    }
  }, [address, walletClient, sessionState.sessionId, sessionState.actionCount, sessionState.gasSaved]);

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
