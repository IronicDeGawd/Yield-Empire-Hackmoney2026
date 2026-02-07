'use client';

/**
 * YellowSessionProvider
 *
 * Shared context for Yellow Network session state.
 * Ensures a single YellowSessionManager instance is shared across all pages
 * (game, settlement, etc.) so session data (actionCount, gasSaved) is consistent.
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
import type { GameAction, SessionState } from '@/lib/types';
import type { RPCAppSessionAllocation } from '@erc7824/nitrolite';

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

  // Actions
  connect: () => Promise<void>;
  createSession: () => Promise<void>;
  settleSession: () => Promise<void>;
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
  connect: async () => {},
  createSession: async () => {},
  settleSession: async () => {},
  performAction: async () => {},
  disconnect: () => {},
};

export const YellowSessionContext =
  createContext<YellowSessionContextValue>(defaultValue);

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

  const settleSession = useCallback(async () => {
    if (!managerRef.current || !address) {
      setError('Cannot settle session');
      return;
    }

    setIsSettling(true);
    setError(null);

    try {
      const finalAllocations: RPCAppSessionAllocation[] = [];
      await managerRef.current.settleSession(address, finalAllocations);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to settle session',
      );
      throw err;
    } finally {
      setIsSettling(false);
    }
  }, [address]);

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
