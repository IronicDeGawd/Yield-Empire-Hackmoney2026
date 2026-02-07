/**
 * useYellowSession Hook
 * React hook for Yellow Network state channel integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { YellowSessionManager } from '@/lib/yellow/session-manager';
import { GameAction, SessionState } from '@/lib/types';
import { Address, Hex } from 'viem';
import { RPCAppSessionAllocation } from '@erc7824/nitrolite';

export interface UseYellowSessionReturn {
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

/**
 * Hook for Yellow Network session management
 */
export function useYellowSession(): UseYellowSessionReturn {
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

  // Keep session manager in ref to persist across renders
  const managerRef = useRef<YellowSessionManager | null>(null);

  // Initialize session manager
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

  /**
   * Connect to Yellow Network
   */
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

  /**
   * Create game session
   */
  const createSession = useCallback(async () => {
    if (!address || !managerRef.current) {
      setError('Not ready to create session');
      return;
    }

    setError(null);

    try {
      await managerRef.current.createGameSession(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      throw err;
    }
  }, [address]);

  /**
   * Perform game action (gasless off-chain)
   */
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
        setError(err instanceof Error ? err.message : 'Failed to submit action');
        throw err;
      }
    },
    [address]
  );

  /**
   * Settle session (close state channel)
   */
  const settleSession = useCallback(async () => {
    if (!managerRef.current || !address) {
      setError('Cannot settle session');
      return;
    }

    setIsSettling(true);
    setError(null);

    try {
      // Final allocations - using default (all funds returned to user)
      // In production, this would reflect actual protocol deposits
      const finalAllocations: RPCAppSessionAllocation[] = [];

      await managerRef.current.settleSession(address, finalAllocations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to settle session');
      throw err;
    } finally {
      setIsSettling(false);
    }
  }, [address]);

  /**
   * Disconnect from Yellow Network
   */
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

  return {
    // Connection state
    isConnected: sessionState.isConnected,
    isSessionActive: sessionState.isSessionActive,
    isConnecting,
    isSettling,
    error,

    // Session data
    actionCount: sessionState.actionCount,
    gasSaved: sessionState.gasSaved,
    sessionId: sessionState.sessionId ?? null,

    // Actions
    connect,
    createSession,
    settleSession,
    performAction,
    disconnect,
  };
}
